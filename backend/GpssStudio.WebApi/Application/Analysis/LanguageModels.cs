using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Anthropic;
using Anthropic.Models.Beta.Messages;

namespace GpssStudio.WebApi.Application.Analysis;

/// <summary>
/// Language model used to explain simulation results ("Analysis" configuration section):
/// <c>none</c> — only the built-in deterministic analysis; <c>local</c> — an OpenAI-compatible server
/// (Ollama, llama.cpp server, LM Studio, vLLM) with a small model on the same machine;
/// <c>anthropic</c> — Claude through the Anthropic API.
/// </summary>
public sealed class AnalysisOptions
{
    public string Provider { get; set; } = "none";

    /// <summary>Base URL of the OpenAI-compatible API, e.g. http://ollama:11434/v1.</summary>
    public string? Endpoint { get; set; }

    public string? Model { get; set; }

    /// <summary>API key (for Anthropic: otherwise ANTHROPIC_API_KEY from the environment).</summary>
    public string? ApiKey { get; set; }

    public int MaxTokens { get; set; } = 2000;
    public int TimeoutSeconds { get; set; } = 120;
}

public interface ILanguageModel
{
    /// <summary>Provider name shown to the user, or null when no model is configured.</summary>
    string? Provider { get; }

    string? ModelName { get; }

    Task<string> CompleteAsync(string system, string user, CancellationToken cancellationToken);
}

public sealed class NoLanguageModel : ILanguageModel
{
    public string? Provider => null;
    public string? ModelName => null;

    public Task<string> CompleteAsync(string system, string user, CancellationToken cancellationToken) =>
        throw new InvalidOperationException("Языковая модель не настроена.");
}

/// <summary>Chat completions of an OpenAI-compatible server (local small models).</summary>
public sealed class LocalLanguageModel(HttpClient http, AnalysisOptions options) : ILanguageModel
{
    public string? Provider => "локальная модель";
    public string? ModelName => options.Model;

    public async Task<string> CompleteAsync(string system, string user, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{options.Endpoint!.TrimEnd('/')}/chat/completions")
        {
            Content = JsonContent.Create(new
            {
                model = options.Model,
                temperature = 0.2,
                max_tokens = options.MaxTokens,
                messages = new[] { new { role = "system", content = system }, new { role = "user", content = user } },
            }),
        };
        if (!string.IsNullOrEmpty(options.ApiKey))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);
        }

        using var response = await http.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Локальная модель вернула {(int)response.StatusCode}: {Truncate(body)}");
        }

        using var json = JsonDocument.Parse(body);
        return json.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
    }

    private static string Truncate(string text) => text.Length > 300 ? text[..300] : text;
}

/// <summary>Claude through the official Anthropic SDK, with server-side fallback when a request is declined.</summary>
public sealed class AnthropicLanguageModel(AnalysisOptions options, HttpClient? http = null) : ILanguageModel
{
    public const string DefaultModel = "claude-opus-5-5";

    private readonly AnthropicClient _client = CreateClient(options, http);

    private static AnthropicClient CreateClient(AnalysisOptions options, HttpClient? http)
    {
        // Without a key in the settings the SDK resolves ANTHROPIC_API_KEY (or a profile) itself.
        if (http is null)
        {
            return string.IsNullOrEmpty(options.ApiKey) ? new AnthropicClient() : new AnthropicClient { ApiKey = options.ApiKey };
        }

        return string.IsNullOrEmpty(options.ApiKey) ? new AnthropicClient { HttpClient = http } : new AnthropicClient { ApiKey = options.ApiKey, HttpClient = http };
    }

    public string? Provider => "Claude (Anthropic API)";
    public string? ModelName => options.Model ?? DefaultModel;

    public async Task<string> CompleteAsync(string system, string user, CancellationToken cancellationToken)
    {
        var response = await _client.Beta.Messages.Create(new MessageCreateParams
        {
            Model = ModelName!,
            MaxTokens = options.MaxTokens,
            Betas = ["server-side-fallback-2026-07-01"],
            Fallbacks = new Default(),
            System = system,
            Messages = [new BetaUserMessageParam { Content = user }],
        }, cancellationToken);

        if (response.StopReason == "refusal")
        {
            throw new InvalidOperationException("Модель отклонила запрос.");
        }

        return string.Join("\n", response.Content.Select(block => block.Value).OfType<BetaTextBlock>().Select(block => block.Text));
    }
}
