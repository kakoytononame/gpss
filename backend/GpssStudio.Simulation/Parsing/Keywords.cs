namespace GpssStudio.Simulation.Parsing;

public static class Keywords
{
    public static readonly HashSet<string> SupportedBlocks = new(StringComparer.OrdinalIgnoreCase)
    {
        "GENERATE", "TERMINATE", "ADVANCE", "SEIZE", "RELEASE", "PREEMPT", "RETURN", "FAVAIL", "FUNAVAIL",
        "QUEUE", "DEPART", "ENTER", "LEAVE", "SAVAIL", "SUNAVAIL", "TRANSFER", "TEST", "GATE", "LOGIC",
        "SAVEVALUE", "ASSIGN", "MARK", "PRIORITY", "SPLIT", "ASSEMBLE", "GATHER", "LOOP", "BUFFER",
        "TABULATE", "LINK", "UNLINK", "ADOPT", "INDEX", "MSAVEVALUE", "COUNT", "SELECT", "DISPLACE", "JOIN", "REMOVE",
        "EXAMINE", "SCAN", "ALTER", "MATCH", "PLUS", "EXECUTE", "TRACE", "UNTRACE", "OPEN", "CLOSE", "READ", "WRITE", "SEEK",
    };

    /// <summary>GPSS World blocks that are recognised but not implemented by this engine.</summary>
    public static readonly HashSet<string> UnsupportedBlocks = new(StringComparer.OrdinalIgnoreCase)
    {
        "INTEGRATION",
    };

    public static readonly HashSet<string> Definitions = new(StringComparer.OrdinalIgnoreCase)
    {
        "STORAGE", "TABLE", "QTABLE", "VARIABLE", "FVARIABLE", "BVARIABLE", "FUNCTION", "EQU", "MATRIX",
        "PROCEDURE", "EXPERIMENT",
    };

    public static readonly HashSet<string> Commands = new(StringComparer.OrdinalIgnoreCase)
    {
        "INITIAL", "START", "RESET", "CLEAR", "SIMULATE", "END", "RMULT", "SHOW", "HALT", "CONTINUE", "STEP", "STOP",
    };

    /// <summary>GPSS World commands that are recognised but not available in this environment.</summary>
    public static readonly HashSet<string> UnsupportedCommands = new(StringComparer.OrdinalIgnoreCase)
    {
        "INTEGRATE", "INCLUDE", "CONDUCT", "REPORT", "EXIT",
    };

    public static readonly HashSet<string> TestOperators = new(StringComparer.OrdinalIgnoreCase) { "L", "LE", "E", "NE", "G", "GE" };

    public static readonly HashSet<string> GateOperators = new(StringComparer.OrdinalIgnoreCase)
    {
        "U", "NU", "I", "NI", "SE", "SNE", "SF", "SNF", "SV", "SNV", "FV", "FNV", "LS", "LR",
    };

    public static readonly HashSet<string> LogicOperators = new(StringComparer.OrdinalIgnoreCase) { "S", "R", "I" };

    /// <summary>Operators of COUNT and SELECT (logical and relational).</summary>
    public static readonly HashSet<string> SelectionOperators = new(StringComparer.OrdinalIgnoreCase)
    {
        "FNV", "FV", "I", "NI", "NU", "U", "SE", "SF", "SNE", "SNF", "SNV", "SV", "LS", "LR", "E", "NE", "G", "GE", "L", "LE", "MIN", "MAX",
    };

    /// <summary>Operators of REMOVE, SCAN and ALTER.</summary>
    public static readonly HashSet<string> GroupOperators = new(StringComparer.OrdinalIgnoreCase) { "E", "NE", "G", "GE", "L", "LE", "MIN", "MAX" };

    public static bool IsOperation(string token) =>
        SupportedBlocks.Contains(token) || UnsupportedBlocks.Contains(token) || Definitions.Contains(token) || Commands.Contains(token)
        || UnsupportedCommands.Contains(token);
}
