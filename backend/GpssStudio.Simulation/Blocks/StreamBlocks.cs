using System.Globalization;
using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Runtime;
using GpssStudio.Simulation.Translation;

namespace GpssStudio.Simulation.Blocks;

/// <summary>Common operands of the data stream blocks: stream number (default 1) and alternate exit.</summary>
public abstract class StreamBlock : Block
{
    public Expr? Stream { get; init; }
    public BlockRef? Alternate { get; init; }

    protected int StreamNumber(SimulationEngine engine, Transaction transaction) => Stream is null ? 1 : (int)Math.Round(engine.Eval(Stream, transaction));

    protected BlockOutcome Fail(SimulationEngine engine, Transaction transaction, DataStream? stream, int errorCode)
    {
        if (stream is not null)
        {
            stream.ErrorCode = errorCode;
        }

        if (Alternate is not null)
        {
            transaction.NextBlock = Alternate.Resolve(engine, transaction);
        }

        return BlockOutcome.Continue;
    }
}

/// <summary>OPEN A,B,C — opens in-memory text file A as stream B.</summary>
public sealed class OpenBlock : StreamBlock
{
    public required Expr FileName { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var name = engine.EvalText(FileName, transaction);
        if (string.IsNullOrWhiteSpace(name))
        {
            return Fail(engine, transaction, null, 21);
        }

        engine.OpenStream(StreamNumber(engine, transaction), name);
        return BlockOutcome.Continue;
    }
}

/// <summary>READ A,B,C — reads the next line of stream B into parameter A; C on end of file.</summary>
public sealed class ReadBlock : StreamBlock
{
    public required ParameterRef Parameter { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var stream = engine.DataStream(StreamNumber(engine, transaction));
        if (stream is null)
        {
            return Fail(engine, transaction, null, 22);
        }

        if (stream.Position >= stream.Lines.Count)
        {
            return Fail(engine, transaction, stream, 23);
        }

        var line = stream.Lines[stream.Position++];
        var value = double.TryParse(line.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var number) ? number : 0;
        transaction.SetParameter(Parameter.Resolve(engine, transaction), value);
        return BlockOutcome.Continue;
    }
}

/// <summary>WRITE A,B,C,D — inserts (or with D = OFF replaces) value A at the current line of stream B.</summary>
public sealed class WriteBlock : StreamBlock
{
    public required Expr Value { get; init; }
    public bool Replace { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var stream = engine.DataStream(StreamNumber(engine, transaction));
        if (stream is null)
        {
            return Fail(engine, transaction, null, 22);
        }

        var text = engine.EvalText(Value, transaction);
        if (Replace && stream.Position < stream.Lines.Count)
        {
            stream.Lines[stream.Position] = text;
        }
        else
        {
            stream.Lines.Insert(Math.Min(stream.Position, stream.Lines.Count), text);
        }

        stream.Position++;
        return BlockOutcome.Continue;
    }
}

/// <summary>SEEK A,B — sets the current line of stream B to A.</summary>
public sealed class SeekBlock : StreamBlock
{
    public required Expr TargetLine { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var stream = engine.DataStream(StreamNumber(engine, transaction));
        if (stream is null)
        {
            return Fail(engine, transaction, null, 22);
        }

        stream.Position = Math.Max(0, (int)Math.Round(engine.Eval(TargetLine, transaction)) - 1);
        return BlockOutcome.Continue;
    }
}

/// <summary>CLOSE A,B,C — closes stream B; its error code goes to parameter A, C is taken on error.</summary>
public sealed class CloseBlock : StreamBlock
{
    public ParameterRef? ErrorParameter { get; init; }

    public override BlockOutcome Execute(SimulationEngine engine, Transaction transaction)
    {
        var stream = engine.CloseStream(StreamNumber(engine, transaction));
        var errorCode = stream?.ErrorCode ?? 22;
        if (ErrorParameter is not null)
        {
            transaction.SetParameter(ErrorParameter.Resolve(engine, transaction), errorCode);
        }

        if (errorCode != 0 && Alternate is not null)
        {
            transaction.NextBlock = Alternate.Resolve(engine, transaction);
        }

        return BlockOutcome.Continue;
    }
}
