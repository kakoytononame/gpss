using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Runtime;
using GpssStudio.Simulation.Translation;

namespace GpssStudio.Simulation.Blocks;

public abstract class EntityBlock : Block
{
    public required EntityRef Entity { get; init; }

    protected string EntityName(SimulationEngine engine, Transaction transaction) => Entity.Resolve(engine, transaction);
}

public abstract class UnitsBlock : EntityBlock
{
    public Expr? Units { get; init; }

    protected int UnitsOf(SimulationEngine engine, Transaction transaction)
    {
        var units = Units is null ? 1 : (int)engine.Eval(Units, transaction);
        return units > 0 ? units : throw new SimulationException($"{Operation} (блок {Number}): число единиц должно быть положительным.");
    }
}

public sealed class SeizeBlock : EntityBlock
{
    public override bool CanEnter(SimulationEngine engine, Transaction transaction)
    {
        var facility = engine.Facility(EntityName(engine, transaction));
        return facility.Available && facility.Owner is null;
    }

    public override void OnRefused(SimulationEngine engine, Transaction transaction) =>
        engine.WaitOnFacility(transaction, engine.Facility(EntityName(engine, transaction)));

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        engine.SeizeFacility(engine.Facility(EntityName(engine, transaction)), transaction);
        return BlockOutcome.Continue;
    }
}

public sealed class ReleaseBlock : EntityBlock
{
    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        engine.ReleaseFacility(engine.Facility(EntityName(engine, transaction)), transaction);
        return BlockOutcome.Continue;
    }
}

/// <summary>PREEMPT A[,PR] — takes the facility even if it is busy (interrupt or priority mode).</summary>
public sealed class PreemptBlock : EntityBlock
{
    public bool PriorityMode { get; init; }

    public override bool CanEnter(SimulationEngine engine, Transaction transaction)
    {
        var facility = engine.Facility(EntityName(engine, transaction));
        if (!facility.Available)
        {
            return false;
        }

        if (facility.Owner is null)
        {
            return true;
        }

        return PriorityMode ? transaction.Priority > facility.Owner.Priority : facility.InterruptChain.Count == 0;
    }

    public override void OnRefused(SimulationEngine engine, Transaction transaction) =>
        engine.WaitOnFacility(transaction, engine.Facility(EntityName(engine, transaction)));

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        engine.PreemptFacility(engine.Facility(EntityName(engine, transaction)), transaction);
        return BlockOutcome.Continue;
    }
}

public sealed class ReturnBlock : EntityBlock
{
    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        engine.ReturnFacility(engine.Facility(EntityName(engine, transaction)), transaction);
        return BlockOutcome.Continue;
    }
}

public sealed class FacilityAvailabilityBlock : EntityBlock
{
    public required bool MakeAvailable { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        engine.SetFacilityAvailability(engine.Facility(EntityName(engine, transaction)), MakeAvailable);
        return BlockOutcome.Continue;
    }
}

public sealed class QueueBlock : UnitsBlock
{
    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        engine.JoinQueue(engine.Queue(EntityName(engine, transaction)), transaction, UnitsOf(engine, transaction));
        return BlockOutcome.Continue;
    }
}

public sealed class DepartBlock : UnitsBlock
{
    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        engine.DepartQueue(engine.Queue(EntityName(engine, transaction)), transaction, UnitsOf(engine, transaction));
        return BlockOutcome.Continue;
    }
}

public sealed class EnterBlock : UnitsBlock
{
    public override bool CanEnter(SimulationEngine engine, Transaction transaction)
    {
        var storage = engine.Storage(EntityName(engine, transaction));
        var units = UnitsOf(engine, transaction);
        if (units > storage.Capacity)
        {
            throw new SimulationException($"ENTER (блок {Number}): запрошено {units} единиц, ёмкость памяти {storage.Name} — {storage.Capacity}.");
        }

        return storage.Available && storage.Remaining >= units;
    }

    public override void OnRefused(SimulationEngine engine, Transaction transaction) =>
        engine.WaitOnStorage(transaction, engine.Storage(EntityName(engine, transaction)), UnitsOf(engine, transaction));

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        engine.EnterStorage(engine.Storage(EntityName(engine, transaction)), UnitsOf(engine, transaction));
        return BlockOutcome.Continue;
    }
}

public sealed class LeaveBlock : UnitsBlock
{
    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        engine.LeaveStorage(engine.Storage(EntityName(engine, transaction)), UnitsOf(engine, transaction));
        return BlockOutcome.Continue;
    }
}

public sealed class StorageAvailabilityBlock : EntityBlock
{
    public required bool MakeAvailable { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        engine.SetStorageAvailability(engine.Storage(EntityName(engine, transaction)), MakeAvailable);
        return BlockOutcome.Continue;
    }
}

/// <summary>SAVEVALUE A[+|-],B.</summary>
public sealed class SavevalueBlock : EntityBlock
{
    public required Expr Value { get; init; }
    public char Mode { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var savevalue = engine.Savevalue(EntityName(engine, transaction));
        var value = engine.Eval(Value, transaction);
        savevalue.Value = Mode switch { '+' => savevalue.Value + value, '-' => savevalue.Value - value, _ => value };
        engine.NotifyStatusChange();
        return BlockOutcome.Continue;
    }
}

/// <summary>LOGIC S|R|I A.</summary>
public sealed class LogicBlock : EntityBlock
{
    public required string Mode { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var logicSwitch = engine.Logic(EntityName(engine, transaction));
        logicSwitch.IsSet = Mode switch { "S" => true, "R" => false, _ => !logicSwitch.IsSet };
        engine.NotifyStatusChange();
        return BlockOutcome.Continue;
    }
}

public sealed class TabulateBlock : EntityBlock
{
    public Expr? Weight { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var table = engine.Table(EntityName(engine, transaction));
        table.Add(engine.Eval(table.Argument, transaction), Weight is null ? 1 : engine.Eval(Weight, transaction));
        return BlockOutcome.Continue;
    }
}

/// <summary>LINK A,B[,C] — places the transaction on user chain A in FIFO, LIFO or parameter order.</summary>
public sealed class LinkBlock : EntityBlock
{
    public required string Order { get; init; }
    public BlockRef? Alternate { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var chain = engine.UserChain(EntityName(engine, transaction));
        if (Alternate is not null && !chain.LinkIndicator)
        {
            chain.LinkIndicator = true;
            transaction.NextBlock = Alternate.Resolve(engine, transaction);
            return BlockOutcome.Continue;
        }

        engine.LinkToUserChain(chain, transaction, Order);
        return BlockOutcome.Suspended;
    }
}

/// <summary>UNLINK A,B,C[,D,E,F] — moves up to C transactions (or ALL) from user chain A to block B.</summary>
public sealed class UnlinkBlock : EntityBlock
{
    public required BlockRef Destination { get; init; }
    public Expr? Count { get; init; }
    public BlockRef? Alternate { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var chain = engine.UserChain(EntityName(engine, transaction));
        var limit = Count is null ? int.MaxValue : (int)engine.Eval(Count, transaction);
        var destination = Destination.Resolve(engine, transaction);
        var moved = engine.UnlinkFromUserChain(chain, limit, destination);

        if (moved == 0 && Alternate is not null)
        {
            transaction.NextBlock = Alternate.Resolve(engine, transaction);
        }

        return BlockOutcome.Continue;
    }
}
