using System.Net;
using System.Net.Http.Json;

namespace GpssStudio.WebApi.Tests;

public sealed class QueueingApiTests : ApiTestBase
{
    private const string Path = "/api/alina-gpss/studio/queueing";

    private static object MM1(double interarrival = 10, double service = 8) => new
    {
        Name = "M/M/1",
        Duration = 50_000,
        WarmUp = 2_000,
        Replications = 4,
        Classes = new[] { new { Id = "c", Name = "Заявки", Kind = "Open", Arrival = new { Kind = "Exponential", Mean = interarrival }, Entry = "n" } },
        Nodes = new[] { new { Id = "n", Name = "Касса", Servers = 1, Discipline = "Fifo", Service = new { Kind = "Exponential", Mean = service } } },
    };

    [Fact]
    public async Task Presets_AreListedWithTheirModels()
    {
        var body = await ReadJsonAsync(await Client.GetAsync($"{Path}/presets"));
        Assert.True(body.GetArrayLength() >= 20);
        var first = body[0];
        Assert.Equal("mm1", first.GetProperty("Id").GetString());
        Assert.Equal("Exponential", first.GetProperty("Model").GetProperty("Nodes")[0].GetProperty("Service").GetProperty("Kind").GetString());
    }

    [Fact]
    public async Task Generate_ReturnsGpssText()
    {
        var response = await Client.PostAsJsonAsync($"{Path}/generate", MM1());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync(response);
        Assert.Contains("GENERATE  (Exponential(2,0,10))", body.GetProperty("Text").GetString());
        Assert.Equal("Node1", body.GetProperty("Nodes")[0].GetProperty("Name").GetString());
    }

    [Fact]
    public async Task Analyze_ReturnsExactMM1Measures()
    {
        var body = await ReadJsonAsync(await Client.PostAsJsonAsync($"{Path}/analyze", MM1()));
        var node = body.GetProperty("Nodes")[0];
        Assert.Equal("Exact", node.GetProperty("Quality").GetString());
        Assert.Equal("M/M/1", node.GetProperty("Kendall").GetString());
        Assert.Equal(4, node.GetProperty("Metrics").GetProperty("L").GetDouble(), 9);
    }

    [Fact]
    public async Task Simulate_ComparesReplicationsWithTheory()
    {
        var body = await ReadJsonAsync(await Client.PostAsJsonAsync($"{Path}/simulate", MM1()));
        Assert.Equal(4, body.GetProperty("Replications").GetInt32());
        var utilization = body.GetProperty("Nodes")[0].GetProperty("Metrics").EnumerateArray().Single(metric => metric.GetProperty("Key").GetString() == "Utilization");
        Assert.Equal(0.8, utilization.GetProperty("Analytic").GetDouble(), 9);
        Assert.InRange(utilization.GetProperty("Mean").GetDouble(), 0.75, 0.85);
        Assert.True(utilization.GetProperty("HalfWidth").GetDouble() > 0);
    }

    [Fact]
    public async Task UnstableSystem_HasNoAnalyticValues()
    {
        var body = await ReadJsonAsync(await Client.PostAsJsonAsync($"{Path}/analyze", MM1(interarrival: 5)));
        var node = body.GetProperty("Nodes")[0];
        Assert.Equal("Unavailable", node.GetProperty("Quality").GetString());
    }

    [Fact]
    public async Task InvalidDescription_IsRejected()
    {
        var response = await Client.PostAsJsonAsync($"{Path}/generate", new { Classes = Array.Empty<object>(), Nodes = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problems = await ReadJsonAsync(await Client.PostAsJsonAsync($"{Path}/validate", new { Classes = Array.Empty<object>(), Nodes = Array.Empty<object>() }));
        Assert.True(problems.GetArrayLength() >= 2);
    }
}
