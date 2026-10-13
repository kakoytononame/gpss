namespace GpssStudio.Simulation.Runtime;

/// <summary>A GPSS transaction (XN).</summary>
public sealed class Transaction
{
    private readonly Dictionary<string, double> _parameters = new(StringComparer.OrdinalIgnoreCase);

    public required int Number { get; init; }
    public int AssemblySet { get; set; }
    public int Priority { get; set; }
    public double MarkTime { get; set; }

    /// <summary>Block the transaction is currently in (0 before it enters GENERATE).</summary>
    public int CurrentBlock { get; set; }

    /// <summary>Trace indicator (TRACE / UNTRACE).</summary>
    public bool Traced { get; set; }

    /// <summary>Block the transaction will try to enter next.</summary>
    public int NextBlock { get; set; }

    /// <summary>Scheduled time while on the future events chain.</summary>
    public double MoveTime { get; set; }

    internal long ChainSequence { get; set; }
    internal bool OnFutureChain { get; set; }
    internal LinkedListNode<Transaction>? CurrentChainNode { get; set; }

    /// <summary>Remaining ADVANCE time of a preempted transaction.</summary>
    internal double? PreemptedRemainingTime { get; set; }

    /// <summary>Entry times into queues (by queue number), used for queue residence statistics.</summary>
    internal Dictionary<int, double> QueueEntryTimes { get; } = [];

    /// <summary>Units taken per queue number (QUEUE A,B).</summary>
    internal Dictionary<int, int> QueueUnits { get; } = [];

    /// <summary>Time the transaction was linked to its current user chain.</summary>
    internal double UserChainEntryTime { get; set; }

    /// <summary>Transaction groups the transaction belongs to.</summary>
    internal HashSet<TransactionGroup> Groups { get; } = [];

    public IReadOnlyDictionary<string, double> Parameters => _parameters;

    public double GetParameter(string name) => _parameters.GetValueOrDefault(name);

    public void SetParameter(string name, double value) => _parameters[name] = value;

    public void CopyParametersFrom(Transaction source)
    {
        foreach (var (key, value) in source._parameters)
        {
            _parameters[key] = value;
        }
    }
}
