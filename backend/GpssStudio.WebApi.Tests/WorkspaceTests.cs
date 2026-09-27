using System.Net;
using System.Net.Http.Json;

namespace GpssStudio.WebApi.Tests;

public sealed class WorkspaceTests : ApiTestBase
{
    [Fact]
    public async Task GetWorkspace_WhenNothingSaved_Returns404()
    {
        var response = await Client.GetAsync(WorkspacePath);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SaveWorkspace_RoundTripsSnapshotAndOverwrites()
    {
        var first = await Client.PutAsJsonAsync(WorkspacePath, new { snapshot = new { activeTab = "general", modelFontSize = 14 } });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await Client.PutAsJsonAsync(WorkspacePath, new { snapshot = new { activeTab = "states", modelFontSize = 18, openDocuments = new[] { "editor", "scheme" } } });
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        var body = await ReadJsonAsync(await Client.GetAsync(WorkspacePath));
        var snapshot = body.GetProperty("Snapshot");
        Assert.Equal("states", snapshot.GetProperty("activeTab").GetString());
        Assert.Equal(18, snapshot.GetProperty("modelFontSize").GetInt32());
        Assert.Equal(2, snapshot.GetProperty("openDocuments").GetArrayLength());
        Assert.True(body.GetProperty("UpdatedAt").GetDateTimeOffset() > DateTimeOffset.UtcNow.AddMinutes(-5));
    }

    [Fact]
    public async Task SaveWorkspace_AcceptsMultiMegabyteSnapshots()
    {
        var imageUrl = "data:image/png;base64," + new string('A', 3 * 1024 * 1024);

        var response = await Client.PutAsJsonAsync(WorkspacePath, new { snapshot = new { teb = new { imageUrl } } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("{\"snapshot\":[1,2,3]}")]
    [InlineData("{\"snapshot\":null}")]
    [InlineData("{}")]
    [InlineData("not json")]
    public async Task SaveWorkspace_NonObjectSnapshot_Returns400(string payload)
    {
        var response = await Client.PutAsync(WorkspacePath, new StringContent(payload, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
