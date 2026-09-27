using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;

namespace GpssStudio.WebApi.Tests;

/// <summary>
/// Boots the real API against a throwaway PostgreSQL database that is created for the
/// test run and dropped afterwards. The server is taken from GPSS_TEST_DB
/// (defaults to the docker-compose database published on localhost:55432).
/// </summary>
public sealed class GpssApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _adminConnectionString =
        Environment.GetEnvironmentVariable("GPSS_TEST_DB") ?? "Host=localhost;Port=55432;Database=postgres;Username=gpss;Password=gpss";

    private readonly string _databaseName = $"gpss_test_{Guid.NewGuid():N}";

    private string ConnectionString => new NpgsqlConnectionStringBuilder(_adminConnectionString) { Database = _databaseName, Pooling = false }.ConnectionString;

    public async Task InitializeAsync()
    {
        await using var connection = new NpgsqlConnection(_adminConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"create database \"{_databaseName}\"", connection);
        await command.ExecuteNonQueryAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", ConnectionString);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(_adminConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"drop database if exists \"{_databaseName}\" with (force)", connection);
        await command.ExecuteNonQueryAsync();
    }
}
