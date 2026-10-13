using System.Text;
using GpssStudio.Simulation.Expressions;

namespace GpssStudio.Projects.Generation;

/// <summary>
/// Name correction of a TEB model (GPSS Studio manual, 3.15.3): labels and locally used entity names get
/// the TEB name as prefix (<c>teb4_Pier1</c>) so that TEBs can be combined into one model; names
/// described in visible data TEBs are replaced by their qualified names, output labels are redirected
/// to the connected TEB, TEB parameters are replaced by their values.
/// </summary>
public sealed class NameCorrector
{
    private static readonly HashSet<string> AtomicSnas = new(StringComparer.OrdinalIgnoreCase)
    {
        "AC1", "C1", "M1", "MP", "XN1", "PR", "TG1", "A1", "Z1",
    };

    /// <summary>Keywords that may appear where names are expected and are never corrected.</summary>
    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "UNSPECIFIED", "ON", "OFF", "ALL", "BOTH", "PICK", "SBR", "FIFO", "LIFO", "NP", "BU", "RE", "BACK", "MIN", "MAX",
    };

    private static readonly HashSet<string> LabelFamilies = new(StringComparer.OrdinalIgnoreCase) { "N", "W", "MB" };
    private static readonly HashSet<string> ParameterFamilies = new(StringComparer.OrdinalIgnoreCase) { "P", "MP" };

    private readonly string _prefix;
    private readonly IReadOnlySet<string> _localLabels;
    private readonly IReadOnlyDictionary<string, string> _outputLabels;
    private readonly IReadOnlyDictionary<string, string> _dataNames;
    private readonly IReadOnlyDictionary<string, string> _parameters;

    /// <param name="prefix">Name correction prefix including the separator, e.g. <c>teb4_</c>; empty for none.</param>
    /// <param name="localLabels">Block labels defined in the TEB model.</param>
    /// <param name="outputLabels">Labels of outputs and the labels they lead to.</param>
    /// <param name="dataNames">Names of visible data entities and their names in the model.</param>
    /// <param name="parameters">TEB parameters and their values.</param>
    public NameCorrector(
        string prefix,
        IReadOnlySet<string> localLabels,
        IReadOnlyDictionary<string, string> outputLabels,
        IReadOnlyDictionary<string, string> dataNames,
        IReadOnlyDictionary<string, string> parameters)
    {
        _prefix = prefix;
        _localLabels = localLabels;
        _outputLabels = outputLabels;
        _dataNames = dataNames;
        _parameters = parameters;
    }

    public StatementLine Correct(StatementLine line)
    {
        if (line.Raw is not null || line.Operation is null && !line.IsFunctionFollower)
        {
            return line;
        }

        if (line.IsFunctionFollower)
        {
            return new StatementLine { Operands = [CorrectExpression(line.Operands.FirstOrDefault() ?? string.Empty)], Comment = line.Comment, IsFunctionFollower = true };
        }

        var operation = line.Operation!;
        var label = line.Label is null || line.LabelIsFinal ? line.Label : OperandKinds.LabelIsEntity(operation) ? Entity(line.Label) : Label(line.Label);
        var operands = new List<string>(line.Operands.Count);
        for (var index = 0; index < line.Operands.Count; index++)
        {
            operands.Add(CorrectOperand(operation, index, line.Operands));
        }

        return new StatementLine
        {
            Label = label, Operation = operation, Auxiliary = line.Auxiliary, Operands = operands, Comment = line.Comment,
        };
    }

    private string CorrectOperand(string operation, int index, IReadOnlyList<string> operands)
    {
        var operand = operands[index];
        if (operand.Length == 0)
        {
            return operand;
        }

        var kind = operation == "TRANSFER" ? TransferKind(index, operands) : OperandKinds.Of(operation, index, operand);
        return kind switch
        {
            OperandKind.Keyword => operation == "TRANSFER" && index == 0 && OperandKinds.IsTransferFraction(operand) ? CorrectExpression(operand) : operand,
            OperandKind.Label => IsPlainName(operand) ? Label(operand) : CorrectExpression(operand),
            OperandKind.Parameter => IsParameterName(operand) ? operand : CorrectExpression(operand),
            _ => CorrectSuffixed(operand),
        };
    }

    private static OperandKind TransferKind(int index, IReadOnlyList<string> operands)
    {
        var mode = operands[0].ToUpperInvariant();
        return (mode, index) switch
        {
            (_, 0) => OperandKind.Keyword,
            ("SBR", 2) => OperandKind.Parameter,
            ("P", 1) => OperandKind.Parameter,
            ("P", 2) => OperandKind.Expression,
            ("ALL", 3) => OperandKind.Expression,
            _ => OperandKind.Label,
        };
    }

    /// <summary>Entity operand that may carry a "+" / "-" suffix (SAVEVALUE A+, MSAVEVALUE A-).</summary>
    private string CorrectSuffixed(string operand)
    {
        if ((operand.EndsWith('+') || operand.EndsWith('-')) && IsPlainName(operand[..^1]))
        {
            return Entity(operand[..^1]) + operand[^1];
        }

        return CorrectExpression(operand);
    }

    /// <summary>Corrects every identifier of an expression according to its role.</summary>
    public string CorrectExpression(string text)
    {
        var builder = new StringBuilder(text.Length + 16);
        var i = 0;
        while (i < text.Length)
        {
            var ch = text[i];
            if (ch is '"' or '\'')
            {
                var end = text.IndexOf(ch, i + 1);
                end = end < 0 ? text.Length - 1 : end;
                builder.Append(text, i, end - i + 1);
                i = end + 1;
                continue;
            }

            if (char.IsDigit(ch) || (ch == '.' && i + 1 < text.Length && char.IsDigit(text[i + 1])))
            {
                // Numbers, including exponents such as 1E5 and suffixes that are not names.
                var start = i;
                while (i < text.Length && (char.IsLetterOrDigit(text[i]) || text[i] == '.' || ((text[i] is '+' or '-') && i > start && text[i - 1] is 'e' or 'E')))
                {
                    i++;
                }

                builder.Append(text, start, i - start);
                continue;
            }

            if (!char.IsLetter(ch) && ch != '_')
            {
                builder.Append(ch);
                i++;
                continue;
            }

            var identifierStart = i;
            while (i < text.Length && (char.IsLetterOrDigit(text[i]) || text[i] == '_'))
            {
                i++;
            }

            var identifier = text[identifierStart..i];
            if (i < text.Length && text[i] == '$')
            {
                // SNA with a named entity: FAMILY$Name.
                var nameStart = i + 1;
                var nameEnd = nameStart;
                while (nameEnd < text.Length && (char.IsLetterOrDigit(text[nameEnd]) || text[nameEnd] == '_'))
                {
                    nameEnd++;
                }

                var name = text[nameStart..nameEnd];
                builder.Append(identifier).Append('$');
                builder.Append(ParameterFamilies.Contains(identifier) ? name : LabelFamilies.Contains(identifier) ? Label(name) : Entity(name));
                i = nameEnd;
                continue;
            }

            if (i < text.Length && text[i] == '*' && ExpressionParser.Families.Contains(identifier))
            {
                // Indirect addressing: the parameter name after "*" (and an optional "$") is kept.
                var parameterEnd = i + 1;
                if (parameterEnd < text.Length && text[parameterEnd] == '$')
                {
                    parameterEnd++;
                }

                while (parameterEnd < text.Length && (char.IsLetterOrDigit(text[parameterEnd]) || text[parameterEnd] == '_'))
                {
                    parameterEnd++;
                }

                builder.Append(text, identifierStart, parameterEnd - identifierStart);
                i = parameterEnd;
                continue;
            }

            var next = i;
            while (next < text.Length && text[next] == ' ')
            {
                next++;
            }

            var isCall = next < text.Length && text[next] == '(' && !ExpressionParser.Families.Contains(identifier);
            var precededByIndirect = identifierStart > 0 && text[identifierStart - 1] == '*'
                                     && (identifierStart == 1 || !char.IsLetterOrDigit(text[identifierStart - 2]) && text[identifierStart - 2] != ')');
            if (isCall || precededByIndirect || IsSnaWithoutName(identifier) || Reserved.Contains(identifier))
            {
                builder.Append(identifier);
                continue;
            }

            builder.Append(Entity(identifier));
        }

        return builder.ToString();
    }

    private static bool IsSnaWithoutName(string identifier)
    {
        if (AtomicSnas.Contains(identifier))
        {
            return true;
        }

        // Numbered SNA such as Q3, P1, FN2, RN1.
        var digits = identifier.Length;
        while (digits > 0 && char.IsDigit(identifier[digits - 1]))
        {
            digits--;
        }

        return digits < identifier.Length && digits > 0 && ExpressionParser.Families.Contains(identifier[..digits]);
    }

    public string Entity(string name)
    {
        if (_parameters.TryGetValue(name, out var value))
        {
            return value;
        }

        if (_dataNames.TryGetValue(name, out var qualified))
        {
            return qualified;
        }

        if (_localLabels.Contains(name) || _outputLabels.ContainsKey(name))
        {
            return Label(name);
        }

        return _prefix + name;
    }

    public string Label(string name)
    {
        if (_outputLabels.TryGetValue(name, out var target))
        {
            return target;
        }

        return _prefix + name;
    }

    /// <summary>Parameter names are kept: "Size", "Count+" (ASSIGN increments), "PR", "P$Name".</summary>
    private static bool IsParameterName(string operand)
    {
        var name = operand.TrimEnd('+', '-');
        if (name.StartsWith("P$", StringComparison.OrdinalIgnoreCase))
        {
            name = name[2..];
        }

        return IsPlainName(name) || name.All(char.IsDigit);
    }

    private static bool IsPlainName(string text) =>
        text.Length > 0 && (char.IsLetter(text[0]) || text[0] == '_') && text.All(ch => char.IsLetterOrDigit(ch) || ch == '_');
}
