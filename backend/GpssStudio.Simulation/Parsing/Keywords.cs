namespace GpssStudio.Simulation.Parsing;

public static class Keywords
{
    public static readonly HashSet<string> SupportedBlocks = new(StringComparer.OrdinalIgnoreCase)
    {
        "GENERATE", "TERMINATE", "ADVANCE", "SEIZE", "RELEASE", "PREEMPT", "RETURN", "FAVAIL", "FUNAVAIL",
        "QUEUE", "DEPART", "ENTER", "LEAVE", "SAVAIL", "SUNAVAIL", "TRANSFER", "TEST", "GATE", "LOGIC",
        "SAVEVALUE", "ASSIGN", "MARK", "PRIORITY", "SPLIT", "ASSEMBLE", "GATHER", "LOOP", "BUFFER",
        "TABULATE", "LINK", "UNLINK", "ADOPT", "INDEX",
    };

    /// <summary>GPSS World blocks that are recognised but not implemented by this engine.</summary>
    public static readonly HashSet<string> UnsupportedBlocks = new(StringComparer.OrdinalIgnoreCase)
    {
        "COUNT", "SELECT", "DISPLACE", "MSAVEVALUE", "ALTER", "EXAMINE", "JOIN", "REMOVE", "SCAN",
        "OPEN", "CLOSE", "READ", "WRITE", "SEEK", "EXECUTE", "MATCH", "PLUS", "INTEGRATE", "TRACE", "UNTRACE",
    };

    public static readonly HashSet<string> Definitions = new(StringComparer.OrdinalIgnoreCase)
    {
        "STORAGE", "TABLE", "QTABLE", "VARIABLE", "FVARIABLE", "BVARIABLE", "FUNCTION", "EQU", "MATRIX",
    };

    public static readonly HashSet<string> Commands = new(StringComparer.OrdinalIgnoreCase)
    {
        "INITIAL", "START", "RESET", "CLEAR", "SIMULATE", "END", "RMULT", "SHOW", "HALT", "CONTINUE", "STEP",
    };

    public static readonly HashSet<string> TestOperators = new(StringComparer.OrdinalIgnoreCase) { "L", "LE", "E", "NE", "G", "GE" };

    public static readonly HashSet<string> GateOperators = new(StringComparer.OrdinalIgnoreCase)
    {
        "U", "NU", "I", "NI", "SE", "SNE", "SF", "SNF", "SV", "SNV", "FV", "FNV", "LS", "LR",
    };

    public static readonly HashSet<string> LogicOperators = new(StringComparer.OrdinalIgnoreCase) { "S", "R", "I" };

    public static bool IsOperation(string token) =>
        SupportedBlocks.Contains(token) || UnsupportedBlocks.Contains(token) || Definitions.Contains(token) || Commands.Contains(token);
}
