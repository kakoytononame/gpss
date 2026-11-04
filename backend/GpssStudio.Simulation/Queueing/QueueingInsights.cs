using System.Globalization;
using System.Text;
using System.Text.Json.Serialization;

namespace GpssStudio.Simulation.Queueing;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum InsightSeverity
{
    Info,
    Warning,
    Critical,
}

/// <summary>A finding about the system with the numbers behind it (bottleneck, losses, precision, what-if).</summary>
public sealed record QueueingInsight(InsightSeverity Severity, string? NodeId, string Title, string Text);

/// <summary>
/// Deterministic analysis of a queueing system: bottlenecks and stability, losses and impatience, agreement of
/// simulation with theory, precision of the estimates and what-if recommendations (servers needed for a target
/// utilisation, run length for a target precision). Works without any language model; its findings are also the
/// facts a language model is asked to explain.
/// </summary>
public static class QueueingInsights
{
    public const double BottleneckUtilization = 0.85;
    public const double TargetUtilization = 0.8;
    public const double TargetPrecision = 0.05;

    public static IReadOnlyList<QueueingInsight> Analyze(QueueingModel model, QueueingAnalysis analysis, QueueingRunResult? run)
    {
        var insights = new List<QueueingInsight>();
        string F(double value) => value.ToString(Math.Abs(value) >= 100 ? "0" : "0.###", CultureInfo.GetCultureInfo("ru-RU"));
        string P(double value) => $"{F(value * 100)} %";

        double? Simulated(string nodeId, string key) => run?.Nodes.FirstOrDefault(node => node.NodeId == nodeId)?.Metrics.FirstOrDefault(metric => metric.Key == key)?.Mean;

        for (var index = 0; index < model.Nodes.Count; index++)
        {
            var node = model.Nodes[index];
            var result = analysis.Nodes[index];
            var title = QueueingGenerator.Title(node);
            var utilization = result.Metrics.Utilization ?? Simulated(node.Id, "Utilization");

            if (result.Method == "система неустойчива")
            {
                var needed = ServersFor(node, result.Metrics, TargetUtilization);
                insights.Add(new QueueingInsight(InsightSeverity.Critical, node.Id, $"«{title}»: система неустойчива",
                    "Поток заявок превышает производительность каналов, очередь растёт без ограничения, и средние показатели моделирования зависят от длины прогона."
                    + (needed is { } servers ? $" Чтобы загрузка стала не выше {P(TargetUtilization)}, нужно каналов: {servers}." : "")));
                continue;
            }

            if (utilization is { } rho && rho >= BottleneckUtilization && node.Servers > 0)
            {
                var needed = ServersFor(node, result.Metrics, TargetUtilization);
                var wait = result.Metrics.Wq ?? Simulated(node.Id, "Wq");
                insights.Add(new QueueingInsight(rho >= 0.95 ? InsightSeverity.Critical : InsightSeverity.Warning, node.Id, $"«{title}» — узкое место",
                    $"Загрузка канала {P(rho)}" + (wait is { } w ? $", среднее ожидание {F(w)} {model.TimeUnit}" : "")
                    + ". При такой загрузке небольшое увеличение потока резко удлиняет очередь."
                    + (needed is { } servers && servers > node.Servers ? $" Для загрузки не выше {P(TargetUtilization)} нужно каналов: {servers} (сейчас {node.Servers})." : "")));
            }

            void Share(string key, double threshold, string what, string advice)
            {
                var value = AnalyticOrSimulated(result.Metrics, key) ?? Simulated(node.Id, key);
                if (value is { } share && share >= threshold)
                {
                    insights.Add(new QueueingInsight(share >= 0.2 ? InsightSeverity.Critical : InsightSeverity.Warning, node.Id, $"«{title}»: {what} {P(share)}", advice));
                }
            }

            Share("LossProbability", 0.05, "отказы", "Заявки теряются из-за нехватки мест: увеличьте ёмкость узла или число каналов.");
            Share("RenegeProbability", 0.05, "уходят из очереди", "Клиенты не дожидаются обслуживания: сократите ожидание (больше каналов, приоритеты) или увеличьте терпение.");
            Share("BalkProbability", 0.1, "не встают в очередь", "Длинная очередь отпугивает клиентов; сокращение очереди вернёт часть потока.");

            if (result.Quality == AnalysisQuality.Approximate)
            {
                insights.Add(new QueueingInsight(InsightSeverity.Info, node.Id, $"«{title}»: формула приближённая",
                    $"{result.Method}. Для точной оценки опирайтесь на моделирование."));
            }
        }

        if (run is not null)
        {
            foreach (var node in run.Nodes)
            {
                var exact = node.Analysis.Quality == AnalysisQuality.Exact;
                foreach (var metric in node.Metrics)
                {
                    if (exact && metric.Agrees == false && metric.Deviation is { } deviation && Math.Abs(deviation) > 0.1)
                    {
                        insights.Add(new QueueingInsight(InsightSeverity.Warning, node.NodeId, $"«{node.Name}»: {metric.Label.ToLower(CultureInfo.GetCultureInfo("ru-RU"))} расходится с теорией на {P(Math.Abs(deviation))}",
                            "Для этого узла формула точная, поэтому расхождение обычно означает слишком короткий прогон или разгон. Увеличьте длительность и число прогонов."));
                    }
                }

                var precision = node.Metrics.FirstOrDefault(metric => metric.Key == "W");
                if (precision is { Mean: > 0, HalfWidth: { } halfWidth } && halfWidth / precision.Mean!.Value > 0.1)
                {
                    var relative = halfWidth / precision.Mean.Value;
                    var factor = Math.Ceiling(Math.Pow(relative / TargetPrecision, 2));
                    insights.Add(new QueueingInsight(InsightSeverity.Info, node.NodeId, $"«{node.Name}»: оценка времени пребывания неточна (± {P(relative)})",
                        $"Чтобы сузить 95 % интервал до ± {P(TargetPrecision)}, увеличьте общее модельное время (длительность × число прогонов) примерно в {F(factor)} раз."));
                }
            }
        }

        var slowest = analysis.Classes.Where(item => item.ResponseTime is not null).MaxBy(item => item.ResponseTime);
        if (analysis.Classes.Count > 1 && slowest is not null)
        {
            insights.Add(new QueueingInsight(InsightSeverity.Info, null, $"Дольше всех в системе — класс «{slowest.Name}»",
                $"Среднее время пребывания {F(slowest.ResponseTime!.Value)} {model.TimeUnit}."));
        }

        if (insights.All(insight => insight.Severity == InsightSeverity.Info))
        {
            insights.Insert(0, new QueueingInsight(InsightSeverity.Info, null, "Система работает с запасом",
                $"Загрузка всех узлов ниже {P(BottleneckUtilization)}, существенных потерь заявок нет."));
        }

        return insights.OrderByDescending(insight => insight.Severity).ToList();
    }

    private static double? AnalyticOrSimulated(QueueingMetrics metrics, string key) => key switch
    {
        "LossProbability" => metrics.LossProbability,
        "RenegeProbability" => metrics.RenegeProbability,
        "BalkProbability" => metrics.BalkProbability,
        _ => null,
    };

    /// <summary>Smallest number of servers that keeps the utilisation at or below the target (offered load / target).</summary>
    public static int? ServersFor(QueueingNode node, QueueingMetrics metrics, double target)
    {
        if (node.Servers == 0 || metrics.ArrivalRate is not { } lambda || lambda <= 0)
        {
            return null;
        }

        var offered = lambda * DistributionMath.Mean(node.Service);
        return Math.Max(1, (int)Math.Ceiling(offered / target - 1e-9));
    }

    /// <summary>Compact Russian description of the system, the findings and the measures for a language model.</summary>
    public static string Prompt(QueueingModel model, QueueingAnalysis analysis, QueueingRunResult? run, IReadOnlyList<QueueingInsight> insights)
    {
        var text = new StringBuilder();
        var culture = CultureInfo.InvariantCulture;
        text.AppendLine($"Система массового обслуживания «{model.Name}». Единица времени: {model.TimeUnit}. Метод расчёта: {analysis.Network}.");
        foreach (var customerClass in model.Classes)
        {
            text.AppendLine(customerClass.Kind == CustomerClassKind.Open
                ? $"- Класс «{QueueingGenerator.Title(customerClass)}»: поток, интервал — {DistributionMath.Describe(customerClass.Arrival!)}, приоритет {customerClass.Priority}."
                : $"- Класс «{QueueingGenerator.Title(customerClass)}»: замкнутый, {customerClass.Population} заявок.");
        }

        for (var index = 0; index < model.Nodes.Count; index++)
        {
            var node = model.Nodes[index];
            var result = analysis.Nodes[index];
            text.AppendLine($"- Узел «{QueueingGenerator.Title(node)}» {result.Kendall}, {result.Discipline}, обслуживание — {DistributionMath.Describe(node.Service)}; теория: {result.Method} ({result.Quality}).");
            var metrics = run?.Nodes[index].Metrics;
            if (metrics is not null)
            {
                foreach (var metric in metrics.Where(metric => metric.Mean is not null))
                {
                    text.AppendLine(string.Create(culture, $"    {metric.Label}: моделирование {metric.Mean:0.####} ± {metric.HalfWidth:0.####}{(metric.Analytic is { } a ? $", теория {a:0.####}" : "")}"));
                }
            }
            else
            {
                var m = result.Metrics;
                text.AppendLine(string.Create(culture, $"    теория: ρ={m.Utilization:0.###}, L={m.L:0.###}, Lq={m.Lq:0.###}, W={m.W:0.###}, Wq={m.Wq:0.###}, отказы={m.LossProbability:0.###}"));
            }
        }

        text.AppendLine("Найденные факты:");
        foreach (var insight in insights)
        {
            text.AppendLine($"- [{insight.Severity}] {insight.Title}. {insight.Text}");
        }

        return text.ToString();
    }
}
