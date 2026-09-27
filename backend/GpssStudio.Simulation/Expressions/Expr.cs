namespace GpssStudio.Simulation.Expressions;

/// <summary>Evaluation services provided by the simulation engine.</summary>
public interface IEvaluationContext
{
    /// <summary>Value of a standard numerical attribute such as <c>Q$BUF</c>, <c>P$NAME</c>, <c>RN1</c>, <c>AC1</c>.</summary>
    double Sna(string family, string argument, Runtime.Transaction? transaction);

    /// <summary>Number assigned to a bare name: EQU constant, block label or entity name.</summary>
    double NameValue(string name);

    /// <summary>Uniform random number in [0, 1) from the given stream.</summary>
    double Random(int stream);
}

public abstract class Expr
{
    public abstract double Evaluate(IEvaluationContext context, Runtime.Transaction? transaction);

    /// <summary>The expression is a single name (no operators), e.g. an entity reference.</summary>
    public virtual string? AsName() => null;

    /// <summary>The expression is a literal constant.</summary>
    public virtual double? AsConstant() => null;
}

public sealed class NumberExpr(double value) : Expr
{
    public double Value { get; } = value;

    public override double Evaluate(IEvaluationContext context, Runtime.Transaction? transaction) => Value;

    public override double? AsConstant() => Value;
}

public sealed class NameExpr(string name) : Expr
{
    public string Name { get; } = name;

    public override double Evaluate(IEvaluationContext context, Runtime.Transaction? transaction) => context.NameValue(Name);

    public override string? AsName() => Name;
}

public sealed class SnaExpr(string family, string argument) : Expr
{
    public string Family { get; } = family;
    public string Argument { get; } = argument;

    public override double Evaluate(IEvaluationContext context, Runtime.Transaction? transaction) => context.Sna(Family, Argument, transaction);

    public override string ToString() => $"{Family}${Argument}";
}

public sealed class UnaryExpr(char op, Expr operand) : Expr
{
    public override double Evaluate(IEvaluationContext context, Runtime.Transaction? transaction)
    {
        var value = operand.Evaluate(context, transaction);
        return op == '-' ? -value : value;
    }
}

public sealed class BinaryExpr(string op, Expr left, Expr right) : Expr
{
    public override double Evaluate(IEvaluationContext context, Runtime.Transaction? transaction)
    {
        var a = left.Evaluate(context, transaction);
        var b = right.Evaluate(context, transaction);

        return op switch
        {
            "+" => a + b,
            "-" => a - b,
            "*" => a * b,
            "/" => b == 0 ? throw new SimulationException("Деление на ноль.") : a / b,
            "\\" => b == 0 ? throw new SimulationException("Деление на ноль.") : Math.Truncate(a / b),
            "@" => b == 0 ? throw new SimulationException("Деление на ноль.") : a % b,
            "^" => Math.Pow(a, b),
            "=" => a == b ? 1 : 0,
            "!=" => a != b ? 1 : 0,
            "<" => a < b ? 1 : 0,
            "<=" => a <= b ? 1 : 0,
            ">" => a > b ? 1 : 0,
            ">=" => a >= b ? 1 : 0,
            "&" => a != 0 && b != 0 ? 1 : 0,
            "|" => a != 0 || b != 0 ? 1 : 0,
            _ => throw new SimulationException($"Неизвестная операция \"{op}\"."),
        };
    }
}

public sealed class CallExpr(string name, IReadOnlyList<Expr> arguments) : Expr
{
    public string Name { get; } = name.ToUpperInvariant();

    public override double Evaluate(IEvaluationContext context, Runtime.Transaction? transaction)
    {
        double Arg(int index) => index < arguments.Count
            ? arguments[index].Evaluate(context, transaction)
            : throw new SimulationException($"Процедуре {Name} не хватает аргументов.");
        int Stream() => Math.Max(1, (int)Arg(0));

        return Name switch
        {
            "EXPONENTIAL" => Arg(1) - Arg(2) * Math.Log(1 - context.Random(Stream())),
            "UNIFORM" => Arg(1) + (Arg(2) - Arg(1)) * context.Random(Stream()),
            "DUNIFORM" => Math.Floor(Arg(1) + (Arg(2) - Arg(1) + 1) * context.Random(Stream())),
            "NORMAL" => Arg(1) + Arg(2) * StandardNormal(context, Stream()),
            "TRIANGULAR" => Triangular(context.Random(Stream()), Arg(1), Arg(2), Arg(3)),
            "POISSON" => Poisson(context, Stream(), Arg(1)),
            "LOGNORMAL" => Arg(1) + Math.Exp(Arg(2) + Arg(3) * StandardNormal(context, Stream())),
            "ABS" => Math.Abs(Arg(0)),
            "INT" => Math.Truncate(Arg(0)),
            "EXP" => Math.Exp(Arg(0)),
            "LOG" => Math.Log(Arg(0)),
            "SQR" or "SQRT" => Math.Sqrt(Arg(0)),
            "SIN" => Math.Sin(Arg(0)),
            "COS" => Math.Cos(Arg(0)),
            "TAN" => Math.Tan(Arg(0)),
            "ATN" => Math.Atan(Arg(0)),
            "MIN" => Math.Min(Arg(0), Arg(1)),
            "MAX" => Math.Max(Arg(0), Arg(1)),
            _ => throw new SimulationException($"Неизвестная процедура {Name}."),
        };
    }

    public static readonly HashSet<string> KnownProcedures = new(StringComparer.OrdinalIgnoreCase)
    {
        "EXPONENTIAL", "UNIFORM", "DUNIFORM", "NORMAL", "TRIANGULAR", "POISSON", "LOGNORMAL",
        "ABS", "INT", "EXP", "LOG", "SQR", "SQRT", "SIN", "COS", "TAN", "ATN", "MIN", "MAX",
    };

    private static double StandardNormal(IEvaluationContext context, int stream)
    {
        // Box–Muller transform.
        var u1 = 1 - context.Random(stream);
        var u2 = context.Random(stream);
        return Math.Sqrt(-2 * Math.Log(u1)) * Math.Cos(2 * Math.PI * u2);
    }

    private static double Triangular(double u, double min, double max, double mode)
    {
        var split = (mode - min) / (max - min);
        return u < split
            ? min + Math.Sqrt(u * (max - min) * (mode - min))
            : max - Math.Sqrt((1 - u) * (max - min) * (max - mode));
    }

    private static double Poisson(IEvaluationContext context, int stream, double mean)
    {
        var limit = Math.Exp(-mean);
        var product = context.Random(stream);
        var count = 0;
        while (product > limit)
        {
            product *= context.Random(stream);
            count++;
        }

        return count;
    }
}

/// <summary>Run-time error of a model (division by zero, invalid entity, ...).</summary>
public sealed class SimulationException(string message) : Exception(message);
