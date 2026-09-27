namespace GpssStudio.WebApi.Application.Common;

/// <summary>
/// Raised when a requested resource does not exist. Mapped to HTTP 404.
/// </summary>
public sealed class NotFoundException : Exception
{
    public NotFoundException(string message)
        : base(message)
    {
    }
}

/// <summary>
/// Raised when a request is syntactically valid but cannot be applied. Mapped to HTTP 400.
/// </summary>
public sealed class BadRequestException : Exception
{
    public BadRequestException(string message)
        : base(message)
    {
    }
}
