using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;
using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Runtime;

namespace GpssStudio.Simulation.Experiments;

/// <summary>Kind of model object varied by an experiment factor.</summary>
[System.Text.Json.Serialization.JsonConverter(typeof(System.Text.Json.Serialization.JsonStringEnumConverter))]
public enum FactorKind
{
    /// <summary>Savevalue <c>X$Name</c>, set after the model's INITIAL statements.</summary>
    Savevalue,

    /// <summary>Capacity of storage <c>Name</c>.</summary>
    Storage,

    /// <summary>Value of the <c>Name EQU value</c> statement (the model is translated with the new value).</summary>
    Equ,
}

public sealed class ExperimentFactor
{
    public string Name { get; init; } = string.Empty;
    public FactorKind Kind { get; init; } = FactorKind.Savevalue;

    /// <summary>Levels of the factor; the plan is the full factorial design of all factors.</summary>
    public IReadOnlyList<double> Levels { get; init; } = [];
}

public sealed class ExperimentIndicator
{
    /// <summary>GPSS expression evaluated at the end of each run, e.g. <c>QA$Line</c> or <c>FR$Server/10</c>.</summary>
    public string Expression { get; init; } = string.Empty;
    public string? Label { get; init; }
}

public sealed class ExperimentRequest
{
    public string ModelText { get; init; } = string.Empty;
    public IReadOnlyList<ExperimentFactor> Factors { get; init; } = [];
    public IReadOnlyList<ExperimentIndicator> Indicators { get; init; } = [];

    /// <summary>Runs per plan point with different random number seeds.</summary>
    public int Replications { get; init; } = 1;

    /// <summary>Termination count of START for models that have no START statement.</summary>
    public int StartCount { get; init; } = 1;

    /// <summary>Optional optimisation target: index of the indicator and direction.</summary>
    public int? ObjectiveIndicator { get; init; }
    public bool Maximize { get; init; }
}

public sealed record ExperimentRun(int Point, int Replication, IReadOnlyList<double> Factors, IReadOnlyList<double?> Indicators, double Clock, string? Error);

public sealed record IndicatorSummary(double Mean, double StandardDeviation, double ConfidenceHalfWidth, double Min, double Max, int Count);

public sealed record ExperimentPoint(int Index, IReadOnlyList<double> Factors, IReadOnlyList<IndicatorSummary?> Indicators, int Failed);

public sealed class ExperimentResult
{
    public required IReadOnlyList<string> FactorNames { get; init; }
    public required IReadOnlyList<string> IndicatorNames { get; init; }
    public required IReadOnlyList<ExperimentPoint> Points { get; init; }
    public required IReadOnlyList<ExperimentRun> Runs { get; init; }

    /// <summary>Plan point with the best mean of the objective indicator, if one was requested.</summary>
    public int? BestPoint { get; init; }
    public double ElapsedSeconds { get; init; }
    public IReadOnlyList<string> Messages { get; init; } = [];
}

/// <summary>
/// Experiments with a model (GPSS Studio "серии экспериментов" and grid optimisation): the full
/// factorial plan of the factor levels, several replications per point with independent random
/// numbers, indicators evaluated after each run and summarised with 95 % confidence intervals.
/// </summary>
public static class ExperimentRunner
{
    public const int MaxRuns = 400;
    public const int MaxFactors = 8;
    public static readonly TimeSpan TimeLimit = TimeSpan.FromSeconds(90);
    private const int SeededStreams = 32;

    public static ExperimentResult Run(ExperimentRequest request, CancellationToken cancellationToken = default)
    {
        Validate(request);
        var plan = FullFactorial(request.Factors);
        var replications = Math.Max(1, request.Replications);
        if (plan.Count * replications > MaxRuns)
        {
            throw new ArgumentException($"План содержит {plan.Count * replications} прогонов; допускается не более {MaxRuns}.");
        }

        var indicators = request.Indicators.Select(indicator => ExpressionParser.Parse(indicator.Expression)).ToList();
        var stopwatch = Stopwatch.StartNew();
        var runs = new List<ExperimentRun>();
        var messages = new List<string>();

        for (var point = 0; point < plan.Count && stopwatch.Elapsed < TimeLimit; point++)
        {
            var levels = plan[point];
            var text = ApplyEquFactors(request.ModelText, request.Factors, levels);
            for (var replication = 0; replication < replications; replication++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (stopwatch.Elapsed >= TimeLimit)
                {
                    messages.Add($"Достигнут предел времени эксперимента ({TimeLimit.TotalSeconds:N0} с): выполнено {runs.Count} прогонов.");
                    break;
                }

                runs.Add(RunOnce(text, request, levels, indicators, point, replication));
            }
        }

        var points = plan.Select((levels, index) => Summarize(index, levels, runs.Where(run => run.Point == index).ToList(), indicators.Count)).ToList();
        return new ExperimentResult
        {
            FactorNames = request.Factors.Select(factor => factor.Name).ToList(),
            IndicatorNames = request.Indicators.Select(indicator => string.IsNullOrWhiteSpace(indicator.Label) ? indicator.Expression : indicator.Label!).ToList(),
            Points = points,
            Runs = runs,
            BestPoint = BestPoint(points, request),
            ElapsedSeconds = stopwatch.Elapsed.TotalSeconds,
            Messages = messages,
        };
    }

    private static void Validate(ExperimentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ModelText))
        {
            throw new ArgumentException("Текст модели пуст.");
        }

        if (request.Indicators.Count == 0)
        {
            throw new ArgumentException("Не заданы показатели эксперимента.");
        }

        if (request.Factors.Count > MaxFactors)
        {
            throw new ArgumentException($"Допускается не более {MaxFactors} факторов.");
        }

        foreach (var factor in request.Factors)
        {
            if (string.IsNullOrWhiteSpace(factor.Name) || factor.Levels.Count == 0)
            {
                throw new ArgumentException($"Фактор «{factor.Name}»: нужны имя и хотя бы одно значение.");
            }
        }

        if (request.ObjectiveIndicator is { } objective && (objective < 0 || objective >= request.Indicators.Count))
        {
            throw new ArgumentException("Целевой показатель не найден.");
        }

        foreach (var indicator in request.Indicators)
        {
            try
            {
                ExpressionParser.Parse(indicator.Expression);
            }
            catch (FormatException exception)
            {
                throw new ArgumentException($"Показатель «{indicator.Expression}»: {exception.Message}");
            }
        }
    }

    /// <summary>All combinations of factor levels (one empty point when there are no factors).</summary>
    public static IReadOnlyList<double[]> FullFactorial(IReadOnlyList<ExperimentFactor> factors)
    {
        IEnumerable<double[]> plan = [[]];
        foreach (var factor in factors)
        {
            plan = plan.SelectMany(point => factor.Levels.Select(level => point.Append(level).ToArray()));
        }

        return plan.ToList();
    }

    private static string ApplyEquFactors(string text, IReadOnlyList<ExperimentFactor> factors, double[] levels)
    {
        for (var index = 0; index < factors.Count; index++)
        {
            if (factors[index].Kind != FactorKind.Equ)
            {
                continue;
            }

            var pattern = new Regex($@"^(\s*{Regex.Escape(factors[index].Name)}\s+EQU\s+)([^\s;]+)", RegexOptions.IgnoreCase | RegexOptions.Multiline);
            if (!pattern.IsMatch(text))
            {
                throw new ArgumentException($"Фактор «{factors[index].Name}»: в модели нет оператора {factors[index].Name} EQU.");
            }

            var value = levels[index].ToString(CultureInfo.InvariantCulture);
            text = pattern.Replace(text, match => match.Groups[1].Value + value, 1);
        }

        return text;
    }

    private static ExperimentRun RunOnce(string text, ExperimentRequest request, double[] levels, IReadOnlyList<Expr> indicators, int point, int replication)
    {
        void Prepare(SimulationEngine engine)
        {
            // Independent random numbers per replication; replication 0 keeps the model's own seeds.
            if (replication > 0)
            {
                for (var stream = 1; stream <= SeededStreams; stream++)
                {
                    engine.SeedRandom(stream, 104_729L * replication + 7_919L * stream);
                }
            }

            for (var index = 0; index < request.Factors.Count; index++)
            {
                var factor = request.Factors[index];
                switch (factor.Kind)
                {
                    case FactorKind.Savevalue:
                        engine.Savevalue(factor.Name).Value = levels[index];
                        break;
                    case FactorKind.Storage:
                        engine.Storage(factor.Name).Capacity = (int)Math.Round(levels[index]);
                        break;
                }
            }
        }

        try
        {
            var (session, result) = SimulationSession.Create(text, "Эксперимент", beforeFirstStart: Prepare);
            if (session is null)
            {
                return new ExperimentRun(point, replication, levels, indicators.Select(_ => (double?)null).ToList(), 0, string.Join("; ", result.Errors));
            }

            if (result.State == "idle")
            {
                result = session.Execute($"START {Math.Max(1, request.StartCount)}");
            }

            var values = indicators.Select(indicator => Evaluate(indicator, session.Engine)).ToList();
            return new ExperimentRun(point, replication, levels, values, session.Engine.AbsoluteClock, result.RuntimeError);
        }
        catch (SimulationException exception)
        {
            return new ExperimentRun(point, replication, levels, indicators.Select(_ => (double?)null).ToList(), 0, exception.Message);
        }
    }

    private static double? Evaluate(Expr indicator, SimulationEngine engine)
    {
        try
        {
            var value = indicator.Evaluate(engine, null);
            return double.IsFinite(value) ? value : null;
        }
        catch (SimulationException)
        {
            return null;
        }
    }

    private static ExperimentPoint Summarize(int index, double[] levels, IReadOnlyList<ExperimentRun> runs, int indicatorCount)
    {
        var summaries = Enumerable.Range(0, indicatorCount).Select(indicator =>
        {
            var values = runs.Where(run => run.Error is null).Select(run => run.Indicators[indicator]).OfType<double>().ToList();
            return values.Count == 0 ? null : Statistics(values);
        }).ToList();
        return new ExperimentPoint(index, levels, summaries, runs.Count(run => run.Error is not null));
    }

    /// <summary>Mean, sample standard deviation and the half-width of the 95 % Student confidence interval.</summary>
    public static IndicatorSummary Statistics(IReadOnlyList<double> values)
    {
        var mean = values.Average();
        var deviation = values.Count > 1 ? Math.Sqrt(values.Sum(value => (value - mean) * (value - mean)) / (values.Count - 1)) : 0;
        var halfWidth = values.Count > 1 ? StudentQuantile975(values.Count - 1) * deviation / Math.Sqrt(values.Count) : 0;
        return new IndicatorSummary(mean, deviation, halfWidth, values.Min(), values.Max(), values.Count);
    }

    /// <summary>0.975 quantile of Student's t distribution (table for small samples, normal limit above 30).</summary>
    private static double StudentQuantile975(int degreesOfFreedom)
    {
        double[] table = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
        return degreesOfFreedom <= table.Length ? table[degreesOfFreedom - 1] : 1.96;
    }

    private static int? BestPoint(IReadOnlyList<ExperimentPoint> points, ExperimentRequest request)
    {
        if (request.ObjectiveIndicator is not { } objective)
        {
            return null;
        }

        var candidates = points.Where(point => point.Indicators[objective] is not null).ToList();
        if (candidates.Count == 0)
        {
            return null;
        }

        var best = request.Maximize
            ? candidates.MaxBy(point => point.Indicators[objective]!.Mean)
            : candidates.MinBy(point => point.Indicators[objective]!.Mean);
        return best?.Index;
    }
}
