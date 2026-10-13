using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Runtime;
using GpssStudio.Simulation.Translation;

namespace GpssStudio.Simulation.Blocks;

/// <summary>Conditional operators shared by COUNT, SELECT, REMOVE, SCAN and ALTER.</summary>
public static class ConditionOperators
{
    /// <summary>Logical operators of COUNT / SELECT; each implies the entity type.</summary>
    public static readonly HashSet<string> Logical = new(StringComparer.OrdinalIgnoreCase)
    {
        "FNV", "FV", "I", "NI", "NU", "U", "SE", "SF", "SNE", "SNF", "SNV", "SV", "LS", "LR",
    };

    public static readonly HashSet<string> Relational = new(StringComparer.OrdinalIgnoreCase) { "E", "NE", "G", "GE", "L", "LE", "MIN", "MAX" };

    public static bool Compare(string relation, double a, double b) => relation switch
    {
        "E" => a == b,
        "NE" => a != b,
        "G" => a > b,
        "GE" => a >= b,
        "L" => a < b,
        "LE" => a <= b,
        _ => throw new SimulationException($"неизвестный оператор отношения {relation}."),
    };

    /// <summary>State test of entity <paramref name="number"/> for a logical operator.</summary>
    public static bool Logic(SimulationEngine engine, string condition, string number) => condition switch
    {
        "U" => engine.Facility(number).IsBusy,
        "NU" => !engine.Facility(number).IsBusy,
        "I" => engine.Facility(number).InterruptChain.Count > 0,
        "NI" => engine.Facility(number).InterruptChain.Count == 0,
        "FV" => engine.Facility(number).Available,
        "FNV" => !engine.Facility(number).Available,
        "SE" => engine.Storage(number).Used == 0,
        "SNE" => engine.Storage(number).Used > 0,
        "SF" => engine.Storage(number).Remaining == 0,
        "SNF" => engine.Storage(number).Remaining > 0,
        "SV" => engine.Storage(number).Available,
        "SNV" => !engine.Storage(number).Available,
        "LS" => engine.Logic(number).IsSet,
        "LR" => !engine.Logic(number).IsSet,
        _ => throw new SimulationException($"неизвестное условие {condition}."),
    };
}

/// <summary>MSAVEVALUE A[+|-],B,C,D — assigns, adds to or subtracts from a matrix cell.</summary>
public sealed class MsavevalueBlock : EntityBlock
{
    public required Expr Row { get; init; }
    public required Expr Column { get; init; }
    public required Expr Value { get; init; }
    public char Mode { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var matrix = engine.Matrix(EntityName(engine, transaction));
        var row = MatrixCellExpr.Index(Row, engine, transaction);
        var column = MatrixCellExpr.Index(Column, engine, transaction);
        var value = engine.Eval(Value, transaction);
        matrix[row, column] = Mode switch { '+' => matrix[row, column] + value, '-' => matrix[row, column] - value, _ => value };
        engine.NotifyStatusChange();
        return BlockOutcome.Continue;
    }
}

/// <summary>Range scan of COUNT and SELECT: entities B..C tested with a logical operator or with SNA class E against D.</summary>
public abstract class EntityRangeBlock : Block
{
    public required string Condition { get; init; }
    public required ParameterRef Parameter { get; init; }
    public required Expr From { get; init; }
    public required Expr To { get; init; }
    public Expr? Reference { get; init; }
    public string? SnaClass { get; init; }

    protected IEnumerable<(int Number, double Value)> Candidates(SimulationEngine engine, Transaction transaction)
    {
        var from = (int)Math.Round(engine.Eval(From, transaction));
        var to = (int)Math.Round(engine.Eval(To, transaction));
        if (from < 1 || to < from)
        {
            throw new SimulationException($"{Operation}: неверный диапазон объектов {from}..{to}.");
        }

        for (var number = from; number <= to; number++)
        {
            var text = number.ToString(System.Globalization.CultureInfo.InvariantCulture);
            if (ConditionOperators.Logical.Contains(Condition))
            {
                yield return (number, ConditionOperators.Logic(engine, Condition, text) ? 1 : 0);
            }
            else
            {
                yield return (number, engine.Sna(SnaClass ?? throw new SimulationException($"{Operation}: не задан класс СЧА (операнд E)."), text, transaction));
            }
        }
    }

    protected bool Matches(SimulationEngine engine, Transaction transaction, double value) =>
        ConditionOperators.Logical.Contains(Condition)
            ? value != 0
            : ConditionOperators.Compare(Condition, value, engine.Eval(Reference ?? throw new SimulationException($"{Operation}: не задано контрольное значение (операнд D)."), transaction));
}

/// <summary>COUNT O A,B,C,D,E — number of entities in B..C satisfying the condition, into parameter A.</summary>
public sealed class CountBlock : EntityRangeBlock
{
    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var count = Candidates(engine, transaction).Count(candidate => Matches(engine, transaction, candidate.Value));
        transaction.SetParameter(Parameter.Resolve(engine, transaction), count);
        return BlockOutcome.Continue;
    }
}

/// <summary>SELECT O A,B,C,D,E,F — number of the first entity satisfying the condition (or with MIN/MAX of SNA E).</summary>
public sealed class SelectBlock : EntityRangeBlock
{
    public BlockRef? Alternate { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var selected = 0;
        if (Condition is "MIN" or "MAX")
        {
            double? best = null;
            foreach (var (number, value) in Candidates(engine, transaction))
            {
                if (best is null || (Condition == "MIN" ? value < best : value > best))
                {
                    best = value;
                    selected = number;
                }
            }
        }
        else
        {
            selected = Candidates(engine, transaction).FirstOrDefault(candidate => Matches(engine, transaction, candidate.Value)).Number;
        }

        transaction.SetParameter(Parameter.Resolve(engine, transaction), selected);
        if (selected == 0 && Alternate is not null)
        {
            transaction.NextBlock = Alternate.Resolve(engine, transaction);
        }

        return BlockOutcome.Continue;
    }
}

/// <summary>DISPLACE A,B,C,D — moves transaction A to block B; residual ADVANCE time goes to parameter C.</summary>
public sealed class DisplaceBlock : Block
{
    public required Expr Target { get; init; }
    public required BlockRef Destination { get; init; }
    public ParameterRef? ResidualParameter { get; init; }
    public BlockRef? Alternate { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var number = (int)Math.Round(engine.Eval(Target, transaction));
        var target = engine.FindTransaction(number);
        if (target is null)
        {
            if (Alternate is not null)
            {
                transaction.NextBlock = Alternate.Resolve(engine, transaction);
            }

            return BlockOutcome.Continue;
        }

        var destination = Destination.Resolve(engine, transaction);
        if (target == transaction)
        {
            transaction.NextBlock = destination;
            return BlockOutcome.Continue;
        }

        var residual = engine.Displace(target, destination);
        if (ResidualParameter is not null && residual is { } time)
        {
            transaction.SetParameter(ResidualParameter.Resolve(engine, transaction), time);
        }

        return BlockOutcome.Continue;
    }
}

/// <summary>MATCH A — waits until a member of the same assembly set reaches the conjugate MATCH block A.</summary>
public sealed class MatchBlock : Block
{
    public required BlockRef Conjugate { get; init; }
    private readonly List<Transaction> _waiting = [];

    public override void Clear() => _waiting.Clear();

    public bool HasWaitingFamilyMember(Transaction transaction) => _waiting.Any(member => member.AssemblySet == transaction.AssemblySet);

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        if (engine.Blocks[Conjugate.Resolve(engine, transaction) - 1] is not MatchBlock conjugate)
        {
            throw new SimulationException("операнд A должен указывать на сопряжённый блок MATCH.");
        }

        var partner = conjugate._waiting.FirstOrDefault(member => member.AssemblySet == transaction.AssemblySet && member != transaction);
        if (partner is null)
        {
            _waiting.Add(transaction);
            engine.RemoveFromCurrentChain(transaction);
            return BlockOutcome.Suspended;
        }

        conjugate._waiting.Remove(partner);
        partner.NextBlock = conjugate.Number + 1;
        engine.AddToCurrentChain(partner);
        return BlockOutcome.Continue;
    }
}

/// <summary>PLUS A,B — evaluates expression A and optionally stores it in parameter B.</summary>
public sealed class PlusBlock : Block
{
    public required Expr Expression { get; init; }
    public ParameterRef? Parameter { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var value = engine.Eval(Expression, transaction);
        if (Parameter is not null)
        {
            transaction.SetParameter(Parameter.Resolve(engine, transaction), value);
        }

        engine.NotifyStatusChange();
        return BlockOutcome.Continue;
    }
}

/// <summary>EXECUTE A — performs the action of block A, then continues after EXECUTE unless block A redirected the transaction.</summary>
public sealed class ExecuteBlock : Block
{
    public required BlockRef Target { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var number = Target.Resolve(engine, transaction);
        if (number < 1 || number > engine.Blocks.Count)
        {
            throw new SimulationException($"блок {number} не существует.");
        }

        var target = engine.Blocks[number - 1];
        if (target is ExecuteBlock)
        {
            throw new SimulationException("EXECUTE не может выполнять другой блок EXECUTE.");
        }

        transaction.NextBlock = target.Number + 1;
        var outcome = target.Execute(engine, transaction);
        if (transaction.NextBlock == target.Number + 1)
        {
            transaction.NextBlock = Number + 1;
        }

        return outcome;
    }
}

/// <summary>TRACE / UNTRACE — switch the trace indicator of the active transaction.</summary>
public sealed class TraceBlock : Block
{
    public required bool Enable { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        transaction.Traced = Enable;
        return BlockOutcome.Continue;
    }
}
