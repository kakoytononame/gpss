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

public sealed record TableDefinition(string Name, Expr Argument, double FirstUpperLimit, double Width, int Classes);

/// <summary>GPSS FUNCTION: discrete (D), continuous (C), list (L) or attribute-valued (E).</summary>
public sealed class FunctionDefinition
{
    public required string Name { get; init; }
    public required Expr Argument { get; init; }
    public required char Type { get; init; }
    public required IReadOnlyList<(double X, Expr Y)> Points { get; init; }

    /// <summary>RNj used directly as argument yields a fraction in [0, 1).</summary>
    public int? RandomStream { get; init; }

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
                if (x <= Points[0].X)
                {
                    return Points[0].Y.Evaluate(engine, transaction);
                }

                for (var i = 1; i < Points.Count; i++)
                {
                    if (x <= Points[i].X)
                    {
                        var (x0, y0) = (Points[i - 1].X, Points[i - 1].Y.Evaluate(engine, transaction));
                        var (x1, y1) = (Points[i].X, Points[i].Y.Evaluate(engine, transaction));
                        return x1 == x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
                    }
                }

                return Points[^1].Y.Evaluate(engine, transaction);
            }
            default:
            {
                foreach (var (pointX, y) in Points)
                {
                    if (x <= pointX)
                    {
                        return y.Evaluate(engine, transaction);
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
