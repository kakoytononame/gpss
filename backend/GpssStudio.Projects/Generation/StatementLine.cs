using System.Text;
using GpssStudio.Simulation.Parsing;

namespace GpssStudio.Projects.Generation;

/// <summary>
/// One line of a TEB model split into fields while keeping comments:
/// <c>[label] OPERATION [auxiliary] operands [;comment]</c>. Blank and comment-only lines are preserved.
/// </summary>
public sealed class StatementLine
{
    public string? Label { get; set; }

    /// <summary>The label is already a final model name (generated entry label) and is not corrected.</summary>
    public bool LabelIsFinal { get; set; }
    public string? Operation { get; init; }
    public string? Auxiliary { get; init; }
    public List<string> Operands { get; init; } = [];

    /// <summary>Comment text after ";" (without the semicolon), or the whole line for "*" comments.</summary>
    public string? Comment { get; init; }

    /// <summary>Line that could not be split (unknown operation); emitted unchanged.</summary>
    public string? Raw { get; init; }

    public bool IsBlank => Operation is null && Comment is null && Raw is null;

    public bool IsCommentOnly => Operation is null && Comment is not null;

    public bool IsBlock => Operation is not null && (Keywords.SupportedBlocks.Contains(Operation) || Keywords.UnsupportedBlocks.Contains(Operation));

    /// <summary>Data lines following a FUNCTION statement ("x1,y1/x2,y2").</summary>
    public bool IsFunctionFollower { get; init; }

    public static List<StatementLine> ParseText(string? text)
    {
        var result = new List<StatementLine>();
        var afterFunction = false;
        foreach (var rawLine in (text ?? string.Empty).Replace("\r\n", "\n").Replace('\r', '\n').Split('\n'))
        {
            var line = rawLine.TrimEnd().Replace("\0", string.Empty);
            var statement = Parse(line, afterFunction);
            afterFunction = statement.Operation == "FUNCTION" || (afterFunction && statement.IsFunctionFollower);
            result.Add(statement);
        }

        // Trailing blank lines carry no meaning.
        while (result.Count > 0 && result[^1].IsBlank)
        {
            result.RemoveAt(result.Count - 1);
        }

        return result;
    }

    public static StatementLine Parse(string line, bool afterFunction = false)
    {
        var trimmed = line.Trim();
        if (trimmed.Length == 0)
        {
            return new StatementLine();
        }

        // No GPSS statement starts with "*": such lines are comments wherever they begin.
        if (trimmed.StartsWith('*'))
        {
            return new StatementLine { Comment = trimmed };
        }

        var (code, comment) = SplitComment(trimmed);
        if (code.Trim().Length == 0)
        {
            return new StatementLine { Comment = ";" + comment };
        }

        var tokens = Tokenize(code);
        if (afterFunction && !Keywords.IsOperation(tokens[0]) && !(tokens.Count > 1 && Keywords.IsOperation(tokens[1])))
        {
            return new StatementLine { Operands = [string.Concat(tokens)], Comment = comment, IsFunctionFollower = true };
        }

        var position = 0;
        string? label = null;
        if (!Keywords.IsOperation(tokens[0]))
        {
            if (tokens.Count < 2 || !Keywords.IsOperation(tokens[1]))
            {
                return new StatementLine { Raw = trimmed };
            }

            label = tokens[0];
            position = 1;
        }

        var operation = tokens[position++].ToUpperInvariant();
        string? auxiliary = null;
        if (position < tokens.Count && IsAuxiliary(operation, tokens[position]))
        {
            auxiliary = tokens[position++].ToUpperInvariant();
        }

        var operands = position < tokens.Count ? SourceParser.SplitOperands(tokens[position++]) : [];

        // GPSS World treats text after the operand field as a comment.
        var trailing = position < tokens.Count ? string.Join(" ", tokens.Skip(position)) : null;
        var fullComment = trailing is null ? comment : comment is null ? trailing : trailing + " ;" + comment;
        return new StatementLine
        {
            Label = label, Operation = operation, Auxiliary = auxiliary, Operands = operands.ToList(),
            Comment = fullComment,
        };
    }

    public string Render()
    {
        if (Raw is not null)
        {
            return Raw;
        }

        if (IsFunctionFollower)
        {
            return Operands.FirstOrDefault() + (Comment is null ? string.Empty : " ;" + Comment);
        }

        if (Operation is null)
        {
            return Comment ?? string.Empty;
        }

        var builder = new StringBuilder();
        if (Label is not null)
        {
            builder.Append(Label).Append(' ');
        }

        builder.Append(Operation);
        if (Auxiliary is not null)
        {
            builder.Append(' ').Append(Auxiliary);
        }

        var operands = string.Join(",", Operands).TrimEnd(',');
        if (operands.Length > 0)
        {
            builder.Append(' ').Append(operands);
        }

        if (Comment is not null)
        {
            builder.Append(" ;").Append(Comment);
        }

        return builder.ToString();
    }

    private static bool IsAuxiliary(string operation, string token) => operation switch
    {
        "TEST" => Keywords.TestOperators.Contains(token),
        "GATE" => Keywords.GateOperators.Contains(token),
        "LOGIC" => Keywords.LogicOperators.Contains(token),
        "COUNT" or "SELECT" => Keywords.SelectionOperators.Contains(token),
        "REMOVE" or "SCAN" or "ALTER" => Keywords.GroupOperators.Contains(token),
        _ => false,
    };

    private static (string Code, string? Comment) SplitComment(string line)
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
                return (line[..i], line[(i + 1)..]);
            }
        }

        return (line, null);
    }

    private static List<string> Tokenize(string code)
    {
        var tokens = new List<string>();
        var current = new StringBuilder();
        var depth = 0;
        var inQuotes = false;
        foreach (var ch in code)
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

            current.Append(ch);
        }

        if (current.Length > 0)
        {
            tokens.Add(current.ToString());
        }

        return JoinOperandsSplitAfterCommas(tokens);
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
