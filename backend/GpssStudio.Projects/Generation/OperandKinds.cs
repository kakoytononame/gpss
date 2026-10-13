namespace GpssStudio.Projects.Generation;

/// <summary>Role of an operand for name correction.</summary>
public enum OperandKind
{
    /// <summary>Expression or entity name: identifiers are entity names (corrected).</summary>
    Expression,

    /// <summary>Block label (corrected as a label; output labels are redirected).</summary>
    Label,

    /// <summary>Transaction parameter name (kept; expressions inside are corrected).</summary>
    Parameter,

    /// <summary>Keyword or literal (kept as is): PR, FIFO, ALL, SNA class, function type...</summary>
    Keyword,
}

/// <summary>Operand roles of GPSS World statements, used by the name correction of generated models.</summary>
public static class OperandKinds
{
    private const OperandKind E = OperandKind.Expression;
    private const OperandKind L = OperandKind.Label;
    private const OperandKind P = OperandKind.Parameter;
    private const OperandKind K = OperandKind.Keyword;

    private static readonly Dictionary<string, OperandKind[]> Kinds = new(StringComparer.OrdinalIgnoreCase)
    {
        ["PREEMPT"] = [E, K, L, P, K],
        ["FUNAVAIL"] = [E, K, L, P, K, L, K, L],
        ["TRANSFER"] = [K, L, L, E],
        ["TEST"] = [E, E, L],
        ["GATE"] = [E, L],
        ["ASSIGN"] = [P, E, E],
        ["MARK"] = [P],
        ["PRIORITY"] = [E, K],
        ["SPLIT"] = [E, L, P],
        ["MATCH"] = [L],
        ["LOOP"] = [P, L],
        ["LINK"] = [E, P, L],
        ["UNLINK"] = [E, L, K, P, E, L],
        ["INDEX"] = [P, E],
        ["COUNT"] = [P, E, E, E, K],
        ["SELECT"] = [P, E, E, E, K, L],
        ["DISPLACE"] = [E, L, P, L],
        ["EXAMINE"] = [E, E, L],
        ["REMOVE"] = [E, K, E, P, E, L],
        ["SCAN"] = [E, P, E, P, P, L],
        ["ALTER"] = [E, K, P, E, P, E, L],
        ["PLUS"] = [E, P],
        ["EXECUTE"] = [L],
        ["OPEN"] = [E, E, L],
        ["READ"] = [P, E, L],
        ["WRITE"] = [E, E, L, K],
        ["CLOSE"] = [P, E, L],
        ["FUNCTION"] = [E, K],
        ["MATRIX"] = [K, E, E, E, E, E, E],
        ["START"] = [E, K, E, E],
        ["CLEAR"] = [K],
    };

    public static OperandKind Of(string operation, int index, string operand)
    {
        if (operation.Equals("TRANSFER", StringComparison.OrdinalIgnoreCase))
        {
            return TransferKind(index, operand);
        }

        return Kinds.TryGetValue(operation, out var kinds) && index < kinds.Length ? kinds[index] : OperandKind.Expression;
    }

    /// <summary>TRANSFER: A is a mode keyword or a fraction; SBR stores the return in parameter C, P mode reads B.</summary>
    private static OperandKind TransferKind(int index, string operand) => index switch
    {
        0 => OperandKind.Keyword,
        _ => OperandKind.Label,
    };

    /// <summary>Operand A of TRANSFER that is a fraction expression rather than a mode keyword.</summary>
    public static bool IsTransferFraction(string operand) =>
        operand.Length > 0 && !operand.ToUpperInvariant().Equals("BOTH") && !operand.ToUpperInvariant().Equals("ALL")
        && !operand.ToUpperInvariant().Equals("PICK") && !operand.ToUpperInvariant().Equals("SBR") && !operand.ToUpperInvariant().Equals("P");

    /// <summary>Statements whose label names an entity (not a block).</summary>
    public static bool LabelIsEntity(string operation) => operation.ToUpperInvariant() is
        "STORAGE" or "TABLE" or "QTABLE" or "VARIABLE" or "FVARIABLE" or "BVARIABLE" or "FUNCTION" or "EQU" or "MATRIX";
}
