using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace GpssStudio.WebApi.Tests;

public sealed class ResultApiTests : ApiTestBase
{
    private const string ResultsPath = "/api/alina-gpss/studio/results";

    [Fact]
    public async Task Results_AreSavedListedRenamedAndDeletedPerProject()
    {
        var project = await ReadJsonAsync(await Client.PostAsJsonAsync("/api/alina-gpss/studio/projects", new { Name = "Результаты e2e" }));
        var projectId = project.GetProperty("Id").GetString();

        var created = await Client.PostAsJsonAsync(ResultsPath, new
        {
            ProjectId = projectId,
            Kind = "single",
            Name = "Эксперимент 1",
            Payload = new { Clock = 480.5, Inputs = new[] { new { Name = "Интервал", Value = "8" } } },
        });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await ReadJsonAsync(created)).GetProperty("Id").GetString();
        await Client.PostAsJsonAsync(ResultsPath, new { ProjectId = projectId, Kind = "series", Name = "Серия 1", Payload = new { Points = 3 } });

        var list = await ReadJsonAsync(await Client.GetAsync($"{ResultsPath}?projectId={projectId}"));
        Assert.Equal(["Эксперимент 1", "Серия 1"], list.EnumerateArray().Select(item => item.GetProperty("Name").GetString()));
        Assert.Equal(["single", "series"], list.EnumerateArray().Select(item => item.GetProperty("Kind").GetString()));

        var stored = await ReadJsonAsync(await Client.GetAsync($"{ResultsPath}/{id}"));
        // The payload is stored as sent (the test client writes camelCase names).
        Assert.Equal(480.5, stored.GetProperty("Payload").GetProperty("clock").GetDouble());

        var renamed = await ReadJsonAsync(await Client.PatchAsJsonAsync($"{ResultsPath}/{id}", new { Name = "Базовый вариант" }));
        Assert.Equal("Базовый вариант", renamed.GetProperty("Name").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await Client.DeleteAsync($"{ResultsPath}/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Client.GetAsync($"{ResultsPath}/{id}")).StatusCode);

        // Deleting the project removes its results.
        await Client.DeleteAsync($"/api/alina-gpss/studio/projects/{projectId}");
        Assert.Equal(0, (await ReadJsonAsync(await Client.GetAsync($"{ResultsPath}?projectId={projectId}"))).GetArrayLength());
    }

    [Fact]
    public async Task InvalidResults_AreRejected()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await Client.PostAsJsonAsync(ResultsPath, new { Kind = "other", Name = "x", Payload = new { } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Client.PostAsJsonAsync(ResultsPath, new { Kind = "single", Name = " ", Payload = new { } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Client.PostAsJsonAsync(ResultsPath, new { Kind = "single", Name = "x", Payload = 5 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Client.PostAsJsonAsync(ResultsPath, new { ProjectId = Guid.NewGuid(), Kind = "single", Name = "x", Payload = new { } })).StatusCode);
    }
}
