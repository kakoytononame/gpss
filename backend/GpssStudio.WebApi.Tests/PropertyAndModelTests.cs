using System.Net;
using System.Net.Http.Json;

namespace GpssStudio.WebApi.Tests;

public sealed class PropertyAndModelTests : ApiTestBase
{
    [Theory]
    [InlineData("nameInModel", "NameInModel")]
    [InlineData("header", "Header")]
    [InlineData("description", "Description")]
    public async Task PatchCoreField_UpdatesClass(string path, string responseProperty)
    {
        var response = await Client.PatchAsJsonAsync($"{ClassPath}/properties", new { path, value = "Новое значение" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Новое значение", (await ReadJsonAsync(response)).GetProperty(responseProperty).GetString());
        Assert.Equal("Новое значение", (await GetClassAsync()).GetProperty(responseProperty).GetString());
    }

    [Fact]
    public async Task PatchImage_StoresNameAndDataUrl()
    {
        const string dataUrl = "data:image/png;base64,iVBORw0KGgo=";
        var response = await Client.PatchAsJsonAsync($"{ClassPath}/properties", new { path = "image", value = new { imageName = "teb.png", imageUrl = dataUrl } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await GetClassAsync();
        Assert.Equal("teb.png", body.GetProperty("ImageName").GetString());
        Assert.Equal(dataUrl, body.GetProperty("ImageUrl").GetString());
    }

    [Fact]
    public async Task PatchWholeCollection_ReplacesRowsInOrder()
    {
        var response = await Client.PatchAsJsonAsync($"{ClassPath}/properties", new
        {
            path = "states",
            value = new object[]
            {
                new { id = "state-new", name = "Idle", expression = "F$BU3 = 0", description = "" },
                new { id = "40000000-0000-0000-0000-000000000001", name = "Busy", expression = "F$BU3 = 1", description = "Участок занят" },
            },
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var states = (await GetClassAsync()).GetProperty("States");
        Assert.Equal(new[] { "Idle", "Busy" }, Names(states));
        Assert.Equal("40000000-0000-0000-0000-000000000001", states[1].GetProperty("Id").GetString());
    }

    [Theory]
    [InlineData("inputs", "Inputs")]
    [InlineData("outputs", "Outputs")]
    public async Task PatchPorts_ReplacesOnlyRequestedDirection(string path, string responseProperty)
    {
        var response = await Client.PatchAsJsonAsync($"{ClassPath}/properties", new
        {
            path,
            value = new object[] { new { nameInModel = "P1", header = "Порт", connectedBlock = "SEIZE", connectionsLimit = 2, description = "" } },
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await GetClassAsync();
        Assert.Equal(new[] { "P1" }, Names(body.GetProperty(responseProperty)));
        Assert.Equal("2", body.GetProperty(responseProperty)[0].GetProperty("ConnectionsLimit").GetString());
        var otherProperty = responseProperty == "Inputs" ? "Outputs" : "Inputs";
        Assert.Single(body.GetProperty(otherProperty).EnumerateArray());
    }

    [Fact]
    public async Task PatchIndexedRow_UpdatesSingleGpssEntity()
    {
        var response = await Client.PatchAsJsonAsync($"{ClassPath}/properties", new
        {
            path = "gpssEntities[1]",
            value = new { id = "10000000-0000-0000-0000-000000000002", type = "Storage", nameInModel = "BU3S", value = 4, description = "Память" },
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var entities = (await GetClassAsync()).GetProperty("GpssEntities");
        Assert.Equal(new[] { "BU3_Q", "BU3S" }, Names(entities));
        Assert.Equal("4", entities[1].GetProperty("Value").GetString());
        Assert.Equal("Storage", entities[1].GetProperty("Type").GetString());
    }

    [Fact]
    public async Task PatchIndexedRow_OutOfRange_Returns404()
    {
        var response = await Client.PatchAsJsonAsync($"{ClassPath}/properties", new { path = "states[7]", value = new { name = "X" } });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("{\"path\":\"unknownField\",\"value\":1}")]
    [InlineData("{\"path\":\"\",\"value\":1}")]
    [InlineData("{\"path\":\"header\"}")]
    [InlineData("{\"path\":\"states\",\"value\":\"not-an-array\"}")]
    public async Task PatchProperty_InvalidPayload_Returns400(string payload)
    {
        var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PatchAsync($"{ClassPath}/properties", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PatchProperty_UnknownClass_Returns404()
    {
        var response = await Client.PatchAsJsonAsync($"/api/alina-gpss/studio/tebs/libraries/0/classes/{Guid.NewGuid()}/properties", new { path = "header", value = "x" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateGpssModel_PersistsText()
    {
        const string text = "GENERATE 10\nTERMINATE 1";

        var response = await Client.PutAsJsonAsync($"{ClassPath}/gpss-model", new { text });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(text, (await GetClassAsync()).GetProperty("GpssModel").GetProperty("Text").GetString());
    }
}
