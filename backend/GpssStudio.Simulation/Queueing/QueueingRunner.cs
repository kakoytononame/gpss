using System.Diagnostics;
using GpssStudio.Simulation.Experiments;
using GpssStudio.Simulation.Runtime;

namespace GpssStudio.Simulation.Queueing;

/// <summary>A measure compared between queueing theory and simulation.</summary>
public sealed class MetricComparison
{
    public required string Key { get; init; }
    public required string Label { get; init; }
    public double? Analytic { get; init; }

    /// <summary>Mean over the replications.</summary>
    public double? Mean { get; init; }

    /// <summary>Half-width of the 95 % confidence interval (Student).</summary>
    public double? HalfWidth { get; init; }

    /// <summary>(simulation − theory) / theory.</summary>
    public double? Deviation { get; init; }

    /// <summary>Theory lies within the confidence interval (with a 2 % allowance); null without a theoretical value.</summary>
    public bool? Agrees { get; init; }
}

public sealed class NodeRunResult
{
    public required string NodeId { get; init; }
    public required string Name { get; init; }
    public required string GpssName { get; init; }
    public required NodeAnalysis Analysis { get; init; }
    public required IReadOnlyList<MetricComparison> Metrics { get; init; }
}

public sealed class ClassRunResult
{
    public required string ClassId { get; init; }
    public required string Name { get; init; }
    public required AnalysisQuality Quality { get; init; }
    public required IReadOnlyList<MetricComparison> Metrics { get; init; }
}

public sealed class QueueingRunResult
{
    public required string ModelText { get; init; }
    public required QueueingAnalysis Analysis { get; init; }
    public required IReadOnlyList<NodeRunResult> Nodes { get; init; }
    public required IReadOnlyList<ClassRunResult> Classes { get; init; }
    public int Replications { get; init; }
    public double ElapsedSeconds { get; init; }
    public IReadOnlyList<string> Messages { get; init; } = [];
}

/// <summary>Model text, theory and the measures of independent simulation replications side by side.</summary>
public static class QueueingRunner
{
    public static readonly TimeSpan TimeLimit = TimeSpan.FromSeconds(90);
    private const long MaxBlockEntriesPerRun = 30_000_000;

    public static readonly IReadOnlyDictionary<string, string> NodeMetricLabels = new Dictionary<string, string>
    {
        ["ArrivalRate"] = "Интенсивность поступления λ",
        ["Throughput"] = "Обслужено в единицу времени",
        ["Utilization"] = "Загрузка канала ρ",
        ["BusyServers"] = "Среднее число занятых каналов",
        ["L"] = "Среднее число заявок в узле L",
        ["Lq"] = "Средняя длина очереди Lq",
        ["W"] = "Среднее время пребывания W",
        ["Wq"] = "Среднее время ожидания Wq",
        ["LossProbability"] = "Вероятность отказа (нет мест)",
        ["BalkProbability"] = "Доля не вставших в очередь",
        ["RenegeProbability"] = "Доля ушедших из очереди",
        ["OrbitSize"] = "Среднее число заявок на орбите",
        ["OrbitTime"] = "Время на орбите на одну заявку",
        ["DownFraction"] = "Доля времени восстановления",
        ["VacationFraction"] = "Доля времени отпусков",
        ["MaxQueue"] = "Максимальная длина очереди",
    };

    public static readonly IReadOnlyDictionary<string, string> ClassMetricLabels = new Dictionary<string, string>
    {
        ["Throughput"] = "Обслужено заявок в единицу времени",
        ["ResponseTime"] = "Среднее время пребывания обслуженной заявки",
        ["InSystem"] = "Среднее число заявок класса в системе",
        ["LossProbability"] = "Доля потерянных заявок",
    };

    public static QueueingRunResult Run(QueueingModel model, CancellationToken cancellationToken = default)
    {
        var generated = QueueingGenerator.Generate(model);
        var analysis = QueueingAnalytics.Analyze(model);
        var stopwatch = Stopwatch.StartNew();
        var messages = new List<string>(generated.Warnings);
        var nodeSamples = model.Nodes.Select(_ => new Dictionary<string, List<double>>()).ToList();
        var classSamples = model.Classes.Select(_ => new Dictionary<string, List<double>>()).ToList();
        var completed = 0;

        for (var replication = 0; replication < model.Replications; replication++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (stopwatch.Elapsed > TimeLimit)
            {
                messages.Add($"Достигнут предел времени ({TimeLimit.TotalSeconds:N0} с): выполнено прогонов {completed} из {model.Replications}.");
                break;
            }

            var run = replication;
            void Prepare(SimulationEngine engine)
            {
                engine.MaxBlockEntries = MaxBlockEntriesPerRun;
                engine.TimeLimit = TimeLimit;
                for (var stream = 1; stream <= Math.Max(1, generated.StreamCount); stream++)
                {
                    engine.SeedRandom(stream, 1_000_003L * model.Seed + 104_729L * run + 7_919L * stream);
                }
            }

            var (session, result) = SimulationSession.Create(generated.Text, model.Name, beforeFirstStart: Prepare);
            if (session is null || !result.Success || result.RuntimeError is not null)
            {
                var reason = result.RuntimeError ?? string.Join("; ", result.Errors.Select(error => error.ToString()));
                if (completed == 0 && replication == model.Replications - 1 || session is null)
                {
                    throw new ArgumentException($"Моделирование не выполнено: {reason}");
                }

                messages.Add($"Прогон {replication + 1}: {reason}");
                continue;
            }

            Collect(model, generated, session.Engine, nodeSamples, classSamples);
            completed++;
        }

        if (completed == 0)
        {
            throw new ArgumentException("Не выполнено ни одного прогона.");
        }

        var nodes = model.Nodes.Select((node, index) => new NodeRunResult
        {
            NodeId = node.Id,
            Name = QueueingGenerator.Title(node),
            GpssName = generated.Nodes[index].Name,
            Analysis = analysis.Nodes[index],
            Metrics = Compare(NodeMetricLabels, nodeSamples[index], key => AnalyticNode(analysis.Nodes[index].Metrics, key)),
        }).ToList();
        var classes = model.Classes.Select((customerClass, index) => new ClassRunResult
        {
            ClassId = customerClass.Id,
            Name = QueueingGenerator.Title(customerClass),
            Quality = analysis.Classes[index].Quality,
            Metrics = Compare(ClassMetricLabels, classSamples[index], key => analysis.Classes[index].Quality == AnalysisQuality.Unavailable ? null : AnalyticClass(analysis.Classes[index], key)),
        }).ToList();

        return new QueueingRunResult
        {
            ModelText = generated.Text,
            Analysis = analysis,
            Nodes = nodes,
            Classes = classes,
            Replications = completed,
            ElapsedSeconds = stopwatch.Elapsed.TotalSeconds,
            Messages = messages,
        };
    }

    private static double? AnalyticNode(QueueingMetrics metrics, string key) => key switch
    {
        "ArrivalRate" => metrics.ArrivalRate,
        "Throughput" => metrics.Throughput,
        "Utilization" => metrics.Utilization,
        "BusyServers" => metrics.BusyServers,
        "L" => metrics.L,
        "Lq" => metrics.Lq,
        "W" => metrics.W,
        "Wq" => metrics.Wq,
        "LossProbability" => metrics.LossProbability,
        "BalkProbability" => metrics.BalkProbability,
        "RenegeProbability" => metrics.RenegeProbability,
        "OrbitSize" => metrics.OrbitSize,
        "OrbitTime" => metrics.OrbitTime,
        "DownFraction" => metrics.DownFraction,
        "VacationFraction" => metrics.VacationFraction,
        _ => null,
    };

    private static double? AnalyticClass(ClassAnalysis analysis, string key) => key switch
    {
        "Throughput" => analysis.Throughput,
        "ResponseTime" => analysis.ResponseTime,
        "InSystem" => analysis.InSystem,
        "LossProbability" => analysis.LossProbability,
        _ => null,
    };

    private static List<MetricComparison> Compare(IReadOnlyDictionary<string, string> labels, Dictionary<string, List<double>> samples, Func<string, double?> analytic)
    {
        var result = new List<MetricComparison>();
        foreach (var (key, label) in labels)
        {
            if (!samples.TryGetValue(key, out var values) || values.Count == 0)
            {
                continue;
            }

            var statistics = ExperimentRunner.Statistics(values);
            var theory = analytic(key);
            double? deviation = theory is { } t && Math.Abs(t) > 1e-12 ? (statistics.Mean - t) / t : null;
            bool? agrees = theory is { } value ? Math.Abs(statistics.Mean - value) <= statistics.ConfidenceHalfWidth + 0.02 * Math.Abs(value) + 1e-6 : null;
            result.Add(new MetricComparison
            {
                Key = key,
                Label = label,
                Analytic = theory,
                Mean = statistics.Mean,
                HalfWidth = statistics.ConfidenceHalfWidth,
                Deviation = deviation,
                Agrees = agrees,
            });
        }

        return result;
    }

    /// <summary>Reads the measures of one replication from the GPSS entities generated for the nodes and classes.</summary>
    private static void Collect(QueueingModel model, GeneratedQueueingModel generated, SimulationEngine engine,
        List<Dictionary<string, List<double>>> nodeSamples, List<Dictionary<string, List<double>>> classSamples)
    {
        var time = engine.RelativeClock;
        double Sna(string family, string name) => engine.Sna(family, name, null);
        double Count(string label) => engine.Model.Labels.ContainsKey(label) ? Sna("N", label) : 0;

        for (var index = 0; index < model.Nodes.Count; index++)
        {
            var node = model.Nodes[index];
            var names = generated.Nodes[index];
            var samples = nodeSamples[index];
            void Add(string key, double value)
            {
                if (double.IsFinite(value))
                {
                    (samples.TryGetValue(key, out var list) ? list : samples[key] = []).Add(value);
                }
            }

            var arrivals = Count(names.ArrivalLabel);
            Add("ArrivalRate", arrivals / time);
            Add("Throughput", Count(names.DoneLabel) / time);
            Add("L", Sna("QA", names.InNode));
            Add("W", Sna("QT", names.InNode));
            if (node.Servers > 0)
            {
                double busy;
                if (names.Implementation == NodeImplementation.PreemptiveFacility)
                {
                    var facility = engine.Facility(names.Server);
                    busy = facility.Busy.Average(engine.AbsoluteClock, facility.IsBusy ? 1 : 0);
                }
                else
                {
                    busy = Sna("SA", names.Server);
                }

                Add("BusyServers", busy);
                Add("Utilization", busy / node.Servers);
                var waiting = Sna("QA", names.Waiting);
                Add("Lq", waiting);
                var acceptedRate = Sna("QC", names.InNode) / time;
                Add("Wq", node.Discipline == QueueDiscipline.RoundRobin ? (acceptedRate > 0 ? waiting / acceptedRate : 0) : Sna("QT", names.Waiting));
                Add("MaxQueue", Sna("QM", names.Waiting));
            }
            else
            {
                Add("BusyServers", Sna("QA", names.InNode));
                Add("MaxQueue", 0);
            }

            if (arrivals > 0)
            {
                if (node.Capacity is not null && node.WhenFull == FullPolicy.Lose)
                {
                    Add("LossProbability", Count(names.LostLabel) / arrivals);
                }

                if (node.Balking != BalkingKind.None)
                {
                    Add("BalkProbability", Count(names.BalkLabel) / arrivals);
                }

                if (node.Patience is not null)
                {
                    Add("RenegeProbability", Count(names.RenegeLabel) / arrivals);
                }

                if (node.WhenFull == FullPolicy.Retry)
                {
                    var orbit = Sna("QA", names.Orbit);
                    Add("OrbitSize", orbit);
                    Add("OrbitTime", orbit / (arrivals / time));
                }
            }

            if (node.TimeToFailure is not null)
            {
                Add("DownFraction", Sna("QA", names.Down));
            }

            if (node.Vacation is not null)
            {
                Add("VacationFraction", Sna("QA", names.OnVacation));
            }
        }

        for (var index = 0; index < model.Classes.Count; index++)
        {
            var names = generated.Classes[index];
            var samples = classSamples[index];
            void Add(string key, double value)
            {
                if (double.IsFinite(value))
                {
                    (samples.TryGetValue(key, out var list) ? list : samples[key] = []).Add(value);
                }
            }

            var done = Count(names.DoneLabel);
            var lost = Count(names.LostLabel);
            Add("Throughput", done / time);
            if (Sna("TC", names.ResponseTable) > 0)
            {
                Add("ResponseTime", Sna("TB", names.ResponseTable));
            }

            Add("InSystem", Sna("QA", names.InSystem));
            if (done + lost > 0)
            {
                Add("LossProbability", lost / (done + lost));
            }
        }
    }
}
