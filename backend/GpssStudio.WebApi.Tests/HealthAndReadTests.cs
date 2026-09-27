using System.Net;

namespace GpssStudio.WebApi.Tests;

public sealed class HealthAndReadTests : ApiTestBase
{
    [Fact]
    public async Task Health_ReportsDatabaseAvailability()
    {
        var response = await Client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync(response);
        Assert.Equal("ok", body.GetProperty("Status").GetString());
        Assert.Equal("ok", body.GetProperty("Database").GetString());
    }

    [Fact]
    public async Task GetClass_ReturnsSeededClassWithAllCollections()
    {
        var body = await GetClassAsync();

        Assert.Equal(ClassId, body.GetProperty("ClassId").GetString());
        Assert.Equal("SimpleTebClass", body.GetProperty("Type").GetString());
        Assert.Equal("BI_U_3", body.GetProperty("NameInModel").GetString());
        Assert.Contains("SEIZE", body.GetProperty("GpssModel").GetProperty("Text").GetString());
        Assert.Equal(new[] { "BU3_Q", "BU3" }, Names(body.GetProperty("GpssEntities")));
        Assert.Equal(new[] { "IN" }, Names(body.GetProperty("Inputs")));
        Assert.Equal(new[] { "OUT" }, Names(body.GetProperty("Outputs")));
        Assert.Equal(new[] { "travelTime", "NEXT_STATION" }, Names(body.GetProperty("Parameters")));
        Assert.Equal(new[] { "Busy", "QueueLength" }, Names(body.GetProperty("States")));
    }

    [Fact]
    public async Task GetClass_UnknownClass_Returns404ProblemDetails()
    {
        var response = await Client.GetAsync($"/api/alina-gpss/studio/tebs/libraries/0/classes/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetClass_WrongLibrary_Returns404()
    {
        var response = await Client.GetAsync($"/api/alina-gpss/studio/tebs/libraries/other/classes/{ClassId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetInstance_ReturnsInstanceWithParameterValuesAndClass()
    {
        var response = await Client.GetAsync(InstancePath);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync(response);
        Assert.Equal("BI_U_3_01", body.GetProperty("NameInModel").GetString());
        Assert.Equal(ClassId, body.GetProperty("Class").GetProperty("ClassId").GetString());
        var values = body.GetProperty("ParameterValues").EnumerateArray().ToDictionary(item => item.GetProperty("NameInModel").GetString()!, item => item.GetProperty("Value").GetString());
        Assert.Equal("6", values["travelTime"]);
        Assert.Equal("ARRIVAL", values["NEXT_STATION"]);
    }

    [Fact]
    public async Task GetInstance_UnderDifferentClass_Returns404()
    {
        var response = await Client.GetAsync($"/api/alina-gpss/studio/tebs/libraries/0/classes/{Guid.NewGuid()}/instances/{InstanceId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Swagger_IsPublished()
    {
        var response = await Client.GetAsync("/swagger/v1/swagger.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("/api/alina-gpss/studio/tebs/workspace", body);
    }
}
