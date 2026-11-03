using System.Globalization;
using System.Text.Json.Serialization;

namespace GpssStudio.Simulation.Queueing;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AnalysisQuality
{
    /// <summary>Exact result of queueing theory (simulation must agree within its confidence interval).</summary>
    Exact,

    /// <summary>Standard approximation; deviations of several percent are expected.</summary>
    Approximate,

    /// <summary>No analytical solution for this combination of features: simulation only.</summary>
    Unavailable,
}

/// <summary>Performance measures of a node; null where the measure does not apply or is unknown.</summary>
public sealed class QueueingMetrics
{
    /// <summary>Arrivals per time unit (offered, before losses).</summary>
    public double? ArrivalRate { get; set; }

    /// <summary>Completed services per time unit.</summary>
    public double? Throughput { get; set; }

    /// <summary>Utilisation of one server.</summary>
    public double? Utilization { get; set; }

    /// <summary>Mean number of busy servers.</summary>
    public double? BusyServers { get; set; }

    /// <summary>Mean number of customers at the node (waiting and in service).</summary>
    public double? L { get; set; }

    /// <summary>Mean number of waiting customers.</summary>
    public double? Lq { get; set; }

    /// <summary>Mean time at the node of an accepted customer.</summary>
    public double? W { get; set; }

    /// <summary>Mean waiting time of an accepted customer.</summary>
    public double? Wq { get; set; }

    public double? LossProbability { get; set; }
    public double? BalkProbability { get; set; }
    public double? RenegeProbability { get; set; }

    /// <summary>Mean number of customers in the orbit (retrials).</summary>
    public double? OrbitSize { get; set; }

    /// <summary>Mean time in the orbit per arriving customer.</summary>
    public double? OrbitTime { get; set; }

    /// <summary>Fraction of time the station is under repair.</summary>
    public double? DownFraction { get; set; }

    /// <summary>Fraction of time the server is on vacation.</summary>
    public double? VacationFraction { get; set; }
}

public sealed class NodeAnalysis
{
    public required string NodeId { get; init; }
    public required string Name { get; init; }

    /// <summary>Kendall notation A/B/c/K/N (+ patience).</summary>
    public required string Kendall { get; init; }

    public required string Discipline { get; init; }
    public AnalysisQuality Quality { get; set; }
    public string Method { get; set; } = string.Empty;
    public List<string> Notes { get; } = [];
    public QueueingMetrics Metrics { get; set; } = new();
}

public sealed class ClassAnalysis
{
    public required string ClassId { get; init; }
    public required string Name { get; init; }
    public AnalysisQuality Quality { get; set; }
    public double? Throughput { get; set; }

    /// <summary>Mean time in the system of a served customer (one cycle for a closed class).</summary>
    public double? ResponseTime { get; set; }

    /// <summary>Mean number of customers of the class in the system.</summary>
    public double? InSystem { get; set; }

    public double? LossProbability { get; set; }
}

public sealed class QueueingAnalysis
{
    public required IReadOnlyList<NodeAnalysis> Nodes { get; init; }
    public required IReadOnlyList<ClassAnalysis> Classes { get; init; }

    /// <summary>How the network was decomposed (Jackson, QNA, MVA, ...).</summary>
    public string Network { get; set; } = string.Empty;

    public List<string> Messages { get; } = [];
}

/// <summary>
/// Analytical solution of a <see cref="QueueingModel"/>: exact results where queueing theory has them
/// (birth–death processes: M/M/c/K with balking, reneging and finite sources; Erlang B and C; Pollaczek–Khinchine
/// with vacations, batches, priorities (Cobham, preemptive resume) and SPT; GI/M/1; M/G/1/K; M/G/1 retrial;
/// M/G/∞; Jackson networks; exact mean value analysis of closed networks) and standard approximations otherwise
/// (Allen–Cunneen / Kingman with QNA traffic variability, exponential approximations of finite systems).
/// </summary>
public static class QueueingAnalytics
{
    private const int SjfSamples = 200_000;

    public static QueueingAnalysis Analyze(QueueingModel model)
    {
        var errors = QueueingGenerator.Validate(model);
        if (errors.Count > 0)
        {
            throw new ArgumentException(string.Join(" ", errors));
        }

        var open = model.Classes.Where(c => c.Kind == CustomerClassKind.Open).ToList();
        var closed = model.Classes.Where(c => c.Kind == CustomerClassKind.Closed).ToList();
        var context = new Context(model);

        if (closed.Count > 0 && open.Count > 0)
        {
            return Sanitize(context.Unavailable("Смешанная сеть (открытые и замкнутые классы): аналитическое решение не вычисляется, только моделирование."));
        }

        if (closed.Count > 1)
        {
            return context.Unavailable("Несколько замкнутых классов: многоклассовый анализ средних значений не реализован, только моделирование.");
        }

        return Sanitize(closed.Count == 1 ? context.AnalyzeClosed(closed[0]) : context.AnalyzeOpen());
    }

    /// <summary>Infinite or undefined values (unstable systems) are reported as missing.</summary>
    private static QueueingAnalysis Sanitize(QueueingAnalysis analysis)
    {
        static void Clean(object target)
        {
            foreach (var property in target.GetType().GetProperties().Where(property => property.PropertyType == typeof(double?) && property.CanWrite))
            {
                if (property.GetValue(target) is double value && !double.IsFinite(value))
                {
                    property.SetValue(target, null);
                }
            }
        }

        foreach (var node in analysis.Nodes)
        {
            Clean(node.Metrics);
        }

        foreach (var customerClass in analysis.Classes)
        {
            Clean(customerClass);
        }

        return analysis;
    }

    // ===================================================================== shared state

    private sealed class Context(QueueingModel model)
    {
        public QueueingModel Model { get; } = model;
        public int N => Model.Nodes.Count;
        public int Index(string id) => Model.Nodes.ToList().FindIndex(node => node.Id == id);

        public Distribution ServiceOf(int node, CustomerClass customerClass) =>
            customerClass.Services.FirstOrDefault(service => service.Node == Model.Nodes[node].Id)?.Service ?? Model.Nodes[node].Service;

        public double Route(int from, int to) => Model.Nodes[from].Routes.Where(route => route.Target == Model.Nodes[to].Id).Sum(route => route.Probability);

        public NodeAnalysis NewNode(int index, string kendall) => new()
        {
            NodeId = Model.Nodes[index].Id,
            Name = QueueingGenerator.Title(Model.Nodes[index]),
            Kendall = kendall,
            Discipline = QueueingGenerator.DisciplineLabel(Model.Nodes[index]),
        };

        public QueueingAnalysis Unavailable(string message)
        {
            var analysis = new QueueingAnalysis
            {
                Nodes = Model.Nodes.Select((node, index) =>
                {
                    var result = NewNode(index, KendallGeneric(index));
                    result.Quality = AnalysisQuality.Unavailable;
                    result.Method = "только моделирование";
                    AddExactSideMeasures(index, result.Metrics);
                    return result;
                }).ToList(),
                Classes = Model.Classes.Select(c => new ClassAnalysis { ClassId = c.Id, Name = QueueingGenerator.Title(c), Quality = AnalysisQuality.Unavailable }).ToList(),
                Network = "не применяется",
            };
            analysis.Messages.Add(message);
            return analysis;
        }

        private string KendallGeneric(int index)
        {
            var node = Model.Nodes[index];
            var services = Model.Classes.Select(c => ServiceOf(index, c)).ToList();
            var service = services.Select(DistributionMath.Code).Distinct().Count() == 1 ? DistributionMath.Code(services[0]) : "G";
            return Kendall("G", service, node, null);
        }

        public static string Kendall(string arrival, string service, QueueingNode node, int? population)
        {
            var text = $"{arrival}/{service}/{(node.Servers == 0 ? "∞" : node.Servers.ToString(CultureInfo.InvariantCulture))}";
            if (node.Capacity is { } capacity)
            {
                text += $"/{capacity}";
            }

            if (population is { } n)
            {
                text += node.Capacity is null ? $"//{n}" : $"/{n}";
            }

            if (node.Patience is not null)
            {
                text += $"+{DistributionMath.Code(node.Patience)}";
            }

            return text;
        }

        /// <summary>Repair and vacation fractions do not depend on the load (failures happen in calendar time).</summary>
        public void AddExactSideMeasures(int index, QueueingMetrics metrics)
        {
            var node = Model.Nodes[index];
            if (node.TimeToFailure is not null)
            {
                var up = DistributionMath.Mean(node.TimeToFailure);
                var down = DistributionMath.Mean(node.Repair!);
                metrics.DownFraction = down / (up + down);
            }
        }

        /// <summary>Solves v = e + vP for the visits of a customer entering at <paramref name="entry"/>, with routing thinned by the served fractions.</summary>
        public double[] Visits(int entry, IReadOnlyList<double> served)
        {
            var system = new double[N, N + 1];
            for (var j = 0; j < N; j++)
            {
                for (var i = 0; i < N; i++)
                {
                    system[j, i] = (i == j ? 1 : 0) - served[i] * Route(i, j);
                }

                system[j, N] = j == entry ? 1 : 0;
            }

            return QueueingFormulas.Solve(system, N);
        }

        // ================================================================= open networks

        public QueueingAnalysis AnalyzeOpen()
        {
            var classes = Model.Classes;
            var rates = classes.Select(c => 1 / DistributionMath.Mean(c.Arrival!) * (c.Batch is null ? 1 : DistributionMath.Moments(c.Batch).Mean)).ToArray();
            var poissonSources = classes.All(c => DistributionMath.IsExponential(c.Arrival!) && IsSingle(c.Batch));
            var jackson = poissonSources && Enumerable.Range(0, N).All(PreservesPoisson);
            var internalInflow = Enumerable.Range(0, N).Select(j => Enumerable.Range(0, N).Any(i => Route(i, j) > 0)).ToArray();

            var served = Enumerable.Repeat(1.0, N).ToArray();
            var arrivalScv = Enumerable.Repeat(1.0, N).ToArray();
            NodeResult[] results = [];
            double[][] flows = [];
            for (var iteration = 0; iteration < 200; iteration++)
            {
                flows = classes.Select((c, k) => Visits(Index(c.Entry), served).Select(v => v * rates[k]).ToArray()).ToArray();
                results = Enumerable.Range(0, N).Select(j => SolveOpenNode(j, flows, rates, arrivalScv[j], jackson, internalInflow[j])).ToArray();

                // QNA: squared coefficients of variation of the arrival streams.
                var nextScv = new double[N];
                for (var j = 0; j < N; j++)
                {
                    var total = flows.Sum(flow => flow[j]);
                    if (total <= 0)
                    {
                        nextScv[j] = 1;
                        continue;
                    }

                    var weighted = 0.0;
                    for (var k = 0; k < classes.Count; k++)
                    {
                        if (Index(classes[k].Entry) == j)
                        {
                            weighted += rates[k] * ExternalScv(classes[k]);
                        }
                    }

                    for (var i = 0; i < N; i++)
                    {
                        var p = Route(i, j);
                        if (p <= 0)
                        {
                            continue;
                        }

                        var flow = flows.Sum(f => f[i]) * results[i].Served * p;
                        weighted += flow * (p * results[i].DepartureScv + 1 - p);
                    }

                    nextScv[j] = weighted / total;
                }

                var nextServed = results.Select(result => result.Served).ToArray();
                var change = Enumerable.Range(0, N).Max(j => Math.Abs(nextServed[j] - served[j]) + Math.Abs(nextScv[j] - arrivalScv[j]));
                served = nextServed;
                arrivalScv = nextScv;
                if (change < 1e-12)
                {
                    break;
                }
            }

            var multiNodeLosses = N > 1 && results.Any(result => result.Served < 1 - 1e-12) && Enumerable.Range(0, N).Count(j => flows.Sum(f => f[j]) > 0) > 1;
            var analysis = new QueueingAnalysis
            {
                Nodes = results.Select(result => result.Analysis).ToList(),
                Classes = classes.Select((c, k) => OpenClass(c, k, rates[k], flows[k], results, multiNodeLosses)).ToList(),
                Network = N == 1 ? "одиночная СМО"
                    : jackson ? "сеть Джексона: узлы независимы, потоки в узлах пуассоновские (точное решение)"
                    : "декомпозиция сети (QNA Уитта): узлы рассчитываются по отдельности с коэффициентами вариации входящих потоков",
            };
            if (multiNodeLosses)
            {
                analysis.Messages.Add("Потери заявок в сети: потоки после узлов с отказами рассчитаны приближённо (прореживание потока).");
            }

            return analysis;
        }

        private static bool IsSingle(BatchSize? batch) => batch is null || (batch.Kind == BatchKind.Fixed && batch.Size == 1);

        private static double ExternalScv(CustomerClass c)
        {
            var scv = DistributionMath.Scv(c.Arrival!);
            if (c.Batch is null || IsSingle(c.Batch))
            {
                return scv;
            }

            var (mean, second) = DistributionMath.Moments(c.Batch);
            return scv + (second - mean) / mean;
        }

        /// <summary>The output of the node is Poisson for Poisson input (Burke, M/G/∞) and the node keeps product form.</summary>
        private bool PreservesPoisson(int index)
        {
            var node = Model.Nodes[index];
            if (node.Servers == 0)
            {
                return node.Capacity is null;
            }

            var services = Model.Classes.Select(c => ServiceOf(index, c)).ToList();
            return services.All(DistributionMath.IsExponential) && services.Select(s => s.Mean).Distinct().Count() == 1
                && node.Capacity is null && node.Patience is null && node.Balking == BalkingKind.None && node.Vacation is null && node.TimeToFailure is null
                && node.Discipline != QueueDiscipline.ShortestJob;
        }

        private sealed class NodeResult
        {
            public required NodeAnalysis Analysis { get; init; }

            /// <summary>Fraction of the arrivals that are served (not lost, balked or reneged).</summary>
            public double Served { get; set; } = 1;

            public double DepartureScv { get; set; } = 1;

            /// <summary>Mean time at the node by class (accepted customers).</summary>
            public double[] ClassTime { get; set; } = [];

            public bool Reneging { get; set; }
        }

        /// <summary>Per-class inputs of a node.</summary>
        private sealed record ClassFlow(int Class, double Rate, double Mean, double Second, Distribution Service, int Priority);

        private NodeResult SolveOpenNode(int index, double[][] flows, double[] rates, double arrivalScv, bool jackson, bool internalInflow)
        {
            var node = Model.Nodes[index];
            var classes = Model.Classes;
            var inputs = classes.Select((c, k) => new ClassFlow(k, flows[k][index], DistributionMath.Mean(ServiceOf(index, c)), DistributionMath.SecondMoment(ServiceOf(index, c)), ServiceOf(index, c), c.Priority))
                .Where(input => input.Rate > 0).ToList();
            var external = classes.Select((c, k) => (c, k)).Where(item => Index(item.c.Entry) == index).ToList();
            var single = !internalInflow && external.Count == 1 ? external[0].c : null;

            var arrival = single is not null
                ? DistributionMath.Code(single.Arrival!) + (IsSingle(single.Batch) ? "" : "^X")
                : jackson || (!internalInflow && external.All(item => DistributionMath.IsExponential(item.c.Arrival!) && IsSingle(item.c.Batch))) ? "M" : "G";
            var serviceCode = inputs.Select(input => DistributionMath.Code(input.Service)).Distinct().Count() == 1 && inputs.Count > 0
                ? DistributionMath.Code(inputs[0].Service) : "G";
            var analysis = NewNode(index, Kendall(arrival, serviceCode, node, null));
            var result = new NodeResult { Analysis = analysis, ClassTime = new double[classes.Count] };

            var lambda = inputs.Sum(input => input.Rate);
            analysis.Metrics.ArrivalRate = lambda;
            AddExactSideMeasures(index, analysis.Metrics);
            if (lambda <= 0)
            {
                analysis.Quality = AnalysisQuality.Exact;
                analysis.Method = "в узел заявки не поступают";
                analysis.Metrics = new QueueingMetrics { ArrivalRate = 0, Throughput = 0, L = 0, Lq = 0, Utilization = node.Servers > 0 ? 0 : null };
                return result;
            }

            var poisson = jackson || (!internalInflow && external.All(item => DistributionMath.IsExponential(item.c.Arrival!) && IsSingle(item.c.Batch)));
            var batch = single is not null && !IsSingle(single.Batch) && DistributionMath.IsExponential(single.Arrival!) ? single.Batch : null;
            var input = new NodeInput(node, inputs, lambda, arrivalScv, poisson, batch, single is not null && IsSingle(single.Batch) ? single.Arrival : null);
            SolveNode(input, result);
            result.Reneging = node.Patience is not null;
            return result;
        }

        private ClassAnalysis OpenClass(CustomerClass c, int k, double rate, double[] flow, NodeResult[] results, bool multiNodeLosses)
        {
            var analysis = new ClassAnalysis { ClassId = c.Id, Name = QueueingGenerator.Title(c) };
            if (results.Any(result => result.Analysis.Quality == AnalysisQuality.Unavailable && flow[Array.IndexOf(results, result)] > 0))
            {
                analysis.Quality = AnalysisQuality.Unavailable;
                return analysis;
            }

            var throughput = 0.0;
            var timeWeighted = 0.0;
            var inSystem = 0.0;
            for (var j = 0; j < N; j++)
            {
                if (flow[j] <= 0)
                {
                    continue;
                }

                var accepted = flow[j] * results[j].Served + flow[j] * (results[j].Analysis.Metrics.RenegeProbability ?? 0);
                throughput += flow[j] * results[j].Served * QueueingGenerator.ExitProbability(Model.Nodes[j]);
                timeWeighted += flow[j] * results[j].Served * results[j].ClassTime[k];
                inSystem += accepted * results[j].ClassTime[k] + flow[j] * (results[j].Analysis.Metrics.OrbitTime ?? 0);
            }

            analysis.Throughput = throughput;
            analysis.LossProbability = Math.Max(0, 1 - throughput / rate);
            analysis.InSystem = inSystem;
            var reneging = results.Where((result, j) => flow[j] > 0).Any(result => result.Reneging);
            analysis.ResponseTime = reneging || throughput <= 0 ? null : (timeWeighted + flow.Select((f, j) => f * (results[j].Analysis.Metrics.OrbitTime ?? 0)).Sum()) / throughput;
            var quality = results.Where((result, j) => flow[j] > 0).Select(result => result.Analysis.Quality).Max();
            analysis.Quality = multiNodeLosses && quality == AnalysisQuality.Exact ? AnalysisQuality.Approximate : quality;
            if (reneging)
            {
                analysis.InSystem = inSystem;
            }

            return analysis;
        }

        // ================================================================= single node

        private sealed record NodeInput(
            QueueingNode Node,
            IReadOnlyList<ClassFlow> Classes,
            double Lambda,
            double ArrivalScv,
            bool Poisson,
            BatchSize? Batch,
            Distribution? RenewalArrival);

        private void SolveNode(NodeInput input, NodeResult result)
        {
            var node = input.Node;
            var a = result.Analysis;
            var m = a.Metrics;
            var lambda = input.Lambda;
            var es = input.Classes.Sum(c => c.Rate * c.Mean) / lambda;
            var es2 = input.Classes.Sum(c => c.Rate * c.Second) / lambda;
            var cs2 = Math.Max(0, es2 / (es * es) - 1);
            var exponential = input.Classes.All(c => DistributionMath.IsExponential(c.Service)) && input.Classes.Select(c => c.Mean).Distinct().Count() == 1;
            var c = node.Servers;
            var levels = input.Classes.Select(x => x.Priority).Distinct().Count();
            var priority = node.Discipline is QueueDiscipline.Priority or QueueDiscipline.PreemptivePriority && levels > 1;
            var plain = node.Capacity is null && node.Patience is null && node.Balking == BalkingKind.None;
            var rho = c > 0 ? lambda * es / c : 0;

            void SetClassTimes(Func<ClassFlow, double> time)
            {
                foreach (var flow in input.Classes)
                {
                    result.ClassTime[flow.Class] = time(flow);
                }
            }

            void FinishFromWaiting(double wq, AnalysisQuality quality, string method)
            {
                a.Quality = quality;
                a.Method = method;
                m.Wq = wq;
                m.W = wq + es;
                m.Lq = lambda * wq;
                m.L = lambda * (wq + es);
                m.Throughput = lambda;
                m.BusyServers = lambda * es;
                m.Utilization = c > 0 ? rho : null;
                m.LossProbability = node.Capacity is null ? null : 0;
                SetClassTimes(flow => wq + flow.Mean);
                result.DepartureScv = c > 0 ? 1 + (1 - rho * rho) * (input.ArrivalScv - 1) + rho * rho * (cs2 - 1) / Math.Sqrt(c) : 1;
            }

            bool Unstable()
            {
                if (c > 0 && plain && rho >= 1)
                {
                    a.Quality = AnalysisQuality.Unavailable;
                    a.Method = "система неустойчива";
                    a.Notes.Add($"Загрузка канала ρ = {DistributionMath.Format(Math.Round(rho, 4))} ≥ 1: очередь растёт неограниченно, стационарного режима нет.");
                    m.Utilization = 1;
                    m.Throughput = c / es;
                    return true;
                }

                return false;
            }

            // --- failures: queue measures depend on the interaction of failures with the load.
            if (node.TimeToFailure is not null)
            {
                var up = DistributionMath.Mean(node.TimeToFailure);
                var down = DistributionMath.Mean(node.Repair!);
                a.Quality = AnalysisQuality.Unavailable;
                a.Method = "отказы прибора: только моделирование";
                a.Notes.Add($"Коэффициент готовности A = {DistributionMath.Format(Math.Round(up / (up + down), 4))} — точное значение (отказы происходят по календарному времени).");
                if (c > 0 && lambda * es >= c * up / (up + down))
                {
                    a.Notes.Add("Нагрузка превышает производительность с учётом простоев: система неустойчива.");
                }

                return;
            }

            // --- unlimited servers.
            if (c == 0 && node.Capacity is null)
            {
                a.Quality = AnalysisQuality.Exact;
                a.Method = "M/G/∞: L = λ·E[S] (не зависит от распределений)";
                m.L = lambda * es;
                m.W = es;
                m.Lq = 0;
                m.Wq = 0;
                m.Throughput = lambda;
                m.BusyServers = lambda * es;
                SetClassTimes(flow => flow.Mean);
                result.DepartureScv = input.Poisson ? 1 : input.ArrivalScv;
                return;
            }

            var servers = c == 0 ? node.Capacity!.Value : c;

            // --- retrial queue M/G/1 with an orbit.
            if (node.WhenFull == FullPolicy.Retry)
            {
                if (servers == 1 && node.Capacity == 1 && input.Poisson && input.Batch is null && node.Patience is null && node.Vacation is null)
                {
                    if (lambda * es >= 1)
                    {
                        MarkUnstable(lambda * es);
                        return;
                    }

                    var theta = 1 / DistributionMath.Mean(node.Retrial!);
                    var r = lambda * es;
                    var orbit = lambda * lambda * es2 / (2 * (1 - r)) + lambda * r / (theta * (1 - r));
                    a.Quality = DistributionMath.IsExponential(node.Retrial!) ? AnalysisQuality.Exact : AnalysisQuality.Approximate;
                    a.Method = "M/G/1 с повторными вызовами (Фалин): E[Nорб] = λ²E[S²]/(2(1−ρ)) + λρ/(θ(1−ρ))";
                    if (a.Quality == AnalysisQuality.Approximate)
                    {
                        a.Notes.Add("Формула выведена для экспоненциального интервала повторных попыток; для другого распределения — приближение.");
                    }

                    m.OrbitSize = orbit;
                    m.OrbitTime = orbit / lambda;
                    m.L = r;
                    m.Lq = 0;
                    m.W = es;
                    m.Wq = 0;
                    m.Throughput = lambda;
                    m.Utilization = r;
                    m.BusyServers = r;
                    SetClassTimes(flow => flow.Mean);
                    return;
                }

                a.Quality = AnalysisQuality.Unavailable;
                a.Method = "повторные вызовы: только моделирование";
                a.Notes.Add("Точные формулы для систем с орбитой реализованы только для одного канала без мест ожидания (M/G/1 с повторными вызовами).");
                return;
            }

            // --- vacations.
            if (node.Vacation is not null)
            {
                if (servers == 1 && input.Poisson && input.Batch is null && plain && !priority
                    && node.Discipline is not (QueueDiscipline.ShortestJob or QueueDiscipline.RoundRobin))
                {
                    if (Unstable())
                    {
                        return;
                    }

                    var v1 = DistributionMath.Mean(node.Vacation);
                    var v2 = DistributionMath.SecondMoment(node.Vacation);
                    FinishFromWaiting(QueueingFormulas.PollaczekKhinchine(lambda, es, es2) + v2 / (2 * v1), AnalysisQuality.Exact,
                        "M/G/1 с многократными отпусками: Wq = λE[S²]/(2(1−ρ)) + E[V²]/(2E[V])");
                    m.VacationFraction = 1 - rho;
                    return;
                }

                a.Quality = AnalysisQuality.Unavailable;
                a.Method = "отпуска прибора: только моделирование";
                a.Notes.Add("Формула разложения реализована для одного канала, пуассоновского потока и неограниченной очереди.");
                return;
            }

            // --- birth–death (Markovian) systems.
            var serviceIndependentOrder = node.Discipline is not QueueDiscipline.ShortestJob;
            if (input.Poisson && input.Batch is null && exponential && serviceIndependentOrder)
            {
                if (plain && servers > 0 && rho >= 1)
                {
                    Unstable();
                    return;
                }

                SolveBirthDeath(input, result, servers, es, null);
                if (priority && plain)
                {
                    ApplyPriorities(input, result, servers, es, exponentialEqual: true);
                }

                return;
            }

            // --- finite systems that are not Markovian.
            if (!plain)
            {
                if (input.Poisson && input.Batch is null && node.Patience is null && node.Balking == BalkingKind.None && node.Capacity == servers)
                {
                    SolveErlangLoss(input, result, servers, es);
                    return;
                }

                if (input.Poisson && input.Batch is null && servers == 1 && node.Patience is null && node.Balking == BalkingKind.None
                    && serviceIndependentOrder && !priority && node.Discipline != QueueDiscipline.RoundRobin)
                {
                    SolveMG1K(input, result, es, es2);
                    return;
                }

                SolveBirthDeath(input, result, servers, es, "приближение: система рассчитана как марковская с теми же средними");
                a.Quality = AnalysisQuality.Approximate;
                return;
            }

            if (Unstable())
            {
                return;
            }

            // --- one server, unlimited queue.
            if (servers == 1)
            {
                if (input.Batch is not null)
                {
                    var (x1, x2) = DistributionMath.Moments(input.Batch);
                    var wq = (lambda * es2 / 2 + es * (x2 - x1) / (2 * x1)) / (1 - rho);
                    FinishFromWaiting(wq, AnalysisQuality.Exact, "M^X/G/1 (групповые поступления): Wq = [λE[S²]/2 + E[S](E[X²]−E[X])/(2E[X])]/(1−ρ)");
                    result.DepartureScv = 1 + (x2 - x1) / x1;
                    return;
                }

                if (input.Poisson)
                {
                    if (priority)
                    {
                        FinishFromWaiting(QueueingFormulas.PollaczekKhinchine(lambda, es, es2), AnalysisQuality.Exact, string.Empty);
                        ApplyPriorities(input, result, 1, es, exponentialEqual: false);
                        return;
                    }

                    switch (node.Discipline)
                    {
                        case QueueDiscipline.ShortestJob:
                            SolveShortestJob(input, result, es, es2);
                            return;
                        case QueueDiscipline.RoundRobin:
                        {
                            var w = es / (1 - rho);
                            FinishFromWaiting(w - es, AnalysisQuality.Approximate, "M/G/1 с разделением процессора (PS): W = E[S]/(1−ρ); циклическое обслуживание с малым квантом к нему приближается");
                            SetClassTimes(flow => flow.Mean / (1 - rho));
                            m.Lq = m.L - rho;
                            m.Wq = m.Lq / lambda;
                            return;
                        }
                        default:
                            FinishFromWaiting(QueueingFormulas.PollaczekKhinchine(lambda, es, es2), AnalysisQuality.Exact,
                                "M/G/1, формула Полячека–Хинчина: Wq = λE[S²]/(2(1−ρ))" + (node.Discipline == QueueDiscipline.Fifo ? "" : "; средние не зависят от порядка выбора из очереди"));
                            return;
                    }
                }

                if (input.RenewalArrival is { } renewal && exponential && !priority && serviceIndependentOrder && node.Discipline != QueueDiscipline.RoundRobin)
                {
                    var sigma = QueueingFormulas.GiM1Sigma(s => DistributionMath.Lst(renewal, s), 1 / es);
                    if (sigma is { } root && root is > 0 and < 1)
                    {
                        FinishFromWaiting(root * es / (1 - root), AnalysisQuality.Exact, $"GI/M/1: σ = A*(μ(1−σ)) = {DistributionMath.Format(Math.Round(root, 6))}, Wq = σ/(μ(1−σ))");
                        return;
                    }
                }
            }

            // --- approximations.
            var approximation = QueueingFormulas.AllenCunneen(servers, lambda, es, input.ArrivalScv, cs2);
            FinishFromWaiting(approximation, AnalysisQuality.Approximate,
                servers == 1 ? "G/G/1, приближение Кингмана: Wq ≈ ρ/(1−ρ)·(ca²+cs²)/2·E[S]" : "G/G/c, приближение Аллена–Каннена: Wq ≈ Wq(M/M/c)·(ca²+cs²)/2");
            a.Notes.Add($"ca² = {DistributionMath.Format(Math.Round(input.ArrivalScv, 4))}, cs² = {DistributionMath.Format(Math.Round(cs2, 4))}.");
            if (priority)
            {
                ApplyPriorities(input, result, servers, es, exponentialEqual: false, approximateScale: (input.ArrivalScv + cs2) / 2);
            }

            if (node.Discipline is QueueDiscipline.ShortestJob or QueueDiscipline.RoundRobin)
            {
                a.Notes.Add("Дисциплина обслуживания влияет на среднее время ожидания; показано значение для FIFO.");
            }

            void MarkUnstable(double rhoOverride)
            {
                a.Quality = AnalysisQuality.Unavailable;
                a.Method = "система неустойчива";
                a.Notes.Add($"Загрузка ρ = {DistributionMath.Format(Math.Round(rhoOverride, 4))} ≥ 1.");
            }
        }

        private static Func<int, double> JoinProbability(QueueingNode node) => waiting => node.Balking switch
        {
            BalkingKind.Linear => Math.Max(0, 1 - waiting / node.BalkingThreshold),
            BalkingKind.Discouraged => 1.0 / (waiting + 1),
            _ => 1,
        };

        /// <summary>M/M/c/K with balking, reneging (Erlang A); open arrivals with rate λ.</summary>
        private void SolveBirthDeath(NodeInput input, NodeResult result, int servers, double es, string? approximationNote)
        {
            var node = input.Node;
            var lambda = input.Lambda;
            var theta = node.Patience is null ? 0 : 1 / DistributionMath.Mean(node.Patience);
            var a = result.Analysis;
            if (!SolveStates(a.Metrics, servers, es, _ => lambda, JoinProbability(node), node.Capacity, theta))
            {
                a.Quality = AnalysisQuality.Unavailable;
                a.Method = "система неустойчива";
                return;
            }

            var m = a.Metrics;
            result.Served = (m.Throughput ?? 0) / lambda;
            for (var i = 0; i < result.ClassTime.Length; i++)
            {
                result.ClassTime[i] = m.W ?? 0;
            }

            result.DepartureScv = 1;
            var exactPatience = node.Patience is null || DistributionMath.IsExponential(node.Patience);
            a.Quality = approximationNote is null && exactPatience ? AnalysisQuality.Exact : AnalysisQuality.Approximate;
            var parts = new List<string>();
            if (node.Capacity is not null)
            {
                parts.Add(node.Capacity == servers ? "отказы (Эрланг B)" : "ограниченная очередь");
            }

            if (node.Balking != BalkingKind.None)
            {
                parts.Add("отказ от вступления в очередь");
            }

            if (node.Patience is not null)
            {
                parts.Add("уход из очереди (Эрланг A)");
            }

            a.Method = parts.Count == 0
                ? (servers == 1 ? "M/M/1: L = ρ/(1−ρ)" : "M/M/c, формула Эрланга C")
                : $"процесс гибели и размножения: {string.Join(", ", parts)}";
            if (approximationNote is not null)
            {
                a.Notes.Add(approximationNote);
            }

            if (!exactPatience)
            {
                a.Notes.Add("Время терпения не экспоненциальное: расчёт с интенсивностью ухода 1/E[терпения] — приближение.");
            }
        }

        /// <summary>
        /// Birth–death node: in state n customers arrive with rate <paramref name="offered"/>(n); an arrival first decides to
        /// join (balking, probability <paramref name="join"/>(waiting)) and is then blocked when the node holds K customers.
        /// Servers complete with rate min(n, c)/E[S], waiting customers abandon with rate θ each.
        /// </summary>
        private static bool SolveStates(QueueingMetrics m, int servers, double es, Func<int, double> offered, Func<int, double> join, int? capacity, double theta)
        {
            double Join(int n) => join(Math.Max(0, n - servers));
            double Birth(int n) => capacity is { } k && n >= k ? 0 : offered(n) * Join(n);
            var p = QueueingFormulas.BirthDeath(Birth, n => Math.Min(n, servers) / es + Math.Max(0, n - servers) * theta, capacity);
            if (p is null)
            {
                return false;
            }

            double arriving = 0, accepted = 0, blocked = 0, balked = 0, l = 0, lq = 0, busy = 0;
            for (var n = 0; n < p.Length; n++)
            {
                var rate = offered(n);
                arriving += rate * p[n];
                accepted += Birth(n) * p[n];
                balked += rate * (1 - Join(n)) * p[n];
                if (capacity is { } k && n >= k)
                {
                    blocked += rate * Join(n) * p[n];
                }

                l += n * p[n];
                lq += Math.Max(0, n - servers) * p[n];
                busy += Math.Min(n, servers) * p[n];
            }

            m.ArrivalRate = arriving;
            m.L = l;
            m.Lq = lq;
            m.BusyServers = busy;
            m.Utilization = busy / servers;
            m.Throughput = busy / es;
            m.W = accepted > 0 ? l / accepted : 0;
            m.Wq = accepted > 0 ? lq / accepted : 0;
            m.LossProbability = capacity is null ? null : blocked / arriving;
            m.BalkProbability = balked > 1e-14 * arriving ? balked / arriving : null;
            m.RenegeProbability = theta > 0 ? theta * lq / arriving : null;
            return true;
        }

        /// <summary>Erlang loss system M/G/c/c (insensitive to the service distribution).</summary>
        private static void SolveErlangLoss(NodeInput input, NodeResult result, int servers, double es)
        {
            var a = result.Analysis;
            var m = a.Metrics;
            var load = input.Lambda * es;
            var blocking = QueueingFormulas.ErlangB(servers, load);
            a.Quality = AnalysisQuality.Exact;
            a.Method = "M/G/c/c, формула Эрланга B (не зависит от распределения обслуживания)";
            m.LossProbability = blocking;
            m.Throughput = input.Lambda * (1 - blocking);
            m.BusyServers = load * (1 - blocking);
            m.Utilization = load * (1 - blocking) / servers;
            m.L = m.BusyServers;
            m.Lq = 0;
            m.W = es;
            m.Wq = 0;
            result.Served = 1 - blocking;
            foreach (var flow in input.Classes)
            {
                result.ClassTime[flow.Class] = flow.Mean;
            }
        }

        /// <summary>M/G/1/K from the embedded Markov chain at departure epochs.</summary>
        private static void SolveMG1K(NodeInput input, NodeResult result, double es, double es2)
        {
            var a = result.Analysis;
            var m = a.Metrics;
            var lambda = input.Lambda;
            var capacity = input.Node.Capacity!.Value;
            var arrivals = ArrivalsDuringService(input, capacity);
            var p = QueueingFormulas.MG1K(capacity, lambda * es, k => arrivals[k]);
            var l = p.Select((value, n) => value * n).Sum();
            var accepted = lambda * (1 - p[capacity]);
            a.Quality = AnalysisQuality.Exact;
            a.Method = "M/G/1/K: вложенная цепь Маркова в моменты окончания обслуживания";
            m.LossProbability = p[capacity];
            m.Throughput = accepted;
            m.Utilization = 1 - p[0];
            m.BusyServers = 1 - p[0];
            m.L = l;
            m.Lq = l - (1 - p[0]);
            m.W = l / accepted;
            m.Wq = m.Lq / accepted;
            result.Served = 1 - p[capacity];
            foreach (var flow in input.Classes)
            {
                result.ClassTime[flow.Class] = m.Wq.Value + flow.Mean;
            }
        }

        /// <summary>a_k = P(k Poisson arrivals during a service): closed forms for M and D, numerical integration otherwise.</summary>
        private static double[] ArrivalsDuringService(NodeInput input, int count)
        {
            var lambda = input.Lambda;
            var result = new double[count + 1];
            var random = new Random(12345);
            foreach (var flow in input.Classes)
            {
                var weight = flow.Rate / lambda;
                switch (flow.Service.Kind)
                {
                    case DistributionKind.Exponential:
                    {
                        var x = lambda * flow.Mean;
                        for (var k = 0; k <= count; k++)
                        {
                            result[k] += weight / (1 + x) * Math.Pow(x / (1 + x), k);
                        }

                        break;
                    }
                    case DistributionKind.Deterministic:
                        for (var k = 0; k <= count; k++)
                        {
                            result[k] += weight * QueueingFormulas.PoissonProbability(lambda * flow.Mean, k);
                        }

                        break;
                    default:
                    {
                        const int samples = 100_000;
                        var sums = new double[count + 1];
                        for (var i = 0; i < samples; i++)
                        {
                            var mean = lambda * DistributionMath.Sample(flow.Service, random);
                            for (var k = 0; k <= count; k++)
                            {
                                sums[k] += QueueingFormulas.PoissonProbability(mean, k);
                            }
                        }

                        for (var k = 0; k <= count; k++)
                        {
                            result[k] += weight * sums[k] / samples;
                        }

                        break;
                    }
                }
            }

            return result;
        }

        /// <summary>Non-preemptive SPT in M/G/1: Wq(x) = W0/((1 − ρ(x⁻))(1 − ρ(x))), integrated over a large deterministic sample.</summary>
        private static void SolveShortestJob(NodeInput input, NodeResult result, double es, double es2)
        {
            var lambda = input.Lambda;
            var random = new Random(271828);
            var values = new double[SjfSamples];
            var classes = input.Classes;
            var cumulativeWeights = classes.Select(c => c.Rate / lambda).ToArray();
            for (var i = 0; i < SjfSamples; i++)
            {
                var u = random.NextDouble();
                var index = 0;
                while (index < classes.Count - 1 && u > cumulativeWeights[index])
                {
                    u -= cumulativeWeights[index];
                    index++;
                }

                values[i] = DistributionMath.Sample(classes[index].Service, random);
            }

            Array.Sort(values);
            var below = new double[SjfSamples];
            var through = new double[SjfSamples];
            var sum = 0.0;
            var start = 0;
            while (start < SjfSamples)
            {
                var end = start;
                var groupSum = 0.0;
                while (end < SjfSamples && values[end] == values[start])
                {
                    groupSum += values[end];
                    end++;
                }

                for (var i = start; i < end; i++)
                {
                    below[i] = lambda * sum / SjfSamples;
                    through[i] = lambda * (sum + groupSum) / SjfSamples;
                }

                sum += groupSum;
                start = end;
            }

            var w0 = lambda * es2 / 2;
            double WaitingAt(double x)
            {
                var position = Array.BinarySearch(values, x);
                if (position < 0)
                {
                    position = Math.Min(SjfSamples - 1, ~position);
                }

                return w0 / ((1 - below[position]) * (1 - through[position]));
            }

            var wq = Enumerable.Range(0, SjfSamples).Average(i => w0 / ((1 - below[i]) * (1 - through[i])));
            var a = result.Analysis;
            var m = a.Metrics;
            var rho = lambda * es;
            a.Quality = AnalysisQuality.Exact;
            a.Method = "M/G/1, кратчайшая работа первой: Wq(x) = W0/((1−ρ(x⁻))(1−ρ(x))), интеграл вычислен численно";
            m.Wq = wq;
            m.W = wq + es;
            m.Lq = lambda * wq;
            m.L = lambda * (wq + es);
            m.Throughput = lambda;
            m.BusyServers = rho;
            m.Utilization = rho;
            foreach (var flow in classes)
            {
                var classRandom = new Random(314159 + flow.Class);
                var classWait = Enumerable.Range(0, 20_000).Average(_ => WaitingAt(DistributionMath.Sample(flow.Service, classRandom)));
                result.ClassTime[flow.Class] = classWait + flow.Mean;
            }
        }

        /// <summary>
        /// Per-class times of a priority node: Cobham (non-preemptive M/G/1, M/M/c with equal rates) and preemptive resume
        /// (M/G/1); <paramref name="approximateScale"/> turns the M/M/c formula into an approximation for other systems.
        /// </summary>
        private static void ApplyPriorities(NodeInput input, NodeResult result, int servers, double es, bool exponentialEqual, double? approximateScale = null)
        {
            var a = result.Analysis;
            var lambda = input.Lambda;
            var preemptive = input.Node.Discipline == QueueDiscipline.PreemptivePriority;
            var levels = input.Classes.GroupBy(flow => flow.Priority).OrderByDescending(group => group.Key).ToList();
            var sigmaBefore = 0.0;
            var residualBefore = 0.0;
            var classTimes = new Dictionary<int, double>();
            foreach (var level in levels)
            {
                var load = level.Sum(flow => flow.Rate * flow.Mean) / servers;
                var residual = level.Sum(flow => flow.Rate * flow.Second) / 2;
                var sigma = sigmaBefore + load;
                foreach (var flow in level)
                {
                    double time;
                    if (preemptive)
                    {
                        time = flow.Mean / (1 - sigmaBefore) + (residualBefore + residual) / ((1 - sigmaBefore) * (1 - sigma));
                    }
                    else if (servers == 1 && approximateScale is null)
                    {
                        var w0 = input.Classes.Sum(x => x.Rate * x.Second) / 2;
                        time = w0 / ((1 - sigmaBefore) * (1 - sigma)) + flow.Mean;
                    }
                    else
                    {
                        var erlang = QueueingFormulas.ErlangC(servers, lambda * es) * es / servers;
                        time = erlang / ((1 - sigmaBefore) * (1 - sigma)) * (approximateScale ?? 1) + flow.Mean;
                    }

                    classTimes[flow.Class] = time;
                }

                sigmaBefore = sigma;
                residualBefore += residual;
            }

            foreach (var (index, time) in classTimes)
            {
                result.ClassTime[index] = time;
            }

            // Node totals from the class times (Little's law per class).
            var m = a.Metrics;
            var l = input.Classes.Sum(flow => flow.Rate * classTimes[flow.Class]);
            m.L = l;
            m.W = l / lambda;
            m.Lq = l - lambda * es;
            m.Wq = m.Lq / lambda;
            if (preemptive)
            {
                // With interruptions the time to the first start of service is not the classical waiting time.
                m.Lq = null;
                m.Wq = null;
                a.Notes.Add("При прерываниях ожидание включает простои прерванных заявок; сравнивайте время пребывания W.");
            }
            if (approximateScale is null)
            {
                a.Quality = a.Quality == AnalysisQuality.Approximate ? AnalysisQuality.Approximate : AnalysisQuality.Exact;
            }

            a.Method = preemptive
                ? "M/G/1, абсолютный приоритет с дообслуживанием: Wk = E[Sk]/(1−σk−1) + Rk/((1−σk−1)(1−σk))"
                : servers == 1 && approximateScale is null
                    ? "M/G/1, относительный приоритет (формула Кобхэма): Wq,k = W0/((1−σk−1)(1−σk))"
                    : exponentialEqual && approximateScale is null
                        ? "M/M/c, относительный приоритет: Wq,k = C(c,a)/(cμ)/((1−σk−1)(1−σk))"
                        : "относительный приоритет, приближение: формула M/M/c с поправкой (ca²+cs²)/2";
            a.Notes.Add("Время пребывания по классам — в таблице классов заявок.");
        }

        // ================================================================= closed networks

        public QueueingAnalysis AnalyzeClosed(CustomerClass customerClass)
        {
            var population = customerClass.Population;
            var think = customerClass.Think is null ? 0 : DistributionMath.Mean(customerClass.Think);
            var entry = Index(customerClass.Entry);
            var visits = Visits(entry, Enumerable.Repeat(1.0, N).ToArray());
            var analysis = new QueueingAnalysis
            {
                Nodes = Model.Nodes.Select((node, j) => NewNode(j, Kendall(
                    N == 1 && customerClass.Think is not null ? DistributionMath.Code(customerClass.Think) : "G",
                    DistributionMath.Code(ServiceOf(j, customerClass)), node, population))).ToList(),
                Classes = [new ClassAnalysis { ClassId = customerClass.Id, Name = QueueingGenerator.Title(customerClass) }],
            };

            var special = Model.Nodes.Any(node => node.Capacity is not null || node.Patience is not null || node.Balking != BalkingKind.None
                || node.Vacation is not null || node.TimeToFailure is not null || node.WhenFull == FullPolicy.Retry);
            if (special)
            {
                var node = Model.Nodes[0];
                if (N == 1 && think > 0 && customerClass.Think is { } thinkTime && DistributionMath.IsExponential(thinkTime) && DistributionMath.IsExponential(ServiceOf(0, customerClass))
                    && node.Vacation is null && node.TimeToFailure is null && node.WhenFull == FullPolicy.Lose && node.Discipline != QueueDiscipline.ShortestJob)
                {
                    return FiniteSourceBirthDeath(analysis, customerClass, think);
                }

                analysis.Network = "не применяется";
                analysis.Messages.Add("Замкнутая система с ограничениями узлов (ёмкость, нетерпеливость, отпуска, отказы): точное решение только для одного узла с экспоненциальными временами; показаны результаты моделирования.");
                for (var j = 0; j < N; j++)
                {
                    analysis.Nodes[j].Quality = AnalysisQuality.Unavailable;
                    analysis.Nodes[j].Method = "только моделирование";
                    AddExactSideMeasures(j, analysis.Nodes[j].Metrics);
                }

                analysis.Classes[0].Quality = AnalysisQuality.Unavailable;
                return analysis;
            }

            // Exact mean value analysis with load-dependent (multi-server) stations.
            var demand = Enumerable.Range(0, N).Select(j => visits[j] * DistributionMath.Mean(ServiceOf(j, customerClass))).ToArray();
            var servers = Model.Nodes.Select(node => node.Servers).ToArray();
            var marginal = Enumerable.Range(0, N).Select(_ => new double[population + 1]).ToArray();
            foreach (var probabilities in marginal)
            {
                probabilities[0] = 1;
            }

            var queue = new double[N];
            var residence = new double[N];
            var throughput = 0.0;
            for (var n = 1; n <= population; n++)
            {
                for (var j = 0; j < N; j++)
                {
                    if (servers[j] == 0)
                    {
                        residence[j] = demand[j];
                    }
                    else if (servers[j] == 1)
                    {
                        residence[j] = demand[j] * (1 + queue[j]);
                    }
                    else
                    {
                        var sum = 0.0;
                        for (var k = 1; k <= n; k++)
                        {
                            sum += k * demand[j] / Math.Min(k, servers[j]) * marginal[j][k - 1];
                        }

                        residence[j] = sum;
                    }
                }

                throughput = n / (think + residence.Sum());
                for (var j = 0; j < N; j++)
                {
                    queue[j] = throughput * residence[j];
                    if (servers[j] > 1)
                    {
                        var next = new double[population + 1];
                        var total = 0.0;
                        for (var k = n; k >= 1; k--)
                        {
                            next[k] = demand[j] / Math.Min(k, servers[j]) * throughput * marginal[j][k - 1];
                            total += next[k];
                        }

                        next[0] = Math.Max(0, 1 - total);
                        marginal[j] = next;
                    }
                }
            }

            var exact = true;
            for (var j = 0; j < N; j++)
            {
                var node = Model.Nodes[j];
                var service = ServiceOf(j, customerClass);
                var nodeExact = node.Servers == 0 || (DistributionMath.IsExponential(service) && node.Discipline != QueueDiscipline.ShortestJob);
                exact &= nodeExact;
                var es = DistributionMath.Mean(service);
                var rate = throughput * visits[j];
                var busy = node.Servers == 0 ? queue[j] : rate * es;
                var result = analysis.Nodes[j];
                result.Quality = nodeExact ? AnalysisQuality.Exact : AnalysisQuality.Approximate;
                result.Method = node.Servers == 0 ? "станция задержки (бесконечное число каналов)" : "анализ средних значений (MVA)";
                if (!nodeExact)
                {
                    result.Notes.Add("Время обслуживания не экспоненциальное: сеть не имеет мультипликативной формы, MVA даёт приближение.");
                }

                result.Metrics = new QueueingMetrics
                {
                    ArrivalRate = rate,
                    Throughput = rate,
                    L = queue[j],
                    W = rate > 0 ? queue[j] / rate : 0,
                    BusyServers = busy,
                    Utilization = node.Servers == 0 ? null : busy / node.Servers,
                    Lq = Math.Max(0, queue[j] - busy),
                    Wq = rate > 0 ? Math.Max(0, queue[j] - busy) / rate : 0,
                };
            }

            var classResult = analysis.Classes[0];
            classResult.Quality = exact ? AnalysisQuality.Exact : AnalysisQuality.Approximate;
            classResult.Throughput = throughput;
            classResult.ResponseTime = population / throughput - think;
            classResult.InSystem = population - throughput * think;
            classResult.LossProbability = 0;
            analysis.Network = $"замкнутая сеть, {population} заявок: точный анализ средних значений (MVA) с многоканальными станциями" + (exact ? "" : " — приближение для неэкспоненциального обслуживания");
            return analysis;
        }

        /// <summary>Finite source single node (machine repair, Engset) with capacity, balking and reneging.</summary>
        private QueueingAnalysis FiniteSourceBirthDeath(QueueingAnalysis analysis, CustomerClass customerClass, double think)
        {
            var node = Model.Nodes[0];
            var population = customerClass.Population;
            var servers = node.Servers == 0 ? population : node.Servers;
            var es = DistributionMath.Mean(ServiceOf(0, customerClass));
            var theta = node.Patience is null ? 0 : 1 / DistributionMath.Mean(node.Patience);
            var capacity = Math.Min(node.Capacity ?? population, population);
            var result = analysis.Nodes[0];
            var metrics = new QueueingMetrics();
            SolveStates(metrics, servers, es, n => (population - n) / think, JoinProbability(node), capacity, theta);
            if (node.Capacity is null)
            {
                metrics.LossProbability = null;
            }

            var exactPatience = node.Patience is null || DistributionMath.IsExponential(node.Patience);
            result.Quality = exactPatience ? AnalysisQuality.Exact : AnalysisQuality.Approximate;
            result.Method = "конечный источник (модель Энгсета / наладчиков): процесс гибели и размножения";
            result.Metrics = metrics;
            var throughput = metrics.Throughput!.Value;
            var offered = metrics.ArrivalRate!.Value;
            var l = metrics.L!.Value;
            var classResult = analysis.Classes[0];
            classResult.Quality = result.Quality;
            classResult.Throughput = throughput;
            classResult.ResponseTime = theta > 0 ? null : result.Metrics.W;
            classResult.InSystem = l;
            classResult.LossProbability = offered > 0 ? 1 - throughput / offered : 0;
            analysis.Network = "одиночная СМО с конечным числом источников";
            return analysis;
        }
    }
}
