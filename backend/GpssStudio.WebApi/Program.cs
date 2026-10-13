using GpssStudio.WebApi.Application.Projects;
using GpssStudio.WebApi.Application.Simulation;
using GpssStudio.WebApi.Application.Tebs.Interfaces;
using GpssStudio.WebApi.Application.Tebs.Services;
using GpssStudio.WebApi.Infrastructure.Persistence;
using GpssStudio.WebApi.Infrastructure.Persistence.Interfaces;
using GpssStudio.WebApi.Infrastructure.Persistence.Repositories;
using GpssStudio.WebApi.Infrastructure.Web;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = null;
});

// Minimal API endpoints (health) use the same PascalCase contract as the controllers.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = null;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services.AddDbContext<GpssStudioDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<ITebRepository, TebRepository>();
builder.Services.AddScoped<ITebService, TebService>();
builder.Services.AddSingleton<SimulationSessionStore>();
builder.Services.AddScoped<StudioProjectService>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Configuration.GetValue("Database:InitializeOnStartup", true))
{
    await DatabaseInitializer.InitializeAsync(app.Services);
}

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Configuration.GetValue("Swagger:Enabled", true))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.MapControllers();

app.MapGet("/api/health", async (GpssStudioDbContext dbContext, CancellationToken cancellationToken) =>
{
    var databaseAvailable = await dbContext.Database.CanConnectAsync(cancellationToken);
    var payload = new { Status = databaseAvailable ? "ok" : "degraded", Database = databaseAvailable ? "ok" : "unavailable" };
    return databaseAvailable ? Results.Ok(payload) : Results.Json(payload, statusCode: StatusCodes.Status503ServiceUnavailable);
});

app.Run();

/// <summary>
/// Entry point marker used by integration tests (<c>WebApplicationFactory&lt;Program&gt;</c>).
/// </summary>
public partial class Program;
