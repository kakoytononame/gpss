namespace GpssStudio.Simulation.Parsing;

/// <summary>
/// Reads and replaces one operand (A, B, C, ...) of a statement in model text while keeping the rest
/// of the line (label, spacing, comment) intact. Used by input forms and experiment factors that are
/// bound to "line N, operand B" as in GPSS Studio.
/// </summary>
public static class OperandEditor
{
    /// <summary>Operand letter to zero-based index: "A" → 0, "B" → 1, ...</summary>
    public static int IndexOf(string operand)
    {
        var letter = operand.Trim().ToUpperInvariant();
        if (letter.Length != 1 || letter[0] is < 'A' or > 'Z')
        {
            throw new ArgumentException($"Неверное имя операнда \"{operand}\": ожидается буква A–Z.");
        }

        return letter[0] - 'A';
    }

    /// <summary>Value of the operand in a line, or null when the line has no statement or no such operand.</summary>
    public static string? Read(string line, int operandIndex)
    {
        var field = Locate(line);
        if (field is null)
        {
            return null;
        }

        var operands = SplitWithPositions(line, field.Value.Start, field.Value.End, field.Value.SkipFirst);
        return operandIndex < operands.Count ? line[operands[operandIndex].Start..operands[operandIndex].End].Trim() : null;
    }

    /// <summary>The line with the operand replaced (missing operands are added as empty ones).</summary>
    public static string Replace(string line, int operandIndex, string value)
    {
        var field = Locate(line) ?? throw new ArgumentException($"Строка \"{line.Trim()}\" не содержит оператора GPSS.");
        var operands = SplitWithPositions(line, field.Start, field.End, field.SkipFirst);
        if (operandIndex < operands.Count)
        {
            var (start, end) = operands[operandIndex];
            return line[..start] + value + line[end..];
        }

        // Append the missing operands after the last one ("GENERATE 10" + D → "GENERATE 10,,,5").
        var padding = new string(',', operandIndex - operands.Count + (operands.Count > 0 ? 1 : 0));
        var insertAt = field.End;
        var separator = field.Start == field.End && !field.HasField ? " " : string.Empty;
        return line[..insertAt] + separator + padding + value + line[insertAt..];
    }

    /// <summary>Replaces operands in model text; <paramref name="line"/> is 1-based.</summary>
    public static string ReplaceInText(string text, int line, string operand, string value)
    {
        var newline = text.Contains("\r\n") ? "\r\n" : "\n";
        var lines = text.Replace("\r\n", "\n").Split('\n');
        if (line < 1 || line > lines.Length)
        {
            throw new ArgumentException($"Строка {line} отсутствует в тексте модели (строк: {lines.Length}).");
        }

        lines[line - 1] = Replace(lines[line - 1], IndexOf(operand), value);
        return string.Join(newline, lines);
    }

    /// <summary>
    /// Span of the operand field: from its first character to its end (before the comment or trailing text).
    /// <c>SkipFirst</c> is set for the legacy form "TEST E,P1,2" where the auxiliary operator leads the field.
    /// </summary>
    private static (int Start, int End, bool SkipFirst, bool HasField)? Locate(string line)
    {
        var code = CodeLength(line);
        if (line.TrimStart().StartsWith('*'))
        {
            return null;
        }

        var tokens = Tokens(line, code);
        if (tokens.Count == 0)
        {
            return null;
        }

        var position = 0;
        if (!Keywords.IsOperation(Text(line, tokens[0])))
        {
            if (tokens.Count < 2 || !Keywords.IsOperation(Text(line, tokens[1])))
            {
                return null;
            }

            position = 1;
        }

        var operation = Text(line, tokens[position]).ToUpperInvariant();
        var operationEnd = tokens[position].End;
        position++;
        if (position < tokens.Count && SourceParser.IsAuxiliary(operation, Text(line, tokens[position])))
        {
            operationEnd = tokens[position].End;
            position++;
        }

        if (position >= tokens.Count)
        {
            return (operationEnd, operationEnd, false, false);
        }

        // "A, B" with spaces after commas is one operand field.
        var (start, end) = tokens[position];
        while (position + 1 < tokens.Count && line[end - 1] == ',')
        {
            end = tokens[++position].End;
        }

        var first = line[start..end];
        var comma = first.IndexOf(',');
        var skipFirst = comma > 0 && SourceParser.IsAuxiliary(operation, first[..comma]);
        return (start, end, skipFirst, true);
    }

    private static List<(int Start, int End)> SplitWithPositions(string line, int start, int end, bool skipFirst)
    {
        var result = new List<(int Start, int End)>();
        if (start == end)
        {
            return result;
        }

        var depth = 0;
        var inQuotes = false;
        var itemStart = start;
        for (var i = start; i < end; i++)
        {
            var ch = line[i];
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
                depth--;
            }
            else if (!inQuotes && depth == 0 && ch == ',')
            {
                result.Add(Trim(line, itemStart, i));
                itemStart = i + 1;
            }
        }

        result.Add(Trim(line, itemStart, end));
        return skipFirst ? result.Skip(1).ToList() : result;
    }

    private static (int Start, int End) Trim(string line, int start, int end)
    {
        while (start < end && char.IsWhiteSpace(line[start]))
        {
            start++;
        }

        while (end > start && char.IsWhiteSpace(line[end - 1]))
        {
            end--;
        }

        return (start, end);
    }

    private static int CodeLength(string line)
    {
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            if (line[i] == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (line[i] == ';' && !inQuotes)
            {
                return i;
            }
        }

        return line.Length;
    }

    private static List<(int Start, int End)> Tokens(string line, int length)
    {
        var tokens = new List<(int Start, int End)>();
        var depth = 0;
        var inQuotes = false;
        var start = -1;
        for (var i = 0; i < length; i++)
        {
            var ch = line[i];
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

            var separator = (char.IsWhiteSpace(ch) || char.IsControl(ch)) && depth == 0 && !inQuotes;
            if (separator)
            {
                if (start >= 0)
                {
                    tokens.Add((start, i));
                    start = -1;
                }
            }
            else if (start < 0)
            {
                start = i;
            }
        }

        if (start >= 0)
        {
            tokens.Add((start, length));
        }

        return tokens;
    }

    private static string Text(string line, (int Start, int End) token) => line[token.Start..token.End];
}
