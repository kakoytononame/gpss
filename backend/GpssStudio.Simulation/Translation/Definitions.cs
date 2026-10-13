using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Runtime;

namespace GpssStudio.Simulation.Translation;

public enum VariableKind
{
    Arithmetic,
    Floating,
    Boolean,
}

public sealed record VariableDefinition(string Name, Expr Expression, VariableKind Kind);

public sealed record StorageDefinition(string Name, int Capacity);

public sealed record MatrixDefinition(string Name, int Rows, int Columns);

public sealed record TableDefinition(string Name, Expr Argument, double FirstUpperLimit, double Width, int Classes);

/// <summary>GPSS FUNCTION: discrete (D), continuous (C), list (L) or attribute-valued (E).</summary>
public sealed class FunctionDefinition
{
    public required string Name { get; init; }
    public required Expr Argument { get; init; }
    public required char Type { get; init; }
    /// <summary>Function points; X may be an expression such as <c>(X$Start#60)</c>.</summary>
    public required IReadOnlyList<(Expr X, Expr Y)> Points { get; init; }

    /// <summary>RNj used directly as argument yields a fraction in [0, 1).</summary>
    public int? RandomStream { get; init; }

    private double X(int index, SimulationEngine engine, Transaction? transaction) => Points[index].X.Evaluate(engine, transaction);

    public double Evaluate(SimulationEngine engine, Transaction? transaction)
    {
        var x = RandomStream is { } stream ? engine.Random(stream) : Argument.Evaluate(engine, transaction);

        switch (Type)
        {
            case 'L':
            {
                var index = (int)Math.Truncate(x);
                if (index < 1 || index > Points.Count)
                {
                    throw new SimulationException($"Аргумент функции {Name} вне списка: {x}.");
                }

                return Points[index - 1].Y.Evaluate(engine, transaction);
            }
            case 'C':
            {
                if (x <= X(0, engine, transaction))
                {
                    return Points[0].Y.Evaluate(engine, transaction);
                }

                for (var i = 1; i < Points.Count; i++)
                {
                    var x1 = X(i, engine, transaction);
                    if (x <= x1)
                    {
                        var x0 = X(i - 1, engine, transaction);
                        var y0 = Points[i - 1].Y.Evaluate(engine, transaction);
                        var y1 = Points[i].Y.Evaluate(engine, transaction);
                        return x1 == x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
                    }
                }

                return Points[^1].Y.Evaluate(engine, transaction);
            }
            default:
            {
                for (var i = 0; i < Points.Count; i++)
                {
                    if (x <= X(i, engine, transaction))
                    {
                        return Points[i].Y.Evaluate(engine, transaction);
                    }
                }

                return Points[^1].Y.Evaluate(engine, transaction);
            }
        }
    }
}

public enum ControlKind
{
    Initial,
    Start,
    Reset,
    Clear,
    Show,
    Rmult,
    Step,
    Halt,
    Continue,
}

/// <summary>Control statement executed after translation, in model order.</summary>
public sealed record ControlStatement(int Line, ControlKind Kind, IReadOnlyList<string> Operands);
