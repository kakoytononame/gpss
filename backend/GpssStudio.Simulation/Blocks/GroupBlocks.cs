using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Runtime;
using GpssStudio.Simulation.Translation;

namespace GpssStudio.Simulation.Blocks;

/// <summary>Transaction attribute operand of REMOVE / SCAN / ALTER: <c>PR</c> or a parameter.</summary>
public sealed class MemberAttribute
{
    private readonly ParameterRef? _parameter;

    private MemberAttribute(ParameterRef? parameter)
    {
        _parameter = parameter;
    }

    public bool IsPriority => _parameter is null;

    public static MemberAttribute Parse(string operand) =>
        operand.Trim().Equals("PR", StringComparison.OrdinalIgnoreCase) ? new MemberAttribute(null) : new MemberAttribute(ParameterRef.Parse(operand));

    public double Read(SimulationEngine engine, Transaction active, Transaction member) =>
        _parameter is null ? member.Priority : member.GetParameter(_parameter.Resolve(engine, active));

    public void Write(SimulationEngine engine, Transaction active, Transaction member, double value)
    {
        if (_parameter is null)
        {
            member.Priority = (int)value;
            engine.RepositionInCurrentChain(member);
        }
        else
        {
            member.SetParameter(_parameter.Resolve(engine, active), value);
        }
    }
}

/// <summary>Selection of transaction-group members shared by REMOVE, SCAN and ALTER.</summary>
public abstract class GroupScanBlock : EntityBlock
{
    public string? Condition { get; init; }
    public MemberAttribute? Tested { get; init; }
    public Expr? Reference { get; init; }
    public BlockRef? Alternate { get; init; }

    /// <summary>Members passing the test, in group order (MIN / MAX yield the single extreme member).</summary>
    protected List<Transaction> SelectMembers(SimulationEngine engine, Transaction active, TransactionGroup group)
    {
        if (Condition is null || Tested is null)
        {
            return group.Members.ToList();
        }

        if (Condition is "MIN" or "MAX")
        {
            Transaction? best = null;
            var bestValue = 0.0;
            foreach (var member in group.Members)
            {
                var value = Tested.Read(engine, active, member);
                if (best is null || (Condition == "MIN" ? value < bestValue : value > bestValue))
                {
                    best = member;
                    bestValue = value;
                }
            }

            return best is null ? [] : [best];
        }

        var reference = engine.Eval(Reference ?? throw new SimulationException($"{Operation}: не задано контрольное значение."), active);
        return group.Members.Where(member => ConditionOperators.Compare(Condition, Tested.Read(engine, active, member), reference)).ToList();
    }

    protected BlockOutcome GoAlternate(SimulationEngine engine, Transaction transaction)
    {
        if (Alternate is not null)
        {
            transaction.NextBlock = Alternate.Resolve(engine, transaction);
        }

        return BlockOutcome.Continue;
    }
}

/// <summary>JOIN A[,B] — adds value B to numeric group A, or the active transaction to transaction group A.</summary>
public sealed class JoinBlock : EntityBlock
{
    public Expr? Value { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var name = EntityName(engine, transaction);
        if (Value is not null)
        {
            engine.NumericGroup(name).Members.Add(engine.Eval(Value, transaction));
        }
        else
        {
            var group = engine.TransactionGroup(name);
            if (transaction.Groups.Add(group))
            {
                group.Members.Add(transaction);
            }
        }

        engine.NotifyStatusChange();
        return BlockOutcome.Continue;
    }
}

/// <summary>EXAMINE A[,B],C — tests membership of value B (or of the active transaction) in group A.</summary>
public sealed class ExamineBlock : EntityBlock
{
    public Expr? Value { get; init; }
    public required BlockRef Alternate { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var name = EntityName(engine, transaction);
        var member = Value is not null
            ? engine.NumericGroup(name).Members.Contains(engine.Eval(Value, transaction))
            : transaction.Groups.Contains(engine.TransactionGroup(name));

        if (!member)
        {
            transaction.NextBlock = Alternate.Resolve(engine, transaction);
        }

        return BlockOutcome.Continue;
    }
}

/// <summary>REMOVE O A,B,C,D,E,F — removes value C from a numeric group or selected transactions from a transaction group.</summary>
public sealed class RemoveBlock : GroupScanBlock
{
    public Expr? Limit { get; init; }
    public Expr? Value { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var name = EntityName(engine, transaction);
        if (Value is not null)
        {
            return engine.NumericGroup(name).Members.Remove(engine.Eval(Value, transaction)) ? BlockOutcome.Continue : GoAlternate(engine, transaction);
        }

        var group = engine.TransactionGroup(name);
        if (Condition is null && Tested is null)
        {
            // Simplest form: the active transaction leaves the group.
            if (!transaction.Groups.Remove(group))
            {
                return GoAlternate(engine, transaction);
            }

            group.Members.Remove(transaction);
            return BlockOutcome.Continue;
        }

        var limit = Limit is null ? int.MaxValue : (int)engine.Eval(Limit, transaction);
        var removed = 0;
        foreach (var member in SelectMembers(engine, transaction, group).Take(limit))
        {
            group.Members.Remove(member);
            member.Groups.Remove(group);
            removed++;
        }

        engine.NotifyStatusChange();
        return removed == 0 || (Limit is not null && removed < limit) ? GoAlternate(engine, transaction) : BlockOutcome.Continue;
    }
}

/// <summary>SCAN O A,B,C,D,E,F — copies attribute D of the first matching member of group A into parameter E.</summary>
public sealed class ScanBlock : GroupScanBlock
{
    public required MemberAttribute Source { get; init; }
    public required ParameterRef Target { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var group = engine.TransactionGroup(EntityName(engine, transaction));
        var member = SelectMembers(engine, transaction, group).FirstOrDefault();
        if (member is null)
        {
            return GoAlternate(engine, transaction);
        }

        transaction.SetParameter(Target.Resolve(engine, transaction), Source.Read(engine, transaction, member));
        return BlockOutcome.Continue;
    }
}

/// <summary>ALTER O A,B,C,D,E,F,G — sets attribute C to D for up to B matching members of group A.</summary>
public sealed class AlterBlock : GroupScanBlock
{
    public Expr? Limit { get; init; }
    public required MemberAttribute Changed { get; init; }
    public required Expr Value { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var group = engine.TransactionGroup(EntityName(engine, transaction));
        var limit = Limit is null ? int.MaxValue : (int)engine.Eval(Limit, transaction);
        var value = engine.Eval(Value, transaction);
        var altered = 0;
        foreach (var member in SelectMembers(engine, transaction, group).Take(limit))
        {
            Changed.Write(engine, transaction, member, value);
            altered++;
        }

        engine.NotifyStatusChange();
        return altered == 0 || (Limit is not null && altered < limit) ? GoAlternate(engine, transaction) : BlockOutcome.Continue;
    }
}
