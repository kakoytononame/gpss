using System.Text;

namespace GpssStudio.Simulation.Parsing;

/// <summary>
/// Splits GPSS World model text into statements. Comments start with <c>;</c> (or <c>*</c> in
/// the first column); a label is recognised as a leading token that is not an operation name.
/// </summary>
public static class SourceParser
{
    public static IReadOnlyList<SourceStatement> Parse(string text, ICollection<TranslationError> errors)
    {
        var statements = new List<SourceStatement>();
        var lines = RemoveControlCharacters(text ?? string.Empty).Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
        SourceStatement? pendingFunction = null;

        for (var index = 0; index < lines.Length; index++)
        {
            var lineNumber = index + 1;
            if (Plus.PlusParser.StartsProcedure(lines[index]))
            {
                // PLUS procedures span several lines and use ";" as the statement terminator.
                var last = Plus.PlusParser.FindEnd(lines, index);
                statements.Add(new SourceStatement
                {
                    Line = lineNumber,
                    Operation = lines[index].TrimStart().StartsWith("EXPERIMENT", StringComparison.OrdinalIgnoreCase) ? "EXPERIMENT" : "PROCEDURE",
                    Operands = [string.Join("\n", lines[index..(last + 1)])],
                });
                pendingFunction = null;
                index = last;
                continue;
            }

            var content = StripComment(lines[index]);

            if (string.IsNullOrWhiteSpace(content))
            {
                continue;
            }

            var tokens = Tokenize(content);

            if (pendingFunction is not null && !Keywords.IsOperation(tokens[0]) && !(tokens.Count > 1 && Keywords.IsOperation(tokens[1])))
            {
                // FUNCTION follower: "x1,y1/x2,y2/..."
                pendingFunction.FollowerLines.Add(string.Concat(tokens));
                continue;
            }

            pendingFunction = null;
            var statement = BuildStatement(tokens, lineNumber, errors);
            if (statement is null)
            {
                continue;
            }

            statements.Add(statement);
            if (statement.Operation == "FUNCTION")
            {
                pendingFunction = statement;
            }
        }

        return statements;
    }

    private static SourceStatement? BuildStatement(List<string> tokens, int lineNumber, ICollection<TranslationError> errors)
    {
        var position = 0;
        string? label = null;

        if (!Keywords.IsOperation(tokens[0]))
        {
            if (tokens.Count < 2 || !Keywords.IsOperation(tokens[1]))
            {
                errors.Add(new TranslationError(lineNumber, $"Неизвестная операция \"{(tokens.Count > 1 ? tokens[1] : tokens[0])}\"."));
                return null;
            }

            label = tokens[0];
            position = 1;
        }

        var operation = tokens[position].ToUpperInvariant();
        position++;

        string? auxiliary = null;
        if (position < tokens.Count && IsAuxiliary(operation, tokens[position]))
        {
            auxiliary = tokens[position].ToUpperInvariant();
            position++;
        }
        else if (position < tokens.Count && tokens[position].IndexOf(',') is var comma and > 0 && IsAuxiliary(operation, tokens[position][..comma]))
        {
            // Older form with the operator separated by a comma: "SELECT SNF,3,Bin1,Bin3".
            auxiliary = tokens[position][..comma].ToUpperInvariant();
            tokens[position] = tokens[position][(comma + 1)..];
        }

        // Operands are a single token; anything after it is a trailing comment.
        var operands = position < tokens.Count ? SplitOperands(tokens[position]) : [];

        return new SourceStatement
        {
            Line = lineNumber,
            Label = label,
            Operation = operation,
            Auxiliary = auxiliary,
            Operands = operands,
        };
    }

    internal static bool IsAuxiliary(string operation, string token) => operation switch
    {
        "TEST" => Keywords.TestOperators.Contains(token),
        "GATE" => Keywords.GateOperators.Contains(token),
        "LOGIC" => Keywords.LogicOperators.Contains(token),
        "COUNT" or "SELECT" => Keywords.SelectionOperators.Contains(token),
        "REMOVE" or "SCAN" or "ALTER" => Keywords.GroupOperators.Contains(token),
        _ => false,
    };

    /// <summary>NUL and other control characters (e.g. padding of binary model files) are treated as spaces.</summary>
    private static string RemoveControlCharacters(string text) =>
        text.Any(ch => char.IsControl(ch) && ch is not '\n' and not '\r' and not '\t')
            ? new string(text.Select(ch => char.IsControl(ch) && ch is not '\n' and not '\r' and not '\t' ? ' ' : ch).ToArray())
            : text;

    private static string StripComment(string line)
    {
        if (line.StartsWith('*'))
        {
            return string.Empty;
        }

        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            if (line[i] == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (line[i] == ';' && !inQuotes)
            {
                return line[..i];
            }
        }

        return line;
    }

    /// <summary>Whitespace-separated tokens; whitespace inside parentheses or quotes is kept.</summary>
    private static List<string> Tokenize(string content)
    {
        var tokens = new List<string>();
        var current = new StringBuilder();
        var depth = 0;
        var inQuotes = false;

        foreach (var ch in content)
        {
            if (ch == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (!inQuotes && ch == '(')
            {
                depth++;
            }
            else if (!inQuotes && ch == ')')
            {
                depth = Math.Max(0, depth - 1);
            }

            if (char.IsWhiteSpace(ch) && depth == 0 && !inQuotes)
            {
                if (current.Length > 0)
                {
                    tokens.Add(current.ToString());
                    current.Clear();
                }

                continue;
            }

            if (!char.IsWhiteSpace(ch) || inQuotes)
            {
                current.Append(ch);
            }
        }

        if (current.Length > 0)
        {
            tokens.Add(current.ToString());
        }

        return JoinOperandsSplitAfterCommas(tokens);
    }

    /// <summary>Splits "A,B,(f(1,2)),D" on top-level commas, keeping empty operands.</summary>
    public static List<string> SplitOperands(string operandField)
    {
        var operands = new List<string>();
        var current = new StringBuilder();
        var depth = 0;

        foreach (var ch in operandField)
        {
            if (ch == '(')
            {
                depth++;
            }
            else if (ch == ')')
            {
                depth--;
            }

            if (ch == ',' && depth == 0)
            {
                operands.Add(current.ToString());
                current.Clear();
                continue;
            }

            current.Append(ch);
        }

        operands.Add(current.ToString());
        return operands.Select(item => item.Trim()).ToList();
    }

    /// <summary>"A, B" is read as one operand field "A,B" (spaces after commas are tolerated, as in GPSS Studio).</summary>
    private static List<string> JoinOperandsSplitAfterCommas(List<string> tokens)
    {
        for (var i = tokens.Count - 1; i > 0; i--)
        {
            if (tokens[i - 1].EndsWith(',') && !tokens[i].StartsWith(';'))
            {
                tokens[i - 1] += tokens[i];
                tokens.RemoveAt(i);
            }
        }

        return tokens;
    }
}
