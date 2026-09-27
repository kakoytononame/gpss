using Microsoft.EntityFrameworkCore;

namespace GpssStudio.WebApi.Infrastructure.Persistence;

/// <summary>
/// Creates the schema and demo data on startup. The embedded script is idempotent,
/// so the API can be pointed at an empty database and still start in a usable state.
/// </summary>
public static class DatabaseInitializer
{
    private const string SchemaResourceName = "GpssStudio.WebApi.Infrastructure.Persistence.Sql.schema.sql";

    public static async Task InitializeAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GpssStudioDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DatabaseInitializer));
        var script = await ReadSchemaScriptAsync(cancellationToken);

        const int maxAttempts = 10;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var connection = dbContext.Database.GetDbConnection();
                await connection.OpenAsync(cancellationToken);
                try
                {
                    await using var command = connection.CreateCommand();
                    command.CommandText = script;
                    await command.ExecuteNonQueryAsync(cancellationToken);
                }
                finally
                {
                    await connection.CloseAsync();
                }

                logger.LogInformation("Database schema is ready.");
                return;
            }
            catch (Exception exception) when (attempt < maxAttempts && exception is not OperationCanceledException)
            {
                logger.LogWarning("Database is not ready yet (attempt {Attempt}/{MaxAttempts}): {Message}", attempt, maxAttempts, exception.Message);
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
        }
    }

    private static async Task<string> ReadSchemaScriptAsync(CancellationToken cancellationToken)
    {
        await using var stream = typeof(DatabaseInitializer).Assembly.GetManifestResourceStream(SchemaResourceName)
                                 ?? throw new InvalidOperationException($"Embedded resource '{SchemaResourceName}' was not found.");
        using var reader = new StreamReader(stream);
        return await reader.ReadToEndAsync(cancellationToken);
    }
}
