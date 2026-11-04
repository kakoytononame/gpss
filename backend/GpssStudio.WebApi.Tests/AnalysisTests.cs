using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using GpssStudio.WebApi.Application.Analysis;

namespace GpssStudio.WebApi.Tests;

/// <summary>Language model clients against a fake HTTP server.</summary>
public sealed class LanguageModelTests
{
    private sealed class FakeHandler(string response) : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }
        public JsonDocument? Body { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Request = request;
            Body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(response, Encoding.UTF8, "application/json") };
        }
    }

    [Fact]
    public async Task LocalModel_SendsChatCompletion()
    {
        var handler = new FakeHandler("""{"choices":[{"message":{"role":"assistant","content":"Пояснение"}}]}""");
        var model = new LocalLanguageModel(new HttpClient(handler), new AnalysisOptions { Provider = "local", Endpoint = "http://ollama:11434/v1/", Model = "qwen2.5:3b" });

        Assert.Equal("Пояснение", await model.CompleteAsync("система", "данные", CancellationToken.None));
        Assert.Equal("http://ollama:11434/v1/chat/completions", handler.Request!.RequestUri!.ToString());
        Assert.Equal("qwen2.5:3b", handler.Body!.RootElement.GetProperty("model").GetString());
        Assert.Equal("system", handler.Body.RootElement.GetProperty("messages")[0].GetProperty("role").GetString());
    }

    [Fact]
    public async Task Claude_UsesTheMessagesApiWithFallback()
    {
        var handler = new FakeHandler("""
            {"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5-5","stop_reason":"end_turn","stop_sequence":null,
             "content":[{"type":"text","text":"Пояснение Claude"}],
             "usage":{"input_tokens":10,"output_tokens":5}}
            """);
        var model = new AnthropicLanguageModel(new AnalysisOptions { Provider = "anthropic", ApiKey = "test-key" }, new HttpClient(handler));

        Assert.Equal("Пояснение Claude", await model.CompleteAsync("система", "данные", CancellationToken.None));
        Assert.EndsWith("/v1/messages", handler.Request!.RequestUri!.AbsolutePath);
        Assert.Equal("claude-opus-5-5", handler.Body!.RootElement.GetProperty("model").GetString());
        Assert.Equal("default", handler.Body.RootElement.GetProperty("fallbacks").GetString());
        Assert.Contains("server-side-fallback-2026-07-01", handler.Request.Headers.GetValues("anthropic-beta"));
        Assert.True(handler.Request.Headers.Contains("x-api-key") || handler.Request.Headers.Authorization is not null, string.Join(", ", handler.Request.Headers.Select(header => header.Key)));
    }
}

/// <summary>The analysis endpoint without a configured language model returns the findings only.</summary>
public sealed class AnalysisApiTests : ApiTestBase
{
    [Fact]
    public async Task Status_AndFindingsWithoutALanguageModel()
    {
        var status = await ReadJsonAsync(await Client.GetAsync("/api/alina-gpss/studio/analysis/status"));
        Assert.False(status.GetProperty("Available").GetBoolean());

        var response = await Client.PostAsJsonAsync("/api/alina-gpss/studio/analysis/queueing", new
        {
            Model = new
            {
                Name = "M/M/1",
                Classes = new[] { new { Id = "c", Name = "Заявки", Kind = "Open", Arrival = new { Kind = "Exponential", Mean = 10 }, Entry = "n" } },
                Nodes = new[] { new { Id = "n", Name = "Касса", Servers = 1, Service = new { Kind = "Exponential", Mean = 9.5 } } },
            },
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJsonAsync(response);
        Assert.Contains("узкое место", body.GetProperty("Findings")[0].GetProperty("Title").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("Explanation").ValueKind);
    }
}
