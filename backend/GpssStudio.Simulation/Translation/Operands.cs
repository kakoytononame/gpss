using System.Globalization;
using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Runtime;

namespace GpssStudio.Simulation.Translation;

/// <summary>Operand naming an entity: a literal name/number or an expression giving its number.</summary>
public sealed class EntityRef
{
    private readonly string? _name;
    private readonly Expr? _expression;

    private EntityRef(string? name, Expr? expression)
    {
        _name = name;
        _expression = expression;
    }

    public string Text => _name ?? "(выражение)";

    public string? LiteralName => _name;

    public static EntityRef Parse(string operand)
    {
        var text = operand.Trim();
        if (IsPlainName(text))
        {
            return new EntityRef(text, null);
        }

        return new EntityRef(null, ExpressionParser.Parse(text));
    }

    /// <summary>The literal name, or the entity number computed by the expression (entities are keyed by number).</summary>
    public string Resolve(SimulationEngine engine, Transaction? transaction) =>
        _name ?? ((long)Math.Round(_expression!.Evaluate(engine, transaction))).ToString(CultureInfo.InvariantCulture);

    /// <summary>Literal names and numbers are used directly as entity names.</summary>
    public static bool IsPlainName(string text) =>
        text.Length > 0 && (char.IsLetter(text[0]) || text[0] == '_' || char.IsDigit(text[0])) && text.All(ch => char.IsLetterOrDigit(ch) || ch == '_')
        && !text.Contains('$');
}

/// <summary>Operand naming a block: a label resolved during translation or an expression.</summary>
public sealed class BlockRef
{
    private readonly int? _number;
    private readonly Expr? _expression;

    private BlockRef(int? number, Expr? expression, string text)
    {
        _number = number;
        _expression = expression;
        Text = text;
    }

    public string Text { get; }

    public static BlockRef Parse(string operand, IReadOnlyDictionary<string, int> labels)
    {
        var text = operand.Trim();
        if (labels.TryGetValue(text, out var number))
        {
            return new BlockRef(number, null, text);
        }

        if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out number))
        {
            return new BlockRef(number, null, text);
        }

        if (EntityRef.IsPlainName(text))
        {
            throw new FormatException($"Метка \"{text}\" не определена.");
        }

        return new BlockRef(null, ExpressionParser.Parse(text), text);
    }

    public int Resolve(SimulationEngine engine, Transaction transaction) =>
        _number ?? (int)Math.Round(_expression!.Evaluate(engine, transaction));
}

/// <summary>Operand naming a transaction parameter: <c>P1</c>, <c>1</c>, <c>COUNT</c> or an expression.</summary>
public sealed class ParameterRef
{
    private readonly string? _name;
    private readonly Expr? _expression;

    private ParameterRef(string? name, Expr? expression)
    {
        _name = name;
        _expression = expression;
    }

    public static ParameterRef Parse(string operand)
    {
        var text = operand.Trim();
        if (text.StartsWith("P$", StringComparison.OrdinalIgnoreCase))
        {
            text = text[2..];
        }

        return EntityRef.IsPlainName(text) ? new ParameterRef(text, null) : new ParameterRef(null, ExpressionParser.Parse(text));
    }

    public string Resolve(SimulationEngine engine, Transaction transaction) =>
        _name ?? ((int)Math.Round(_expression!.Evaluate(engine, transaction))).ToString(CultureInfo.InvariantCulture);
}
