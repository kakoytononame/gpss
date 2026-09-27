using System.Net;
using System.Net.Http.Json;

namespace GpssStudio.WebApi.Tests;

public sealed class ParameterTests : ApiTestBase
{
    [Fact]
    public async Task AddParameter_AppendsToTheEnd()
    {
        var response = await Client.PostAsJsonAsync($"{ClassPath}/parameters", new
        {
            id = Guid.NewGuid().ToString(),
            type = "IntegerParameterType",
            header = "Каналы",
            nameInModel = "CHANNELS",
            defaultValue = 3,
            allowEmptyValues = true,
            currentValue = "",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await ReadJsonAsync(response);
        var parameters = body.GetProperty("Parameters");
        Assert.Equal(new[] { "travelTime", "NEXT_STATION", "CHANNELS" }, Names(parameters));
        var added = parameters[2];
        Assert.Equal("IntegerParameterType", added.GetProperty("Type").GetString());
        Assert.Equal("3", added.GetProperty("DefaultValue").GetString());
        Assert.True(added.GetProperty("AllowEmptyValues").GetBoolean());
    }

    [Fact]
    public async Task AddParameter_WithNonGuidClientId_GetsServerId()
    {
        var response = await Client.PostAsJsonAsync($"{ClassPath}/parameters", new { id = "parameter-7", nameInModel = "X" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var added = (await ReadJsonAsync(response)).GetProperty("Parameters")[2];
        Assert.True(Guid.TryParse(added.GetProperty("Id").GetString(), out _));
        Assert.Equal("NumberParameterType", added.GetProperty("Type").GetString());
    }

    [Fact]
    public async Task UpdateParameter_ByIndex_ChangesFields()
    {
        var response = await Client.PatchAsJsonAsync($"{ClassPath}/parameters/1", new
        {
            type = "NameOrPartParameterType",
            header = "Станция",
            nameInModel = "STATION",
            defaultValue = "DEPOT",
            allowEmptyValues = false,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = (await ReadJsonAsync(response)).GetProperty("Parameters")[1];
        Assert.Equal("STATION", updated.GetProperty("NameInModel").GetString());
        Assert.Equal("DEPOT", updated.GetProperty("DefaultValue").GetString());
    }

    [Fact]
    public async Task UpdateParameter_ByGuid_ChangesFields()
    {
        var response = await Client.PatchAsJsonAsync($"{ClassPath}/parameters/30000000-0000-0000-0000-000000000001", new { header = "Время", defaultValue = 9 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = (await ReadJsonAsync(response)).GetProperty("Parameters")[0];
        Assert.Equal("Время", updated.GetProperty("Header").GetString());
        Assert.Equal("9", updated.GetProperty("DefaultValue").GetString());
        Assert.Equal("travelTime", updated.GetProperty("NameInModel").GetString());
    }

    [Theory]
    [InlineData("down", new[] { "NEXT_STATION", "travelTime" })]
    [InlineData("up", new[] { "travelTime", "NEXT_STATION" })]
    public async Task MoveParameter_SwapsWithNeighbourOrStaysAtEdge(string direction, string[] expected)
    {
        var response = await Client.PostAsJsonAsync($"{ClassPath}/parameters/0/move", new { direction });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expected, Names((await ReadJsonAsync(response)).GetProperty("Parameters")));
    }

    [Fact]
    public async Task MoveParameter_InvalidDirection_Returns400()
    {
        var response = await Client.PostAsJsonAsync($"{ClassPath}/parameters/0/move", new { direction = "sideways" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteParameter_RemovesItAndCompactsOrder()
    {
        var response = await Client.DeleteAsync($"{ClassPath}/parameters/0");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var body = await GetClassAsync();
        Assert.Equal(new[] { "NEXT_STATION" }, Names(body.GetProperty("Parameters")));

        var moveResponse = await Client.PostAsJsonAsync($"{ClassPath}/parameters/0/move", new { direction = "down" });
        Assert.Equal(HttpStatusCode.OK, moveResponse.StatusCode);
    }

    [Theory]
    [InlineData("99", HttpStatusCode.NotFound)]
    [InlineData("-1", HttpStatusCode.NotFound)]
    [InlineData("not-a-guid", HttpStatusCode.BadRequest)]
    [InlineData("11111111-1111-1111-1111-111111111111", HttpStatusCode.NotFound)]
    public async Task DeleteParameter_UnknownIdentifier_ReturnsClientError(string parameterId, HttpStatusCode expected)
    {
        var response = await Client.DeleteAsync($"{ClassPath}/parameters/{parameterId}");

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task SetParameterValue_IsVisibleOnInstance()
    {
        var response = await Client.PutAsJsonAsync($"{InstancePath}/parameters/0/value", new { value = 12.5 });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var instance = await ReadJsonAsync(await Client.GetAsync(InstancePath));
        Assert.Equal("12.5", instance.GetProperty("ParameterValues")[0].GetProperty("Value").GetString());
    }

    [Fact]
    public async Task SetParameterValue_ForNewParameter_CreatesValueRow()
    {
        await Client.PostAsJsonAsync($"{ClassPath}/parameters", new { nameInModel = "NEW" });

        var response = await Client.PutAsJsonAsync($"{InstancePath}/parameters/2/value", new { value = "abc" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var instance = await ReadJsonAsync(await Client.GetAsync(InstancePath));
        Assert.Equal("abc", instance.GetProperty("ParameterValues")[2].GetProperty("Value").GetString());
    }

    [Fact]
    public async Task SetParameterValue_UnknownInstance_Returns404()
    {
        var response = await Client.PutAsJsonAsync($"{ClassPath}/instances/{Guid.NewGuid()}/parameters/0/value", new { value = 1 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
