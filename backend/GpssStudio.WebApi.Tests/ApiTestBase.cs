using System.Net.Http.Json;
using System.Text.Json;

namespace GpssStudio.WebApi.Tests;

/// <summary>
/// xUnit creates a new instance per test, so every test gets its own freshly seeded database.
/// </summary>
public abstract class ApiTestBase : IAsyncLifetime
{
    protected const string LibraryId = "0";
    protected const string ClassId = "3ef71b95-07f7-41c6-b532-03d83d8a3973";
    protected const string InstanceId = "80ba15bc-7a4a-4b36-ba57-df2cab3b89ad";
    protected const string ClassPath = $"/api/alina-gpss/studio/tebs/libraries/{LibraryId}/classes/{ClassId}";
    protected const string InstancePath = $"{ClassPath}/instances/{InstanceId}";
    protected const string WorkspacePath = "/api/alina-gpss/studio/tebs/workspace";

    private readonly GpssApiFactory _factory = new();

    protected HttpClient Client { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _factory.InitializeAsync();
        Client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        Client.Dispose();
        await ((IAsyncLifetime)_factory).DisposeAsync();
    }

    protected static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json;
    }

    protected async Task<JsonElement> GetClassAsync()
    {
        var response = await Client.GetAsync(ClassPath);
        response.EnsureSuccessStatusCode();
        return await ReadJsonAsync(response);
    }

    protected static string[] Names(JsonElement array, string property = "NameInModel") =>
        array.EnumerateArray().Select(item => item.GetProperty(property).GetString() ?? string.Empty).ToArray();
}
