using GpssStudio.Simulation.Queueing;

namespace GpssStudio.WebApi.Application.Analysis;

public sealed record QueueingAnalysisRequest(QueueingModel Model, QueueingRunResult? Run, bool Explain = true);

public sealed record QueueingAnalysisResponse(
    IReadOnlyList<QueueingInsight> Findings,
    string? Explanation,
    string? Provider,
    string? ModelName,
    string? Error);

public sealed record AnalysisStatus(bool Available, string? Provider, string? ModelName);

/// <summary>
/// Analysis of queueing results in two layers: deterministic findings (always), then — when a language model is
/// configured — a short explanation in Russian written strictly from those findings and measures.
/// </summary>
public sealed class ResultAnalysisService(ILanguageModel languageModel, ILogger<ResultAnalysisService> logger)
{
    public const string SystemPrompt = """
        Ты — специалист по теории массового обслуживания и имитационному моделированию на GPSS.
        Тебе даны описание системы, результаты теории и моделирования и найденные факты.
        Объясни результаты по-русски для студента или инженера, кратко (до 250 слов), разделами:
        1. Главное — как работает система в целом.
        2. Узкие места и причины.
        3. Что изменить — конкретные шаги с числами только из приведённых данных.
        4. Насколько можно доверять результатам (точные формулы, приближения, доверительные интервалы).
        Не придумывай чисел и фактов, которых нет в данных. Если данных мало, так и скажи.
        """;

    public AnalysisStatus Status() => new(languageModel.Provider is not null, languageModel.Provider, languageModel.ModelName);

    public async Task<QueueingAnalysisResponse> AnalyzeAsync(QueueingAnalysisRequest request, CancellationToken cancellationToken)
    {
        var analysis = request.Run?.Analysis ?? QueueingAnalytics.Analyze(request.Model);
        var findings = QueueingInsights.Analyze(request.Model, analysis, request.Run);
        if (!request.Explain || languageModel.Provider is null)
        {
            return new QueueingAnalysisResponse(findings, null, languageModel.Provider, languageModel.ModelName, null);
        }

        try
        {
            var prompt = QueueingInsights.Prompt(request.Model, analysis, request.Run, findings);
            var explanation = await languageModel.CompleteAsync(SystemPrompt, prompt, cancellationToken);
            return new QueueingAnalysisResponse(findings, explanation.Trim(), languageModel.Provider, languageModel.ModelName, null);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // The findings stay useful when the model is unreachable.
            logger.LogWarning(exception, "Language model {Provider} failed", languageModel.Provider);
            return new QueueingAnalysisResponse(findings, null, languageModel.Provider, languageModel.ModelName, $"Языковая модель недоступна: {exception.Message}");
        }
    }
}
