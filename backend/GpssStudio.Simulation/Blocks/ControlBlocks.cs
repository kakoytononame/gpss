using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Runtime;
using GpssStudio.Simulation.Translation;

namespace GpssStudio.Simulation.Blocks;

public enum TransferMode
{
    Unconditional,
    Fraction,
    Both,
    All,
    Pick,
    Subroutine,
    Parameter,
}

/// <summary>TRANSFER in all common modes (unconditional, fractional, BOTH, ALL, PICK, SBR, P).</summary>
public sealed class TransferBlock : Block
{
    public required TransferMode Mode { get; init; }
    public Expr? Fraction { get; init; }
    public BlockRef? First { get; init; }
    public BlockRef? Second { get; init; }
    public Expr? Step { get; init; }
    public ParameterRef? Parameter { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var sequential = Number + 1;
        int Resolve(BlockRef? reference) => reference?.Resolve(engine, transaction) ?? sequential;

        switch (Mode)
        {
            case TransferMode.Unconditional:
                transaction.NextBlock = Resolve(Second);
                break;
            case TransferMode.Fraction:
            {
                var probability = engine.Eval(Fraction!, transaction);
                if (probability >= 1)
                {
                    probability /= 1000;
                }

                transaction.NextBlock = engine.Random(1) < probability ? Resolve(Second) : Resolve(First);
                break;
            }
            case TransferMode.Both:
            {
                var first = Resolve(First);
                transaction.NextBlock = engine.CanEnterBlock(first, transaction) ? first : Resolve(Second);
                break;
            }
            case TransferMode.All:
            {
                var from = Resolve(First);
                var to = Resolve(Second);
                var step = Step is null ? 1 : Math.Max(1, (int)engine.Eval(Step, transaction));
                transaction.NextBlock = from;
                for (var candidate = from; candidate <= to; candidate += step)
                {
                    if (engine.CanEnterBlock(candidate, transaction))
                    {
                        transaction.NextBlock = candidate;
                        break;
                    }
                }

                break;
            }
            case TransferMode.Pick:
            {
                var from = Resolve(First);
                var to = Resolve(Second);
                transaction.NextBlock = from + (int)Math.Floor(engine.Random(1) * (to - from + 1));
                break;
            }
            case TransferMode.Subroutine:
                transaction.SetParameter(Parameter!.Resolve(engine, transaction), Number);
                transaction.NextBlock = Resolve(First);
                break;
            case TransferMode.Parameter:
                transaction.NextBlock = (int)transaction.GetParameter(Parameter!.Resolve(engine, transaction)) + (Step is null ? 0 : (int)engine.Eval(Step, transaction));
                break;
        }

        return BlockOutcome.Continue;
    }
}

/// <summary>TEST R A,B[,C] — compares A and B; without C a failed test blocks the transaction.</summary>
public sealed class TestBlock : Block
{
    public required string Relation { get; init; }
    public required Expr Left { get; init; }
    public required Expr Right { get; init; }
    public BlockRef? Alternate { get; init; }

    private bool Holds(SimulationEngine engine, Transaction transaction)
    {
        var a = engine.Eval(Left, transaction);
        var b = engine.Eval(Right, transaction);
        return Relation switch
        {
            "L" => a < b,
            "LE" => a <= b,
            "E" => a == b,
            "NE" => a != b,
            "G" => a > b,
            _ => a >= b,
        };
    }

    public override bool CanEnter(SimulationEngine engine, Transaction transaction) => Alternate is not null || Holds(engine, transaction);

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        if (Alternate is not null && !Holds(engine, transaction))
        {
            transaction.NextBlock = Alternate.Resolve(engine, transaction);
        }

        return BlockOutcome.Continue;
    }
}

/// <summary>GATE X A[,B] — tests the state of a facility, storage or logic switch.</summary>
public sealed class GateBlock : Block
{
    public required string Condition { get; init; }
    public required EntityRef Entity { get; init; }
    public BlockRef? Alternate { get; init; }

    private bool Holds(SimulationEngine engine, Transaction transaction)
    {
        var name = Entity.Resolve(engine, transaction);
        return Condition switch
        {
            "U" => engine.Facility(name).IsBusy,
            "NU" => !engine.Facility(name).IsBusy,
            "I" => engine.Facility(name).InterruptChain.Count > 0,
            "NI" => engine.Facility(name).InterruptChain.Count == 0,
            "FV" => engine.Facility(name).Available,
            "FNV" => !engine.Facility(name).Available,
            "SE" => engine.Storage(name).Used == 0,
            "SNE" => engine.Storage(name).Used > 0,
            "SF" => engine.Storage(name).Remaining == 0,
            "SNF" => engine.Storage(name).Remaining > 0,
            "SV" => engine.Storage(name).Available,
            "SNV" => !engine.Storage(name).Available,
            "LS" => engine.Logic(name).IsSet,
            "LR" => !engine.Logic(name).IsSet,
            _ => throw new SimulationException($"GATE: неизвестное условие {Condition}."),
        };
    }

    public override bool CanEnter(SimulationEngine engine, Transaction transaction) => Alternate is not null || Holds(engine, transaction);

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        if (Alternate is not null && !Holds(engine, transaction))
        {
            transaction.NextBlock = Alternate.Resolve(engine, transaction);
        }

        return BlockOutcome.Continue;
    }
}
