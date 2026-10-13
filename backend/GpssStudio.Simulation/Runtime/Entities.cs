namespace GpssStudio.Simulation.Runtime;

/// <summary>Time-weighted average of a piecewise-constant value.</summary>
public sealed class TimeIntegral
{
    private double _lastTime;
    private double _area;

    public double StartTime { get; private set; }

    public void Reset(double time)
    {
        StartTime = time;
        _lastTime = time;
        _area = 0;
    }

    public void Accumulate(double time, double currentValue)
    {
        _area += currentValue * (time - _lastTime);
        _lastTime = time;
    }

    public double Average(double time, double currentValue)
    {
        var elapsed = time - StartTime;
        var area = _area + currentValue * (time - _lastTime);
        return elapsed > 0 ? area / elapsed : 0;
    }
}

public abstract class Entity(string name, int number)
{
    public string Name { get; } = name;
    public int Number { get; } = number;
}

/// <summary>Single-server device (SEIZE / RELEASE / PREEMPT / RETURN).</summary>
public sealed class Facility(string name, int number) : Entity(name, number)
{
    public Transaction? Owner { get; set; }
    public bool Available { get; set; } = true;
    public int Entries { get; set; }
    public TimeIntegral Busy { get; } = new();
    public LinkedList<Transaction> DelayChain { get; } = new();

    /// <summary>Transactions whose ownership was interrupted by PREEMPT.</summary>
    public Stack<Transaction> InterruptChain { get; } = new();

    public bool IsBusy => Owner is not null;
}

public sealed class QueueEntity(string name, int number) : Entity(name, number)
{
    public int Content { get; set; }
    public int MaxContent { get; set; }
    public int Entries { get; set; }
    public int ZeroEntries { get; set; }
    public double TotalTime { get; set; }
    public TimeIntegral ContentIntegral { get; } = new();
}

/// <summary>Multi-channel device (ENTER / LEAVE).</summary>
public sealed class Storage(string name, int number, int capacity) : Entity(name, number)
{
    public int Capacity { get; set; } = capacity;
    public int Used { get; set; }
    public int MinUsed { get; set; }
    public int MaxUsed { get; set; }
    public int Entries { get; set; }
    public bool Available { get; set; } = true;
    public TimeIntegral UsedIntegral { get; } = new();
    public LinkedList<(Transaction Transaction, int Units)> DelayChain { get; } = new();

    public int Remaining => Capacity - Used;
}

public sealed class LogicSwitch(string name, int number) : Entity(name, number)
{
    public bool IsSet { get; set; }
}

public sealed class Savevalue(string name, int number) : Entity(name, number)
{
    public double Value { get; set; }
}

public sealed class UserChain(string name, int number) : Entity(name, number)
{
    public LinkedList<Transaction> Members { get; } = new();
    public bool LinkIndicator { get; set; }
    public int Entries { get; set; }
    public int MaxContent { get; set; }
    public double TotalTime { get; set; }
    public TimeIntegral ContentIntegral { get; } = new();
}

/// <summary>Two-dimensional GPSS matrix (MATRIX / MSAVEVALUE / MX$). Higher dimensions are fixed at index 1.</summary>
public sealed class MatrixEntity(string name, int number, int rows, int columns) : Entity(name, number)
{
    private readonly double[] _cells = new double[rows * columns];

    public int Rows { get; } = rows;
    public int Columns { get; } = columns;

    public double this[int row, int column]
    {
        get => _cells[Offset(row, column)];
        set => _cells[Offset(row, column)] = value;
    }

    public void Fill(double value) => Array.Fill(_cells, value);

    private int Offset(int row, int column)
    {
        if (row < 1 || row > Rows || column < 1 || column > Columns)
        {
            throw new Expressions.SimulationException($"элемент ({row},{column}) вне границ матрицы {Name} ({Rows}x{Columns}).");
        }

        return (row - 1) * Columns + (column - 1);
    }
}

/// <summary>Numeric group (JOIN / REMOVE / EXAMINE with a value).</summary>
public sealed class NumericGroup(string name, int number) : Entity(name, number)
{
    public HashSet<double> Members { get; } = [];
}

/// <summary>Transaction group (JOIN / REMOVE / EXAMINE / SCAN / ALTER).</summary>
public sealed class TransactionGroup(string name, int number) : Entity(name, number)
{
    /// <summary>Members in order of joining.</summary>
    public List<Transaction> Members { get; } = [];
}

/// <summary>Frequency table (TABLE statement + TABULATE block).</summary>
public sealed class TableEntity(string name, int number, Expressions.Expr argument, double firstUpperLimit, double width, int classes) : Entity(name, number)
{
    public Expressions.Expr Argument { get; } = argument;
    public double FirstUpperLimit { get; } = firstUpperLimit;
    public double Width { get; } = width;
    public int Classes { get; } = Math.Max(2, classes);
    public long[] Frequencies { get; private set; } = new long[Math.Max(2, classes)];
    public double WeightedCount { get; private set; }
    public double Sum { get; private set; }
    public double SumOfSquares { get; private set; }

    public void Add(double value, double weight)
    {
        var index = value <= FirstUpperLimit ? 0 : (int)Math.Min(Classes - 1, Math.Ceiling((value - FirstUpperLimit) / Width));
        index = Math.Clamp(index, 0, Classes - 1);
        Frequencies[index] += (long)weight;
        WeightedCount += weight;
        Sum += value * weight;
        SumOfSquares += value * value * weight;
    }

    public double Mean => WeightedCount > 0 ? Sum / WeightedCount : 0;

    public double StandardDeviation => WeightedCount > 1
        ? Math.Sqrt(Math.Max(0, (SumOfSquares - Sum * Sum / WeightedCount) / (WeightedCount - 1)))
        : 0;

    public void Reset()
    {
        Frequencies = new long[Classes];
        WeightedCount = 0;
        Sum = 0;
        SumOfSquares = 0;
    }
}

/// <summary>Open data stream: a cursor over an in-memory text file.</summary>
public sealed class DataStream(string fileName, List<string> lines)
{
    public string FileName { get; } = fileName;
    public List<string> Lines { get; } = lines;
    public int Position { get; set; }
    public int ErrorCode { get; set; }
}
