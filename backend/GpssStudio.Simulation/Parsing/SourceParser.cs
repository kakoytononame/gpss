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
        var lines = (text ?? string.Empty).Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
        SourceStatement? pendingFunction = null;

        for (var index = 0; index < lines.Length; index++)
        {
            var lineNumber = index + 1;
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

    private static bool IsAuxiliary(string operation, string token) => operation switch
    {
        "TEST" => Keywords.TestOperators.Contains(token),
        "GATE" => Keywords.GateOperators.Contains(token),
        "LOGIC" => Keywords.LogicOperators.Contains(token),
        _ => false,
    };

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

        return tokens;
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
}
