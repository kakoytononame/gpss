using System.Text.Json.Serialization;

namespace GpssStudio.Simulation.Queueing;

/// <summary>Probability distribution of an interval (Kendall codes M, D, Ek, H2, U, N, LN, T, Γ, W).</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DistributionKind
{
    Exponential,
    Deterministic,
    Erlang,
    HyperExponential,
    Uniform,
    Normal,
    LogNormal,
    Triangular,
    Gamma,
    Weibull,
}

/// <summary>
/// An interval distribution. Parameters by kind: Exponential, Deterministic — Mean; Erlang — Mean, Shape (k);
/// HyperExponential — Mean, Cv ≥ 1 (two phases with balanced means); Uniform — Min, Max; Normal (truncated at 0),
/// LogNormal, Gamma — Mean, Cv; Triangular — Min, Mode, Max; Weibull — Mean, Shape.
/// </summary>
public sealed record Distribution
{
    public DistributionKind Kind { get; init; } = DistributionKind.Exponential;
    public double Mean { get; init; }

    /// <summary>Coefficient of variation (standard deviation / mean).</summary>
    public double Cv { get; init; }

    /// <summary>Erlang phases k or Weibull shape.</summary>
    public double Shape { get; init; }

    public double Min { get; init; }
    public double Max { get; init; }
    public double Mode { get; init; }

    public static Distribution Exponential(double mean) => new() { Kind = DistributionKind.Exponential, Mean = mean };
    public static Distribution Deterministic(double value) => new() { Kind = DistributionKind.Deterministic, Mean = value };
    public static Distribution Erlang(double mean, int phases) => new() { Kind = DistributionKind.Erlang, Mean = mean, Shape = phases };
    public static Distribution HyperExponential(double mean, double cv) => new() { Kind = DistributionKind.HyperExponential, Mean = mean, Cv = cv };
    public static Distribution Uniform(double min, double max) => new() { Kind = DistributionKind.Uniform, Min = min, Max = max };
    public static Distribution Normal(double mean, double cv) => new() { Kind = DistributionKind.Normal, Mean = mean, Cv = cv };
    public static Distribution LogNormal(double mean, double cv) => new() { Kind = DistributionKind.LogNormal, Mean = mean, Cv = cv };
    public static Distribution Triangular(double min, double mode, double max) => new() { Kind = DistributionKind.Triangular, Min = min, Mode = mode, Max = max };
    public static Distribution GammaDistribution(double mean, double cv) => new() { Kind = DistributionKind.Gamma, Mean = mean, Cv = cv };
    public static Distribution Weibull(double mean, double shape) => new() { Kind = DistributionKind.Weibull, Mean = mean, Shape = shape };
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BatchKind
{
    /// <summary>Every arrival brings <see cref="BatchSize.Size"/> customers.</summary>
    Fixed,

    /// <summary>Discrete uniform size Min..Max.</summary>
    Uniform,

    /// <summary>Geometric size on 1, 2, ... with mean <see cref="BatchSize.Size"/>.</summary>
    Geometric,
}

/// <summary>Size of a group arrival (bulk arrivals M^X).</summary>
public sealed record BatchSize
{
    public BatchKind Kind { get; init; } = BatchKind.Fixed;
    public double Size { get; init; } = 1;
    public int Min { get; init; } = 1;
    public int Max { get; init; } = 1;
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum CustomerClassKind
{
    /// <summary>Customers arrive from outside and leave the system (open network).</summary>
    Open,

    /// <summary>A fixed population cycles between a think (idle) phase and the nodes (finite source, closed network).</summary>
    Closed,
}

/// <summary>Service time of a class at a node that differs from the node's own service time.</summary>
public sealed record ServiceOverride
{
    public string Node { get; init; } = string.Empty;
    public Distribution Service { get; init; } = new();
}

/// <summary>A class (stream) of customers.</summary>
public sealed record CustomerClass
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public CustomerClassKind Kind { get; init; } = CustomerClassKind.Open;

    /// <summary>Interarrival time of an open class.</summary>
    public Distribution? Arrival { get; init; }

    /// <summary>Group arrivals of an open class; null — single arrivals.</summary>
    public BatchSize? Batch { get; init; }

    /// <summary>Number of customers of a closed class.</summary>
    public int Population { get; init; }

    /// <summary>Think (idle, "time to failure" of a machine) time of a closed class; null — none.</summary>
    public Distribution? Think { get; init; }

    /// <summary>Priority at priority nodes: a larger number is served first (GPSS convention).</summary>
    public int Priority { get; init; }

    /// <summary>Id of the node the customers arrive at.</summary>
    public string Entry { get; init; } = string.Empty;

    public IReadOnlyList<ServiceOverride> Services { get; init; } = [];
}

/// <summary>Order in which waiting customers are taken into service.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum QueueDiscipline
{
    /// <summary>First in, first out (FCFS).</summary>
    Fifo,

    /// <summary>Last in, first out (LCFS, non-preemptive).</summary>
    Lifo,

    /// <summary>Service in random order (SIRO).</summary>
    Random,

    /// <summary>Shortest processing time first (SPT/SJF, non-preemptive; the service time is known on arrival).</summary>
    ShortestJob,

    /// <summary>Class priority without interruption of service (head-of-line priority).</summary>
    Priority,

    /// <summary>Class priority with preemption; the interrupted service is resumed (preemptive resume, one server).</summary>
    PreemptivePriority,

    /// <summary>Round robin with a time quantum (approaches processor sharing for small quanta).</summary>
    RoundRobin,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BalkingKind
{
    None,

    /// <summary>Joins with probability max(0, 1 − w / Threshold), w — customers waiting.</summary>
    Linear,

    /// <summary>Discouraged arrivals: joins with probability 1 / (w + 1).</summary>
    Discouraged,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum FullPolicy
{
    /// <summary>A customer that finds the node full is lost (blocked customers cleared).</summary>
    Lose,

    /// <summary>A customer that finds the node full goes to the orbit and retries after a retrial time.</summary>
    Retry,
}

/// <summary>Next node of a customer after service; an empty <see cref="Target"/> means leaving the system.</summary>
public sealed record QueueingRoute
{
    public string? Target { get; init; }
    public double Probability { get; init; }
}

/// <summary>A service station: servers, waiting room and discipline, customer behaviour and server interruptions.</summary>
public sealed record QueueingNode
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;

    /// <summary>Number of servers; 0 — unlimited (infinite server / delay station).</summary>
    public int Servers { get; init; } = 1;

    /// <summary>Maximum number of customers at the node (waiting and in service); null — unlimited.</summary>
    public int? Capacity { get; init; }

    public QueueDiscipline Discipline { get; init; } = QueueDiscipline.Fifo;

    /// <summary>Time quantum of <see cref="QueueDiscipline.RoundRobin"/>.</summary>
    public double Quantum { get; init; }

    public Distribution Service { get; init; } = new();

    public FullPolicy WhenFull { get; init; } = FullPolicy.Lose;

    /// <summary>Time between retrials of a customer in the orbit (<see cref="FullPolicy.Retry"/>).</summary>
    public Distribution? Retrial { get; init; }

    /// <summary>Maximum waiting time of a customer (reneging, impatience); null — customers wait indefinitely.</summary>
    public Distribution? Patience { get; init; }

    public BalkingKind Balking { get; init; } = BalkingKind.None;
    public double BalkingThreshold { get; init; }

    /// <summary>Operating time between failures of the station; null — no failures.</summary>
    public Distribution? TimeToFailure { get; init; }

    /// <summary>Repair time after a failure.</summary>
    public Distribution? Repair { get; init; }

    /// <summary>Vacation of the server when the node becomes empty (exhaustive service, multiple vacations); null — none.</summary>
    public Distribution? Vacation { get; init; }

    public IReadOnlyList<QueueingRoute> Routes { get; init; } = [];
}

/// <summary>A queueing system or network to be simulated with GPSS and compared with queueing theory.</summary>
public sealed record QueueingModel
{
    public string Name { get; init; } = "Система массового обслуживания";

    /// <summary>Label of the model time unit (for display only).</summary>
    public string TimeUnit { get; init; } = "мин";

    /// <summary>Length of the statistics window in model time units.</summary>
    public double Duration { get; init; } = 10_000;

    /// <summary>Warm-up period discarded with RESET before statistics are collected.</summary>
    public double WarmUp { get; init; }

    /// <summary>Independent replications (different random numbers) for confidence intervals.</summary>
    public int Replications { get; init; } = 3;

    /// <summary>Base seed of the random number streams.</summary>
    public int Seed { get; init; } = 1;

    public IReadOnlyList<CustomerClass> Classes { get; init; } = [];
    public IReadOnlyList<QueueingNode> Nodes { get; init; } = [];
}
