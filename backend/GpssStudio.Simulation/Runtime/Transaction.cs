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

    /// <summary>Block the transaction will try to enter next.</summary>
    public int NextBlock { get; set; }

    /// <summary>Scheduled time while on the future events chain.</summary>
    public double MoveTime { get; set; }

    internal long ChainSequence { get; set; }
    internal bool OnFutureChain { get; set; }
    internal LinkedListNode<Transaction>? CurrentChainNode { get; set; }

    /// <summary>Remaining ADVANCE time of a preempted transaction.</summary>
    internal double? PreemptedRemainingTime { get; set; }

    /// <summary>Entry times into queues, used for queue residence statistics.</summary>
    internal Dictionary<string, double> QueueEntryTimes { get; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Units taken per queue (QUEUE A,B).</summary>
    internal Dictionary<string, int> QueueUnits { get; } = new(StringComparer.OrdinalIgnoreCase);

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
