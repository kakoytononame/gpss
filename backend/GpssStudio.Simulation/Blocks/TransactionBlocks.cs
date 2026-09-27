using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Runtime;
using GpssStudio.Simulation.Translation;

namespace GpssStudio.Simulation.Blocks;

/// <summary>GENERATE A,B,C,D,E — interval, spread, offset, limit, priority.</summary>
public sealed class GenerateBlock : Block
{
    public Expr? Interval { get; init; }
    public Expr? Spread { get; init; }
    public Expr? Offset { get; init; }
    public Expr? Limit { get; init; }
    public Expr? Priority { get; init; }

    private long _generated;

    public override void Clear() => _generated = 0;

    /// <summary>Schedules the first transaction (at START after translation or CLEAR).</summary>
    public void Prime(SimulationEngine engine) => ScheduleNext(engine, first: true);

    private void ScheduleNext(SimulationEngine engine, bool first)
    {
        var limit = Limit is null ? long.MaxValue : (long)engine.Eval(Limit, null);
        if (_generated >= limit)
        {
            return;
        }

        double time;
        if (first && Offset is not null)
        {
            time = engine.Eval(Offset, null);
        }
        else
        {
            var delay = Interval is null ? 0 : engine.Interval(Interval, Spread, null);
            if (delay < 0)
            {
                throw new SimulationException($"GENERATE (блок {Number}): отрицательный интервал {delay}.");
            }

            time = engine.AbsoluteClock + delay;
        }

        var priority = Priority is null ? 0 : (int)engine.Eval(Priority, null);
        var transaction = engine.CreateTransaction(priority);
        transaction.NextBlock = Number;
        engine.ScheduleFuture(transaction, time);
        _generated++;
    }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        transaction.MarkTime = engine.AbsoluteClock;
        ScheduleNext(engine, first: false);
        return BlockOutcome.Continue;
    }
}

/// <summary>TERMINATE A — destroys the transaction and decrements the termination count by A.</summary>
public sealed class TerminateBlock : Block
{
    public Expr? Count { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var count = Count is null ? 0 : (int)engine.Eval(Count, transaction);
        engine.DestroyTransaction(transaction);
        engine.DecrementTerminationCount(count);
        return BlockOutcome.Terminated;
    }
}

/// <summary>ADVANCE A,B — delays the transaction by A±B (or A×FN if B is a function).</summary>
public sealed class AdvanceBlock : Block
{
    public Expr? Time { get; init; }
    public Expr? Spread { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var delay = Time is null ? 0 : engine.Interval(Time, Spread, transaction);
        if (delay < 0)
        {
            throw new SimulationException($"ADVANCE (блок {Number}): отрицательное время задержки {delay}.");
        }

        if (delay == 0)
        {
            return BlockOutcome.Continue;
        }

        engine.ScheduleFuture(transaction, engine.AbsoluteClock + delay);
        return BlockOutcome.Suspended;
    }
}

/// <summary>TERMINATE-less copy: SPLIT A,B,C.</summary>
public sealed class SplitBlock : Block
{
    public required Expr Count { get; init; }
    public required BlockRef Destination { get; init; }
    public ParameterRef? SerialParameter { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var count = (int)engine.Eval(Count, transaction);
        var destination = Destination.Resolve(engine, transaction);
        var serialName = SerialParameter?.Resolve(engine, transaction);
        var serialBase = serialName is null ? 0 : transaction.GetParameter(serialName);

        if (serialName is not null)
        {
            transaction.SetParameter(serialName, serialBase + 1);
        }

        for (var i = 1; i <= count; i++)
        {
            var copy = engine.CreateTransaction(transaction.Priority);
            copy.AssemblySet = transaction.AssemblySet;
            copy.MarkTime = transaction.MarkTime;
            copy.CopyParametersFrom(transaction);
            if (serialName is not null)
            {
                copy.SetParameter(serialName, serialBase + 1 + i);
            }

            copy.CurrentBlock = Number;
            CurrentCount++;
            copy.NextBlock = destination;
            engine.AddToCurrentChain(copy);
        }

        return BlockOutcome.Continue;
    }
}

/// <summary>ASSEMBLE A — the first member of an assembly set waits for A members, the others are destroyed.</summary>
public sealed class AssembleBlock : Block
{
    public required Expr Count { get; init; }
    private readonly Dictionary<int, (Transaction First, int Remaining)> _pending = [];

    public override void Clear() => _pending.Clear();

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        if (!_pending.TryGetValue(transaction.AssemblySet, out var entry))
        {
            var remaining = (int)engine.Eval(Count, transaction) - 1;
            if (remaining <= 0)
            {
                return BlockOutcome.Continue;
            }

            _pending[transaction.AssemblySet] = (transaction, remaining);
            engine.RemoveFromCurrentChain(transaction);
            return BlockOutcome.Suspended;
        }

        entry.Remaining--;
        engine.DestroyTransaction(transaction);

        if (entry.Remaining <= 0)
        {
            _pending.Remove(transaction.AssemblySet);
            entry.First.NextBlock = Number + 1;
            engine.AddToCurrentChain(entry.First);
        }
        else
        {
            _pending[transaction.AssemblySet] = entry;
        }

        return BlockOutcome.Terminated;
    }
}

/// <summary>GATHER A — members of an assembly set wait until A of them have arrived.</summary>
public sealed class GatherBlock : Block
{
    public required Expr Count { get; init; }
    private readonly Dictionary<int, List<Transaction>> _pending = [];

    public override void Clear() => _pending.Clear();

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var required = (int)engine.Eval(Count, transaction);
        if (!_pending.TryGetValue(transaction.AssemblySet, out var members))
        {
            members = [];
            _pending[transaction.AssemblySet] = members;
        }

        members.Add(transaction);
        if (members.Count < required)
        {
            engine.RemoveFromCurrentChain(transaction);
            return BlockOutcome.Suspended;
        }

        _pending.Remove(transaction.AssemblySet);
        foreach (var member in members.Where(member => member != transaction))
        {
            member.NextBlock = Number + 1;
            engine.AddToCurrentChain(member);
        }

        return BlockOutcome.Continue;
    }
}

/// <summary>MARK A — records the current time as mark time or in parameter A.</summary>
public sealed class MarkBlock : Block
{
    public ParameterRef? Parameter { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        if (Parameter is null)
        {
            transaction.MarkTime = engine.AbsoluteClock;
        }
        else
        {
            transaction.SetParameter(Parameter.Resolve(engine, transaction), engine.AbsoluteClock);
        }

        return BlockOutcome.Continue;
    }
}

public sealed class PriorityBlock : Block
{
    public required Expr Value { get; init; }
    public bool Buffer { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        transaction.Priority = (int)engine.Eval(Value, transaction);
        engine.RepositionInCurrentChain(transaction);
        return Buffer ? BlockOutcome.Yield : BlockOutcome.Continue;
    }
}

/// <summary>ASSIGN A[+|-],B — sets, increments or decrements a parameter.</summary>
public sealed class AssignBlock : Block
{
    public required ParameterRef Parameter { get; init; }
    public required Expr Value { get; init; }
    public char Mode { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var name = Parameter.Resolve(engine, transaction);
        var value = engine.Eval(Value, transaction);
        var current = transaction.GetParameter(name);
        transaction.SetParameter(name, Mode switch { '+' => current + value, '-' => current - value, _ => value });
        return BlockOutcome.Continue;
    }
}

/// <summary>INDEX A,B — P1 = PA + B.</summary>
public sealed class IndexBlock : Block
{
    public required ParameterRef Parameter { get; init; }
    public required Expr Value { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        transaction.SetParameter("1", transaction.GetParameter(Parameter.Resolve(engine, transaction)) + engine.Eval(Value, transaction));
        return BlockOutcome.Continue;
    }
}

public sealed class AdoptBlock : Block
{
    public required Expr AssemblySet { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        transaction.AssemblySet = (int)engine.Eval(AssemblySet, transaction);
        return BlockOutcome.Continue;
    }
}

/// <summary>LOOP A,B — decrements parameter A and goes to B while it is positive.</summary>
public sealed class LoopBlock : Block
{
    public required ParameterRef Parameter { get; init; }
    public required BlockRef Destination { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var name = Parameter.Resolve(engine, transaction);
        var value = transaction.GetParameter(name) - 1;
        transaction.SetParameter(name, value);
        if (value > 0)
        {
            transaction.NextBlock = Destination.Resolve(engine, transaction);
        }

        return BlockOutcome.Continue;
    }
}

public sealed class BufferBlock : Block
{
    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction) => BlockOutcome.Yield;
}
