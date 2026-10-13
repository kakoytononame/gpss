using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace GpssStudio.WebApi.Tests;

public sealed class SimulationApiTests : ApiTestBase
{
    private const string SimulationPath = "/api/alina-gpss/studio/simulation";
    private const string Model = "  GENERATE 10\n  SEIZE F\n  ADVANCE 5\n  RELEASE F\n  TERMINATE 1\n";

    [Fact]
    public async Task Translate_ReturnsErrorsWithLines()
    {
        var body = await ReadJsonAsync(await Client.PostAsJsonAsync($"{SimulationPath}/translate", new { text = "  GENERATE 10\n  TRANSFER ,NOWHERE" }));

        Assert.False(body.GetProperty("Success").GetBoolean());
        Assert.Equal(2, body.GetProperty("Errors")[0].GetProperty("Line").GetInt32());
    }

    [Fact]
    public async Task CreateSession_RunsStartFromModelAndReturnsReport()
    {
        var response = await Client.PostAsJsonAsync($"{SimulationPath}/sessions", new { text = Model + "  START 3", modelName = "Тест" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync(response);
        Assert.Equal("completed", body.GetProperty("State").GetString());
        Assert.Equal(35, body.GetProperty("Clock").GetDouble());
        var sections = body.GetProperty("Report").GetProperty("Sections").EnumerateArray().Select(section => section.GetProperty("Id").GetString()).ToArray();
        Assert.Contains("facilities", sections);
        Assert.True(body.GetProperty("Report").GetProperty("Charts").GetProperty("FacilityUtilization").GetArrayLength() == 1);
    }

    [Fact]
    public async Task Commands_StepContinueAndShow()
    {
        var created = await ReadJsonAsync(await Client.PostAsJsonAsync($"{SimulationPath}/sessions", new { text = Model }));
        var sessionId = created.GetProperty("SessionId").GetString();

        async Task<JsonElement> Command(string command) =>
            await ReadJsonAsync(await Client.PostAsJsonAsync($"{SimulationPath}/sessions/{sessionId}/commands", new { command }));

        Assert.Equal("paused", (await Command("STEP 2")).GetProperty("State").GetString());
        Assert.Equal("completed", (await Command("CONTINUE")).GetProperty("State").GetString());
        var show = await Command("SHOW FC$F");
        Assert.Contains("FC$F = 1", show.GetProperty("Journal").EnumerateArray().Select(line => line.GetString()));

        var snapshot = await ReadJsonAsync(await Client.GetAsync($"{SimulationPath}/sessions/{sessionId}"));
        Assert.Equal(15, snapshot.GetProperty("Clock").GetDouble());

        Assert.Equal(HttpStatusCode.NoContent, (await Client.DeleteAsync($"{SimulationPath}/sessions/{sessionId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Client.PostAsJsonAsync($"{SimulationPath}/sessions/{sessionId}/commands", new { command = "START 1" })).StatusCode);
    }

    [Fact]
    public async Task EmptyModel_Returns400()
    {
        var response = await Client.PostAsJsonAsync($"{SimulationPath}/sessions", new { text = "  " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Examples_ContainCanteenModel()
    {
        var example = await ReadJsonAsync(await Client.GetAsync($"{SimulationPath}/examples/canteen"));

        Assert.Equal("Столовая", example.GetProperty("Name").GetString());
        Assert.Contains("KASSA1", example.GetProperty("Text").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await Client.GetAsync($"{SimulationPath}/examples/unknown")).StatusCode);
    }

    [Fact]
    public async Task CreateSession_WithBreakpointLines_StopsAndListsTransactions()
    {
        var body = await ReadJsonAsync(await Client.PostAsJsonAsync($"{SimulationPath}/sessions", new { text = Model + "  START 3", BreakpointLines = new[] { 3 } }));

        Assert.Equal("paused", body.GetProperty("State").GetString());
        Assert.Contains("перед входом в блок 3 ADVANCE", body.GetProperty("StopReason").GetString());
        Assert.Equal(3, body.GetProperty("Breakpoints")[0].GetProperty("Block").GetInt32());
        Assert.Equal(3, body.GetProperty("Transactions")[0].GetProperty("NextBlock").GetInt32());
        Assert.Equal(5, body.GetProperty("BlockLines").GetArrayLength());
    }

    [Fact]
    public async Task Monitors_AndEvaluate_ReportIndicatorDynamicsAndCurrentValues()
    {
        var created = await ReadJsonAsync(await Client.PostAsJsonAsync($"{SimulationPath}/sessions", new
        {
            text = Model + "  START 3",
            Monitors = new[] { new { Expression = "AC1", Label = "Время" } },
            MonitorInterval = 2.5,
        }));
        var sessionId = created.GetProperty("SessionId").GetString();

        var series = created.GetProperty("Report").GetProperty("Charts").GetProperty("TimeSeries").EnumerateArray()
            .Single(item => item.GetProperty("Kind").GetString() == "monitor");
        Assert.Equal("Время", series.GetProperty("Name").GetString());
        Assert.Equal(2.5, series.GetProperty("Points")[1][0].GetDouble());
        Assert.Equal(2.5, series.GetProperty("Points")[1][1].GetDouble());

        var values = await ReadJsonAsync(await Client.PostAsJsonAsync($"{SimulationPath}/sessions/{sessionId}/evaluate", new { Expressions = new[] { "N1", "Q$(" } }));
        Assert.True(values[0].GetDouble() >= 3);
        Assert.Equal(JsonValueKind.Null, values[1].ValueKind);

        var invalid = await Client.PostAsJsonAsync($"{SimulationPath}/sessions", new { text = Model, MonitorInterval = -1 });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
    }
}
