using GpssStudio.Simulation.Runtime;

namespace GpssStudio.Simulation.Blocks;

public enum BlockOutcome
{
    /// <summary>Move on to <see cref="Transaction.NextBlock"/> in the same scan.</summary>
    Continue,

    /// <summary>The transaction left the current events chain (FEC, delay chain, user chain...).</summary>
    Suspended,

    /// <summary>The transaction was destroyed.</summary>
    Terminated,

    /// <summary>BUFFER: stay active but let other transactions of the same priority move first.</summary>
    Yield,
}

public abstract class Block
{
    public int Number { get; internal set; }
    public string? Label { get; init; }
    public int Line { get; init; }
    public required string Operation { get; init; }
    public string OperandText { get; init; } = string.Empty;

    public long EntryCount { get; internal set; }
    public int CurrentCount { get; internal set; }

    /// <summary>Checks whether the transaction may enter; must not change state.</summary>
    public virtual bool CanEnter(SimulationEngine engine, Transaction transaction) => true;

    /// <summary>Called when entry was refused. By default the transaction stays on the current events chain.</summary>
    public virtual void OnRefused(SimulationEngine engine, Transaction transaction)
    {
    }

    /// <summary>Performs the block action. <see cref="Transaction.NextBlock"/> is preset to the following block.</summary>
    public abstract BlockOutcome Execute(SimulationEngine engine, Transaction transaction);

    /// <summary>Clears run state kept by the block (CLEAR).</summary>
    public virtual void Clear()
    {
    }
}
