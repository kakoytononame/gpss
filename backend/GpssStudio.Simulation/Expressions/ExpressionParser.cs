using System.Globalization;
using System.Text.RegularExpressions;

namespace GpssStudio.Simulation.Expressions;

/// <summary>
/// Recursive-descent parser for GPSS World expressions: numbers, strings, names, SNAs (<c>Q$BUF</c>,
/// <c>P1</c>, <c>RN2</c>, indirect <c>Q*Param</c>, matrix cells <c>MX$Name(r,c)</c>), library procedures
/// and operators with the GPSS World precedence (highest first): <c>^</c>; <c># * / \</c>; <c>@</c>;
/// <c>+ -</c>; <c>&lt; &lt;= &gt; &gt;=</c> ('L' 'LE' 'G' 'GE'); <c>= !=</c> ('E' 'NE'); <c>&amp;</c> ('AND'); <c>|</c> ('OR').
/// </summary>
public sealed partial class ExpressionParser
{
    /// <summary>SNA families that take an argument after <c>$</c> (or a number, e.g. <c>Q1</c>).</summary>
    public static readonly HashSet<string> Families = new(StringComparer.OrdinalIgnoreCase)
    {
        "Q", "QA", "QM", "QC", "QZ", "QT", "QX", "F", "FC", "FR", "FT", "FI", "FV",
        "S", "R", "SR", "SM", "SC", "SA", "ST", "SE", "SF", "SV", "X", "P", "FN", "V", "BV",
        "N", "W", "LS", "LR", "TB", "TC", "TD", "CH", "CA", "CM", "CC", "CT", "RN", "MX", "GN", "GT", "MB",
    };

    /// <summary>Attributes that need no argument.</summary>
    private static readonly HashSet<string> StandaloneSnas = new(StringComparer.OrdinalIgnoreCase)
    {
        "AC1", "C1", "M1", "MP", "XN1", "PR", "TG1", "A1",
    };

    private readonly string _text;
    private int _position;

    private ExpressionParser(string text)
    {
        _text = text;
    }

    public static Expr Parse(string text)
    {
        var parser = new ExpressionParser(text.Trim());
        if (parser._text.Length == 0)
        {
            throw new FormatException("Пустое выражение.");
        }

        var result = parser.ParseOr();
        parser.SkipWhitespace();
        if (parser._position < parser._text.Length)
        {
            throw new FormatException($"Лишние символы в выражении \"{text}\" с позиции {parser._position + 1}.");
        }

        return result;
    }

    private Expr ParseOr()
    {
        var left = ParseAnd();
        while (TryConsume("|") || TryConsumeWord("'OR'"))
        {
            left = new BinaryExpr("|", left, ParseAnd());
        }

        return left;
    }

    private Expr ParseAnd()
    {
        var left = ParseEquality();
        while (TryConsume("&") || TryConsumeWord("'AND'"))
        {
            left = new BinaryExpr("&", left, ParseEquality());
        }

        return left;
    }

    private Expr ParseEquality()
    {
        var left = ParseRelational();
        while (TryConsumeOperator([("'NE'", "!="), ("'E'", "="), ("!=", "!="), ("/=", "!="), ("<>", "!="), ("=", "=")]) is { } op)
        {
            left = new BinaryExpr(op, left, ParseRelational());
        }

        return left;
    }

    private Expr ParseRelational()
    {
        var left = ParseAdditive();
        while (TryConsumeOperator([("'GE'", ">="), ("'LE'", "<="), ("'G'", ">"), ("'L'", "<"), ("<=", "<="), (">=", ">="), ("<", "<"), (">", ">")]) is { } op)
        {
            left = new BinaryExpr(op, left, ParseAdditive());
        }

        return left;
    }

    private string? TryConsumeOperator(ReadOnlySpan<(string Token, string Operator)> operators)
    {
        SkipWhitespace();
        foreach (var (token, op) in operators)
        {
            // "<" must not swallow "<>", which belongs to the equality level.
            if (token == "<" && _position + 1 < _text.Length && _text[_position + 1] == '>')
            {
                continue;
            }

            if (string.Compare(_text, _position, token, 0, token.Length, StringComparison.OrdinalIgnoreCase) == 0)
            {
                _position += token.Length;
                return op;
            }
        }

        return null;
    }

    private bool TryConsumeWord(string word) => TryConsumeOperator([(word, word)]) is not null;

    private bool NextIs(string token)
    {
        SkipWhitespace();
        return string.CompareOrdinal(_text, _position, token, 0, token.Length) == 0;
    }

    private Expr ParseAdditive()
    {
        var left = ParseModulo();
        while (true)
        {
            if (TryConsume("+"))
            {
                left = new BinaryExpr("+", left, ParseModulo());
            }
            else if (TryConsume("-"))
            {
                left = new BinaryExpr("-", left, ParseModulo());
            }
            else
            {
                return left;
            }
        }
    }

    private Expr ParseModulo()
    {
        var left = ParseTerm();
        while (TryConsume("@"))
        {
            left = new BinaryExpr("@", left, ParseTerm());
        }

        return left;
    }

    private Expr ParseTerm()
    {
        var left = ParsePower();
        while (true)
        {
            // "#" is the GPSS World multiplication operator; "*" is accepted as well.
            // "/=" is the PLUS "not equal" operator, not a division.
            string? op = TryConsume("#") || TryConsume("*") ? "*" : !NextIs("/=") && TryConsume("/") ? "/" : TryConsume("\\") ? "\\" : null;
            if (op is null)
            {
                return left;
            }

            left = new BinaryExpr(op, left, ParsePower());
        }
    }

    private Expr ParsePower()
    {
        var left = ParseUnary();
        return TryConsume("^") ? new BinaryExpr("^", left, ParsePower()) : left;
    }

    private Expr ParseUnary()
    {
        if (TryConsume("-"))
        {
            return new UnaryExpr('-', ParseUnary());
        }

        return TryConsume("+") ? ParseUnary() : ParsePrimary();
    }

    private Expr ParsePrimary()
    {
        SkipWhitespace();
        if (_position >= _text.Length)
        {
            throw new FormatException("Неожиданный конец выражения.");
        }

        if (TryConsume("("))
        {
            var inner = ParseOr();
            Expect(")");
            return inner;
        }

        if (_text[_position] == '"')
        {
            var end = _text.IndexOf('"', _position + 1);
            if (end < 0)
            {
                throw new FormatException("Незакрытая строковая константа.");
            }

            var literal = _text[(_position + 1)..end];
            _position = end + 1;
            return new StringExpr(literal);
        }

        if (_text[_position] == '*')
        {
            // "*Param" is the value of a parameter of the active transaction.
            _position++;
            return new SnaExpr("P", ReadSpecifier());
        }

        var numberMatch = NumberPattern().Match(_text, _position);
        if (numberMatch.Success && numberMatch.Index == _position)
        {
            _position += numberMatch.Length;
            return new NumberExpr(double.Parse(numberMatch.Value, CultureInfo.InvariantCulture));
        }

        var identifierMatch = IdentifierPattern().Match(_text, _position);
        if (!identifierMatch.Success || identifierMatch.Index != _position)
        {
            throw new FormatException($"Неожиданный символ \"{_text[_position]}\" в выражении.");
        }

        _position += identifierMatch.Length;
        var identifier = identifierMatch.Value;

        // Indirect addressing: "Q*Param", "FN*2", "MX*Sales(...)".
        if (_position < _text.Length && _text[_position] == '*' && Families.Contains(identifier) && _position + 1 < _text.Length
            && (char.IsLetterOrDigit(_text[_position + 1]) || _text[_position + 1] is '_' or '$'))
        {
            _position++;
            var parameter = ReadSpecifier();
            var family = identifier.ToUpperInvariant();
            return family == "MX" ? ParseMatrixCell(parameter, indirect: true) : new SnaExpr(family, parameter, indirect: true);
        }

        var dollar = identifier.IndexOf('$');
        if (dollar > 0 && identifier[..dollar].Equals("MX", StringComparison.OrdinalIgnoreCase))
        {
            return ParseMatrixCell(identifier[(dollar + 1)..], indirect: false);
        }

        var numberedMatrix = NumberedSnaPattern().Match(identifier);
        if (numberedMatrix.Success && numberedMatrix.Groups[1].Value.Equals("MX", StringComparison.OrdinalIgnoreCase))
        {
            return ParseMatrixCell(numberedMatrix.Groups[2].Value, indirect: false);
        }

        SkipWhitespace();
        if (_position < _text.Length && _text[_position] == '(' && !identifier.Contains('$'))
        {
            _position++;
            var arguments = new List<Expr>();
            if (!TryConsume(")"))
            {
                do
                {
                    arguments.Add(ParseOr());
                }
                while (TryConsume(","));

                Expect(")");
            }

            return new CallExpr(identifier, arguments);
        }

        return ParseIdentifier(identifier);
    }

    /// <summary>Name or number after "*" or "$" ("$" in "*$Name" is optional).</summary>
    private string ReadSpecifier()
    {
        if (_position < _text.Length && _text[_position] == '$')
        {
            _position++;
        }

        var match = SpecifierPattern().Match(_text, _position);
        if (!match.Success || match.Index != _position)
        {
            throw new FormatException("Ожидалось имя или номер после \"*\".");
        }

        _position += match.Length;
        return match.Value;
    }

    /// <summary>MX$Name(row,column): the row and column may themselves use indirect addressing.</summary>
    private Expr ParseMatrixCell(string matrix, bool indirect)
    {
        Expect("(");
        var row = ParseOr();
        Expect(",");
        var column = ParseOr();
        Expect(")");
        return new MatrixCellExpr(matrix, indirect, row, column);
    }

    /// <summary>Classifies an identifier as SNA or plain name.</summary>
    public static Expr ParseIdentifier(string identifier)
    {
        var dollar = identifier.IndexOf('$');
        if (dollar > 0)
        {
            var family = identifier[..dollar].ToUpperInvariant();
            var argument = identifier[(dollar + 1)..];
            if (!Families.Contains(family) || argument.Length == 0)
            {
                throw new FormatException($"Неизвестный СЧА \"{identifier}\".");
            }

            return new SnaExpr(family, argument);
        }

        if (StandaloneSnas.Contains(identifier))
        {
            return new SnaExpr(identifier.ToUpperInvariant(), string.Empty);
        }

        var numbered = NumberedSnaPattern().Match(identifier);
        if (numbered.Success && Families.Contains(numbered.Groups[1].Value))
        {
            return new SnaExpr(numbered.Groups[1].Value.ToUpperInvariant(), numbered.Groups[2].Value);
        }

        return new NameExpr(identifier);
    }

    private bool TryConsume(string token)
    {
        SkipWhitespace();
        if (string.Compare(_text, _position, token, 0, token.Length, StringComparison.Ordinal) == 0)
        {
            _position += token.Length;
            return true;
        }

        return false;
    }

    private void Expect(string token)
    {
        if (!TryConsume(token))
        {
            throw new FormatException($"Ожидался символ \"{token}\".");
        }
    }

    private void SkipWhitespace()
    {
        while (_position < _text.Length && char.IsWhiteSpace(_text[_position]))
        {
            _position++;
        }
    }

    [GeneratedRegex(@"(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?")]
    private static partial Regex NumberPattern();

    [GeneratedRegex(@"[\p{L}_][\p{L}\p{N}_$]*")]
    private static partial Regex IdentifierPattern();

    [GeneratedRegex(@"^([A-Za-z]+)(\d+)$")]
    private static partial Regex NumberedSnaPattern();

    [GeneratedRegex(@"[\p{L}\p{N}_]+")]
    private static partial Regex SpecifierPattern();
}
