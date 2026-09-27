namespace GpssStudio.Simulation.Parsing;

/// <summary>
/// One statement of a GPSS World model: <c>[label] OPERATION [auxiliary] A,B,C...</c>.
/// </summary>
public sealed class SourceStatement
{
    public required int Line { get; init; }
    public string? Label { get; init; }
    public required string Operation { get; init; }

    /// <summary>Auxiliary operator of TEST, GATE, LOGIC (e.g. <c>L</c>, <c>NU</c>, <c>S</c>).</summary>
    public string? Auxiliary { get; init; }

    public IReadOnlyList<string> Operands { get; init; } = [];

    /// <summary>Data lines that follow a FUNCTION statement.</summary>
    public List<string> FollowerLines { get; } = [];

    public string Operand(int index) => index < Operands.Count ? Operands[index] : string.Empty;

    public bool HasOperand(int index) => Operand(index).Length > 0;
}

public sealed record TranslationError(int Line, string Message)
{
    public override string ToString() => Line > 0 ? $"Строка {Line}: {Message}" : Message;
}
