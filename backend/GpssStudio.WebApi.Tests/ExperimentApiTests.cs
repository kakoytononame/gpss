using System.Net;
using System.Net.Http.Json;

namespace GpssStudio.WebApi.Tests;

public sealed class ExperimentApiTests : ApiTestBase
{
    private const string Path = "/api/alina-gpss/studio/experiments";

    [Fact]
    public async Task Run_ReturnsPlanPointsRunsAndBestPoint()
    {
        var response = await Client.PostAsJsonAsync(Path, new
        {
            ModelText = " GENERATE 10\n SEIZE F\n ADVANCE X$Service\n RELEASE F\n TERMINATE 1\n",
            Factors = new[] { new { Name = "Service", Kind = "Savevalue", Levels = new[] { 2.0, 6.0 } } },
            Indicators = new[] { new { Expression = "FR$F", Label = "Загрузка" } },
            Replications = 2,
            StartCount = 20,
            ObjectiveIndicator = 0,
            Maximize = true,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync(response);
        Assert.Equal(2, body.GetProperty("Points").GetArrayLength());
        Assert.Equal(4, body.GetProperty("Runs").GetArrayLength());
        Assert.Equal(1, body.GetProperty("BestPoint").GetInt32());
        Assert.InRange(body.GetProperty("Points")[1].GetProperty("Indicators")[0].GetProperty("Mean").GetDouble(), 550, 620);
    }

    [Fact]
    public async Task Run_RejectsRequestsWithoutIndicators()
    {
        var response = await Client.PostAsJsonAsync(Path, new { ModelText = " GENERATE 1\n TERMINATE 1\n" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
