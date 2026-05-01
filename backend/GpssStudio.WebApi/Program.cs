using GpssStudio.WebApi.Application.Tebs.Interfaces;
using GpssStudio.WebApi.Application.Tebs.Services;
using GpssStudio.WebApi.Infrastructure.Persistence;
using GpssStudio.WebApi.Infrastructure.Persistence.Interfaces;
using GpssStudio.WebApi.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = null;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<GpssStudioDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<ITebRepository, TebRepository>();
builder.Services.AddScoped<ITebService, TebService>();

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

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<GpssStudioDbContext>();
    dbContext.Database.ExecuteSqlRaw("""
        create table if not exists workspace_snapshots (
          id text primary key,
          snapshot_json jsonb not null default '{{}}'::jsonb,
          updated_at timestamptz not null default now()
        );
        """);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { Status = "ok" }));

app.Run();
