using System.Globalization;
using System.Text.RegularExpressions;

namespace GpssStudio.Simulation.Expressions;

/// <summary>
/// Recursive-descent parser for GPSS World expressions:
/// numbers, names, SNAs (<c>Q$BUF</c>, <c>P1</c>, <c>RN2</c>), library procedures and operators
/// <c>+ - * / \ @ ^</c>, comparisons (<c>= != &lt; &lt;= &gt; &gt;=</c>, <c>'G'</c> etc.) and <c>&amp; |</c>.
/// </summary>
public sealed partial class ExpressionParser
{
    /// <summary>SNA families that take an argument after <c>$</c> (or a number, e.g. <c>Q1</c>).</summary>
    public static readonly HashSet<string> Families = new(StringComparer.OrdinalIgnoreCase)
    {
        "Q", "QA", "QM", "QC", "QZ", "QT", "QX", "F", "FC", "FR", "FT", "FI", "FV",
        "S", "R", "SR", "SM", "SC", "SA", "ST", "SE", "SF", "SV", "X", "P", "FN", "V", "BV",
        "N", "W", "LS", "LR", "TB", "TC", "TD", "CH", "CA", "CM", "CC", "RN",
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
        while (TryConsume("|"))
        {
            left = new BinaryExpr("|", left, ParseAnd());
        }

        return left;
    }

    private Expr ParseAnd()
    {
        var left = ParseComparison();
        while (TryConsume("&"))
        {
            left = new BinaryExpr("&", left, ParseComparison());
        }

        return left;
    }

    private Expr ParseComparison()
    {
        var left = ParseAdditive();
        while (true)
        {
            var op = TryConsumeComparison();
            if (op is null)
            {
                return left;
            }

            left = new BinaryExpr(op, left, ParseAdditive());
        }
    }

    private string? TryConsumeComparison()
    {
        SkipWhitespace();
        foreach (var (token, op) in new[]
                 {
                     ("'GE'", ">="), ("'LE'", "<="), ("'NE'", "!="), ("'G'", ">"), ("'L'", "<"), ("'E'", "="),
                     ("<=", "<="), (">=", ">="), ("!=", "!="), ("<>", "!="), ("<", "<"), (">", ">"), ("=", "="),
                 })
        {
            if (string.Compare(_text, _position, token, 0, token.Length, StringComparison.OrdinalIgnoreCase) == 0)
            {
                _position += token.Length;
                return op;
            }
        }

        return null;
    }

    private Expr ParseAdditive()
    {
        var left = ParseTerm();
        while (true)
        {
            if (TryConsume("+"))
            {
                left = new BinaryExpr("+", left, ParseTerm());
            }
            else if (TryConsume("-"))
            {
                left = new BinaryExpr("-", left, ParseTerm());
            }
            else
            {
                return left;
            }
        }
    }

    private Expr ParseTerm()
    {
        var left = ParsePower();
        while (true)
        {
            string? op = TryConsume("*") ? "*" : TryConsume("/") ? "/" : TryConsume("\\") ? "\\" : TryConsume("@") ? "@" : null;
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
}
