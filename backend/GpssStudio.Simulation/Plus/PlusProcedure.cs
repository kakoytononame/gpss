using System.Text.RegularExpressions;
using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Runtime;

namespace GpssStudio.Simulation.Plus;

/// <summary>
/// PLUS procedure of GPSS World (<c>PROCEDURE Name(args) Statement</c>): TEMPORARY variables, assignment,
/// BEGIN/END, IF/THEN/ELSE, WHILE/DO, GOTO with statement labels, RETURN and procedure calls.
/// Expressions use the GPSS World syntax; names that are not temporary refer to global user variables.
/// </summary>
public sealed class PlusProcedure
{
    private const int MaxDepth = 200;
    private const long MaxStatements = 5_000_000;

    public required string Name { get; init; }
    public required IReadOnlyList<string> Parameters { get; init; }
    public required PlusStatement Body { get; init; }

    /// <summary>EXPERIMENT procedures run only via CONDUCT (not supported); they are kept for completeness.</summary>
    public bool IsExperiment { get; init; }

    public double Invoke(SimulationEngine engine, Transaction? transaction, IReadOnlyList<double> arguments, int depth = 0)
    {
        if (depth > MaxDepth)
        {
            throw new SimulationException($"Процедура {Name}: превышена глубина вложенных вызовов ({MaxDepth}).");
        }

        if (arguments.Count != Parameters.Count)
        {
            throw new SimulationException($"Процедура {Name} ожидает аргументов: {Parameters.Count}, передано: {arguments.Count}.");
        }

        var frame = new PlusFrame(engine, transaction, this, depth);
        for (var index = 0; index < Parameters.Count; index++)
        {
            frame.Locals[Parameters[index]] = arguments[index];
        }

        try
        {
            frame.Execute(Body);
        }
        catch (PlusReturn result)
        {
            return result.Value;
        }

        return 0;
    }

    internal sealed class PlusReturn(double value) : Exception
    {
        public double Value { get; } = value;
    }

    internal sealed class PlusGoto(string label) : Exception
    {
        public string Label { get; } = label;
    }

    /// <summary>Activation record: temporary variables; other names are delegated to the engine.</summary>
    private sealed class PlusFrame(SimulationEngine engine, Transaction? transaction, PlusProcedure procedure, int depth) : IEvaluationContext
    {
        private long _executed;

        public Dictionary<string, double> Locals { get; } = new(StringComparer.OrdinalIgnoreCase);

        public void Execute(PlusStatement statement)
        {
            while (true)
            {
                try
                {
                    Run(statement);
                    return;
                }
                catch (PlusGoto jump)
                {
                    // Labels are searched in the whole body: execution resumes at the labelled statement.
                    if (!procedure.Body.TryFindLabel(jump.Label, out var target))
                    {
                        throw new SimulationException($"Процедура {procedure.Name}: метка {jump.Label} не найдена.");
                    }

                    statement = target;
                }
            }
        }

        private void Run(PlusStatement statement)
        {
            if (++_executed > MaxStatements)
            {
                throw new SimulationException($"Процедура {procedure.Name}: превышено число выполняемых операторов (возможен бесконечный цикл).");
            }

            switch (statement)
            {
                case PlusStatement.Block block:
                    foreach (var item in block.Statements)
                    {
                        Run(item);
                    }

                    break;
                case PlusStatement.Temporary temporary:
                    foreach (var name in temporary.Names)
                    {
                        Locals[name] = 0;
                    }

                    break;
                case PlusStatement.Assign assign:
                {
                    var value = Eval(assign.Value);
                    if (Locals.ContainsKey(assign.Target))
                    {
                        Locals[assign.Target] = value;
                    }
                    else
                    {
                        engine.SetUserVariable(assign.Target, value);
                    }

                    break;
                }
                case PlusStatement.If branch:
                    if (Eval(branch.Condition) != 0)
                    {
                        Run(branch.Then);
                    }
                    else if (branch.Else is not null)
                    {
                        Run(branch.Else);
                    }

                    break;
                case PlusStatement.While loop:
                    while (Eval(loop.Condition) != 0)
                    {
                        Run(loop.Body);
                        if (++_executed > MaxStatements)
                        {
                            throw new SimulationException($"Процедура {procedure.Name}: цикл WHILE не завершается.");
                        }
                    }

                    break;
                case PlusStatement.Return result:
                    throw new PlusReturn(result.Value is null ? 0 : Eval(result.Value));
                case PlusStatement.Goto jump:
                    throw new PlusGoto(jump.Label);
                case PlusStatement.Call call:
                    Eval(call.Expression);
                    break;
                case PlusStatement.Labeled labeled:
                    Run(labeled.Statement);
                    break;
            }
        }

        private double Eval(Expr expression) => expression.Evaluate(this, transaction);

        public double Sna(string family, string argument, Transaction? active) => engine.Sna(family, argument, active);

        public double NameValue(string name) => Locals.TryGetValue(name, out var value) ? value : engine.NameValue(name);

        public double Random(int stream) => engine.Random(stream);

        public double MatrixValue(string matrix, int row, int column) => engine.MatrixValue(matrix, row, column);

        public double CallProcedure(string name, IReadOnlyList<double> arguments, Transaction? active) => engine.CallProcedure(name, arguments, active, depth + 1);
    }
}

/// <summary>Statements of a PLUS procedure body.</summary>
public abstract record PlusStatement
{
    public sealed record Block(IReadOnlyList<PlusStatement> Statements) : PlusStatement;
    public sealed record Temporary(IReadOnlyList<string> Names) : PlusStatement;
    public sealed record Assign(string Target, Expr Value) : PlusStatement;
    public sealed record If(Expr Condition, PlusStatement Then, PlusStatement? Else) : PlusStatement;
    public sealed record While(Expr Condition, PlusStatement Body) : PlusStatement;
    public sealed record Return(Expr? Value) : PlusStatement;
    public sealed record Goto(string Label) : PlusStatement;
    public sealed record Call(Expr Expression) : PlusStatement;
    public sealed record Labeled(string Label, PlusStatement Statement) : PlusStatement;
    public sealed record Empty : PlusStatement;

    /// <summary>
    /// A labelled statement and the statements after it: GOTO continues with the rest of the enclosing
    /// block. The continuation is built as a block of the labelled statement and its following siblings.
    /// </summary>
    public bool TryFindLabel(string label, out PlusStatement target)
    {
        target = null!;
        switch (this)
        {
            case Block block:
                for (var index = 0; index < block.Statements.Count; index++)
                {
                    var item = block.Statements[index];
                    if (item is Labeled labeled && labeled.Label.Equals(label, StringComparison.OrdinalIgnoreCase))
                    {
                        target = new Block(block.Statements.Skip(index).ToList());
                        return true;
                    }

                    if (item.TryFindLabel(label, out var inner))
                    {
                        // Jumping into a nested statement continues with the rest of this block afterwards.
                        target = new Block([inner, .. block.Statements.Skip(index + 1)]);
                        return true;
                    }
                }

                return false;
            case If branch:
                return branch.Then.TryFindLabel(label, out target) || (branch.Else?.TryFindLabel(label, out target) ?? false);
            case While loop:
                return loop.Body.TryFindLabel(label, out target);
            case Labeled labeled:
                if (labeled.Label.Equals(label, StringComparison.OrdinalIgnoreCase))
                {
                    target = labeled;
                    return true;
                }

                return labeled.Statement.TryFindLabel(label, out target);
            default:
                return false;
        }
    }
}

/// <summary>Parser of PLUS procedure text (the whole <c>PROCEDURE ... END;</c> statement).</summary>
public sealed partial class PlusParser
{
    private readonly string _text;
    private int _position;

    private PlusParser(string text)
    {
        _text = text;
    }

    /// <summary>The line starts a PLUS procedure or experiment definition.</summary>
    public static bool StartsProcedure(string line) => ProcedureStartPattern().IsMatch(line);

    /// <summary>
    /// Index of the last line of the procedure starting at <paramref name="start"/>: the END that closes the
    /// body's BEGIN, or the first ";" of a single-statement body. Comment lines ("*") are skipped.
    /// </summary>
    public static int FindEnd(IReadOnlyList<string> lines, int start)
    {
        var depth = 0;
        var sawBody = false;
        var afterHeader = false;
        var parentheses = 0;
        for (var index = start; index < lines.Count; index++)
        {
            var line = lines[index];
            if (index > start && line.TrimStart().StartsWith('*'))
            {
                continue;
            }

            var inQuotes = false;
            for (var position = 0; position < line.Length; position++)
            {
                var ch = line[position];
                if (ch == '"')
                {
                    inQuotes = !inQuotes;
                    continue;
                }

                if (inQuotes)
                {
                    continue;
                }

                if (!afterHeader)
                {
                    // The header ends with the closing parenthesis of the argument list.
                    if (ch == '(')
                    {
                        parentheses++;
                    }
                    else if (ch == ')' && --parentheses == 0)
                    {
                        afterHeader = true;
                    }

                    continue;
                }

                if (char.IsLetter(ch) && (position == 0 || !IsWordChar(line[position - 1])))
                {
                    var end = position;
                    while (end < line.Length && IsWordChar(line[end]))
                    {
                        end++;
                    }

                    var word = line[position..end].ToUpperInvariant();
                    if (word == "BEGIN")
                    {
                        depth++;
                        sawBody = true;
                    }
                    else if (word == "END" && --depth == 0 && sawBody)
                    {
                        return index;
                    }

                    sawBody = true;
                    position = end - 1;
                }
                else if (ch == ';' && depth == 0 && sawBody)
                {
                    return index;
                }
            }
        }

        return lines.Count - 1;
    }

    private static bool IsWordChar(char ch) => char.IsLetterOrDigit(ch) || ch == '_';

    public static PlusProcedure ParseProcedure(string text)
    {
        var parser = new PlusParser(StripCommentLines(text));
        var keyword = parser.ReadWord();
        var isExperiment = keyword.Equals("EXPERIMENT", StringComparison.OrdinalIgnoreCase);
        if (!isExperiment && !keyword.Equals("PROCEDURE", StringComparison.OrdinalIgnoreCase))
        {
            throw new FormatException("ожидалось PROCEDURE или EXPERIMENT.");
        }

        var name = parser.ReadWord();
        if (name.Length == 0)
        {
            throw new FormatException("не задано имя процедуры.");
        }

        parser.Expect('(');
        var parameters = parser.ReadUntil(')').Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).ToList();
        parser.Expect(')');
        var body = parser.ParseStatement();
        parser.SkipSeparators();
        if (parser._position < parser._text.Length)
        {
            throw new FormatException($"лишний текст после тела процедуры {name}: \"{Shorten(parser._text[parser._position..])}\".");
        }

        return new PlusProcedure { Name = name, Parameters = parameters, Body = body, IsExperiment = isExperiment };
    }

    private PlusStatement ParseStatement()
    {
        SkipWhitespace();
        var start = _position;
        var word = PeekWord();
        switch (word.ToUpperInvariant())
        {
            case "BEGIN":
            {
                ReadWord();
                var statements = new List<PlusStatement>();
                while (true)
                {
                    SkipSeparators();
                    if (_position >= _text.Length)
                    {
                        throw new FormatException("не найден END для BEGIN.");
                    }

                    if (PeekWord().Equals("END", StringComparison.OrdinalIgnoreCase))
                    {
                        ReadWord();
                        ConsumeOptional(';');
                        return new PlusStatement.Block(statements);
                    }

                    statements.Add(ParseStatement());
                }
            }
            case "TEMPORARY":
            {
                ReadWord();
                var list = ReadUntil(';');
                ConsumeOptional(';');
                if (list.TrimStart().StartsWith("MATRIX", StringComparison.OrdinalIgnoreCase))
                {
                    throw new FormatException("TEMPORARY MATRIX не поддерживается.");
                }

                return new PlusStatement.Temporary(list.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries));
            }
            case "IF":
            {
                ReadWord();
                var condition = ParseParenthesized();
                if (!ReadWord().Equals("THEN", StringComparison.OrdinalIgnoreCase))
                {
                    throw new FormatException("ожидалось THEN после условия IF.");
                }

                var then = ParseStatement();
                var save = _position;
                SkipSeparators();
                if (PeekWord().Equals("ELSE", StringComparison.OrdinalIgnoreCase))
                {
                    ReadWord();
                    return new PlusStatement.If(condition, then, ParseStatement());
                }

                _position = save;
                return new PlusStatement.If(condition, then, null);
            }
            case "WHILE":
            {
                ReadWord();
                var condition = ParseParenthesized();
                if (!ReadWord().Equals("DO", StringComparison.OrdinalIgnoreCase))
                {
                    throw new FormatException("ожидалось DO после условия WHILE.");
                }

                return new PlusStatement.While(condition, ParseStatement());
            }
            case "RETURN":
            {
                ReadWord();
                var value = ReadUntil(';').Trim();
                ConsumeOptional(';');
                return new PlusStatement.Return(value.Length == 0 ? null : ParseExpression(value));
            }
            case "END":
                throw new FormatException("END без соответствующего BEGIN.");
            case "GOTO":
            {
                ReadWord();
                var label = ReadUntil(';').Trim();
                ConsumeOptional(';');
                return new PlusStatement.Goto(label);
            }
        }

        if (_position < _text.Length && _text[_position] == ';')
        {
            _position++;
            return new PlusStatement.Empty();
        }

        // "Label: statement"
        if (word.Length > 0)
        {
            var afterWord = _position + word.Length;
            var colon = afterWord;
            while (colon < _text.Length && char.IsWhiteSpace(_text[colon]))
            {
                colon++;
            }

            if (colon < _text.Length && _text[colon] == ':')
            {
                _position = colon + 1;
                return new PlusStatement.Labeled(word, ParseStatement());
            }
        }

        var statementText = ReadUntil(';');
        ConsumeOptional(';');
        var assignment = AssignmentPattern().Match(statementText);
        if (assignment.Success)
        {
            return new PlusStatement.Assign(assignment.Groups[1].Value, ParseExpression(assignment.Groups[2].Value));
        }

        if (statementText.Trim().Length == 0)
        {
            throw new FormatException($"пустой оператор в позиции {start + 1}.");
        }

        return new PlusStatement.Call(ParseExpression(statementText));
    }

    private Expr ParseParenthesized()
    {
        SkipWhitespace();
        Expect('(');
        var depth = 1;
        var start = _position;
        var inQuotes = false;
        for (; _position < _text.Length; _position++)
        {
            var ch = _text[_position];
            if (ch == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (!inQuotes && ch == '(')
            {
                depth++;
            }
            else if (!inQuotes && ch == ')' && --depth == 0)
            {
                var inner = _text[start.._position];
                _position++;
                return ParseExpression(inner);
            }
        }

        throw new FormatException("не закрыта скобка в условии.");
    }

    private static Expr ParseExpression(string text)
    {
        try
        {
            return ExpressionParser.Parse(text);
        }
        catch (FormatException exception)
        {
            throw new FormatException($"выражение \"{Shorten(text.Trim())}\": {exception.Message}");
        }
    }

    /// <summary>Text up to (not including) the given character at nesting depth 0, outside strings.</summary>
    private string ReadUntil(char terminator)
    {
        var start = _position;
        var depth = 0;
        var inQuotes = false;
        for (; _position < _text.Length; _position++)
        {
            var ch = _text[_position];
            if (ch == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (!inQuotes && ch == '(' && terminator != '(')
            {
                depth++;
            }
            else if (!inQuotes && ch == ')' && depth > 0)
            {
                depth--;
            }
            else if (!inQuotes && depth == 0 && ch == terminator)
            {
                break;
            }
        }

        return _text[start.._position];
    }

    private string PeekWord()
    {
        SkipWhitespace();
        var match = WordPattern().Match(_text, _position);
        return match.Success && match.Index == _position ? match.Value : string.Empty;
    }

    private string ReadWord()
    {
        var word = PeekWord();
        _position += word.Length;
        return word;
    }

    private void Expect(char ch)
    {
        SkipWhitespace();
        if (_position >= _text.Length || _text[_position] != ch)
        {
            throw new FormatException($"ожидался символ \"{ch}\".");
        }

        _position++;
    }

    private void ConsumeOptional(char ch)
    {
        SkipWhitespace();
        if (_position < _text.Length && _text[_position] == ch)
        {
            _position++;
        }
    }

    private void SkipWhitespace()
    {
        while (_position < _text.Length && char.IsWhiteSpace(_text[_position]))
        {
            _position++;
        }
    }

    private void SkipSeparators()
    {
        while (_position < _text.Length && (char.IsWhiteSpace(_text[_position]) || _text[_position] == ';'))
        {
            _position++;
        }
    }

    /// <summary>Lines starting with "*" are comments in GPSS World model files, also between PLUS statements.</summary>
    private static string StripCommentLines(string text) =>
        string.Join('\n', text.Replace("\r\n", "\n").Split('\n').Select(line => line.TrimStart().StartsWith('*') ? string.Empty : line));

    private static string Shorten(string text) => text.Length > 60 ? text[..60] + "…" : text;

    [GeneratedRegex(@"^\s*(PROCEDURE|EXPERIMENT)\s+[A-Za-zА-Яа-яЁё_]", RegexOptions.IgnoreCase)]
    private static partial Regex ProcedureStartPattern();

    [GeneratedRegex(@"\G[A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*")]
    private static partial Regex WordPattern();

    [GeneratedRegex(@"^\s*([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)\s*=(?!=)(.*)$", RegexOptions.Singleline)]
    private static partial Regex AssignmentPattern();
}
