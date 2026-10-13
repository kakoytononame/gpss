using System.Text.Json;
using GpssStudio.WebApi.Application.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace GpssStudio.WebApi.Infrastructure.Web;

/// <summary>
/// Converts domain exceptions into RFC 7807 problem details instead of bare HTTP 500 responses.
/// </summary>
public sealed class ApiExceptionHandler : IExceptionHandler
{
    private readonly ILogger<ApiExceptionHandler> _logger;

    public ApiExceptionHandler(ILogger<ApiExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            NotFoundException => (StatusCodes.Status404NotFound, "Resource not found"),
            BadRequestException or JsonException or FormatException or ArgumentException => (StatusCodes.Status400BadRequest, "Invalid request"),
            OperationCanceledException when httpContext.RequestAborted.IsCancellationRequested => (499, "Request cancelled"),
            _ => (StatusCodes.Status500InternalServerError, "Unexpected server error"),
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception while processing {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = status == StatusCodes.Status500InternalServerError ? null : exception.Message,
            Instance = httpContext.Request.Path,
        };

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(problem, (JsonSerializerOptions?)null, "application/problem+json", cancellationToken);
        return true;
    }
}
