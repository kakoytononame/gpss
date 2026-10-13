using System.Globalization;
using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Parsing;
using GpssStudio.Simulation.Reporting;
using GpssStudio.Simulation.Runtime;
using GpssStudio.Simulation.Translation;

namespace GpssStudio.Simulation;

/// <summary>Outcome of translating a model or executing a command.</summary>
public sealed class SimulationResult
{
    public string? SessionId { get; init; }
    public required bool Success { get; init; }

    /// <summary>idle | paused | completed | error.</summary>
    public required string State { get; init; }

    public double Clock { get; init; }
    public int TerminationCount { get; init; }
    public IReadOnlyList<TranslationError> Errors { get; init; } = [];
    public string? RuntimeError { get; init; }

    /// <summary>Journal lines produced by this request only.</summary>
    public IReadOnlyList<string> Journal { get; init; } = [];

    public SimulationReport? Report { get; init; }
}

/// <summary>
/// A translated model with its simulation state. Mirrors a GPSS World "simulation object":
/// control statements from the model run on creation, later commands are sent interactively.
/// </summary>
public sealed class SimulationSession
{
    private const int MaxStepEntries = 10_000;
    private readonly List<string> _journal = [];
    private int _lastStartCount = 1;

    private SimulationSession(string id, string modelName, GpssModel model)
    {
        Id = id;
        ModelName = modelName;
        Model = model;
        Engine = new SimulationEngine(model) { Journal = _journal.Add };
    }

    public string Id { get; }
    public string ModelName { get; }
    public GpssModel Model { get; }
    public SimulationEngine Engine { get; }
    public DateTimeOffset LastAccess { get; private set; } = DateTimeOffset.UtcNow;
    public object SyncRoot { get; } = new();

    public static GpssModel Translate(string text) => Translator.Translate(text);

    /// <summary>Translates the model and, on success, runs its control statements (INITIAL, START, ...).</summary>
    public static (SimulationSession? Session, SimulationResult Result) Create(string text, string modelName, string? id = null)
    {
        var journal = new List<string> { "Трансляция модели начата." };
        var model = Translator.Translate(text);

        if (!model.Succeeded)
        {
            journal.AddRange(model.Errors.Select(error => $"Ошибка трансляции. {error}"));
            journal.Add($"Трансляция завершена с ошибками: {model.Errors.Count}.");
            return (null, new SimulationResult { Success = false, State = "error", Errors = model.Errors, Journal = journal });
        }

        journal.Add($"Трансляция завершена. Блоков: {model.Blocks.Count}.");
        var session = new SimulationSession(id ?? Guid.NewGuid().ToString("N"), modelName, model);
        session._journal.AddRange(journal);

        if (!model.ControlStatements.Any(statement => statement.Kind is ControlKind.Start or ControlKind.Step))
        {
            session.ExecuteStatements(model.ControlStatements);
            session._journal.Add("Модель готова к запуску. Выполните команду START.");
            return (session, session.Result(runtimeError: null));
        }

        var error = session.ExecuteStatements(model.ControlStatements);
        return (session, session.Result(error));
    }

    /// <summary>Executes an interactive command such as <c>START 1</c>, <c>STEP 5</c> or <c>SHOW Q$BUF</c>.</summary>
    public SimulationResult Execute(string commandText)
    {
        LastAccess = DateTimeOffset.UtcNow;
        var errors = new List<TranslationError>();
        var statements = SourceParser.Parse(commandText, errors).ToList();

        if (errors.Count > 0 || statements.Count != 1 || !Keywords.Commands.Contains(statements[0].Operation))
        {
            _journal.Add($"Неизвестная команда: {commandText.Trim()}. Доступны START, STEP, HALT, CONTINUE, RESET, CLEAR, SHOW, INITIAL, RMULT.");
            return Result(runtimeError: "Неизвестная команда.");
        }

        ControlStatement statement;
        try
        {
            statement = Translator.TranslateControl(statements[0], Model);
        }
        catch (FormatException exception)
        {
            _journal.Add($"Ошибка в команде {statements[0].Operation}: {exception.Message}");
            return Result(runtimeError: exception.Message);
        }

        return Result(ExecuteStatements([statement]));
    }

    public SimulationResult Snapshot() => Result(runtimeError: null, includeJournal: false);

    private string? ExecuteStatements(IEnumerable<ControlStatement> statements)
    {
        foreach (var statement in statements)
        {
            try
            {
                ExecuteStatement(statement);
            }
            catch (Exception exception) when (exception is SimulationException or FormatException)
            {
                _journal.Add($"Ошибка выполнения: {exception.Message}");
                return exception.Message;
            }
        }

        return null;
    }

    private void ExecuteStatement(ControlStatement statement)
    {
        var operands = statement.Operands;
        string Operand(int index) => index < operands.Count ? operands[index] : string.Empty;
        double Evaluate(string text, double fallback) => text.Length == 0 ? fallback : ExpressionParser.Parse(text).Evaluate(Engine, null);

        switch (statement.Kind)
        {
            case ControlKind.Initial:
                ApplyInitial(Operand(0), Operand(1).Equals("UNSPECIFIED", StringComparison.OrdinalIgnoreCase) ? 0 : Evaluate(Operand(1), 1));
                break;
            case ControlKind.Start:
            {
                _lastStartCount = (int)Evaluate(Operand(0), 1);
                _journal.Add($"Моделирование начато (START {_lastStartCount}).");
                Engine.Trace = null;
                ReportRunState(Engine.Start(_lastStartCount));
                break;
            }
            case ControlKind.Step:
            {
                var steps = Math.Clamp((int)Evaluate(Operand(0), 1), 1, MaxStepEntries);
                Engine.Trace = _journal.Add;
                try
                {
                    var state = Engine.State == RunState.Paused ? Engine.Continue(steps) : Engine.Start(_lastStartCount, steps);
                    ReportRunState(state);
                }
                finally
                {
                    Engine.Trace = null;
                }

                break;
            }
            case ControlKind.Continue:
                _journal.Add("Моделирование продолжено (CONTINUE).");
                ReportRunState(Engine.Continue());
                break;
            case ControlKind.Halt:
                Engine.Halt();
                _journal.Add($"Моделирование остановлено (HALT). Время {Clock()}.");
                break;
            case ControlKind.Reset:
                Engine.ResetStatistics();
                _journal.Add($"Статистика сброшена (RESET). Время {Clock()}.");
                break;
            case ControlKind.Clear:
                Engine.Clear();
                foreach (var initial in Model.ControlStatements.Where(item => item.Kind == ControlKind.Initial))
                {
                    ExecuteStatement(initial);
                }

                _journal.Add("Модель очищена (CLEAR). Транзакты удалены, время обнулено, начальные значения INITIAL восстановлены.");
                break;
            case ControlKind.Show:
            {
                var expressionText = string.Join(",", operands);
                var value = ExpressionParser.Parse(expressionText).Evaluate(Engine, null);
                _journal.Add($"{expressionText} = {value.ToString("0.######", CultureInfo.InvariantCulture)}");
                break;
            }
            case ControlKind.Rmult:
                for (var index = 0; index < operands.Count; index++)
                {
                    if (operands[index].Length > 0)
                    {
                        Engine.SeedRandom(index + 1, (long)Evaluate(operands[index], 1));
                    }
                }

                _journal.Add("Начальные значения генераторов случайных чисел установлены (RMULT).");
                break;
        }
    }

    /// <summary>INITIAL X$Name,V | LS$Name | LR$Name | MX$Name(m,n),V | MatrixName,V (all cells).</summary>
    private void ApplyInitial(string target, double value)
    {
        Expr reference;
        try
        {
            reference = ExpressionParser.Parse(target);
        }
        catch (FormatException)
        {
            throw new SimulationException($"INITIAL: неверный операнд A \"{target}\".");
        }

        switch (reference)
        {
            case SnaExpr { Family: "X" } savevalue:
                Engine.Savevalue(savevalue.Argument).Value = value;
                break;
            case SnaExpr { Family: "LS" } set:
                Engine.Logic(set.Argument).IsSet = value != 0;
                break;
            case SnaExpr { Family: "LR" } reset:
                Engine.Logic(reset.Argument).IsSet = false;
                break;
            case MatrixCellExpr cell:
                Engine.Matrix(cell.ResolveMatrix(Engine, null))[MatrixCellExpr.Index(cell.Row, Engine, null), MatrixCellExpr.Index(cell.Column, Engine, null)] = value;
                break;
            case NameExpr name when Model.Matrices.ContainsKey(name.Name):
                Engine.Matrix(name.Name).Fill(value);
                break;
            case NameExpr name:
                Engine.Savevalue(name.Name).Value = value;
                break;
            default:
                throw new SimulationException($"INITIAL поддерживает X$, LS$, LR$, MX$ и имена матриц, получено {target}.");
        }
    }

    private void ReportRunState(RunState state)
    {
        if (state == RunState.Completed)
        {
            _journal.Add("Счётчик завершений достиг нуля.");
            _journal.Add($"Моделирование завершено. Время {Clock()}.");
            _journal.Add("Стандартный отчёт сформирован.");
        }
        else
        {
            _journal.Add($"Моделирование приостановлено. Время {Clock()}, счётчик завершений {Engine.TerminationCount}. Используйте STEP или CONTINUE.");
        }
    }

    private string Clock() => Engine.AbsoluteClock.ToString("0.000000", CultureInfo.InvariantCulture);

    private SimulationResult Result(string? runtimeError, bool includeJournal = true)
    {
        var journal = includeJournal ? _journal.ToList() : [];
        _journal.Clear();

        return new SimulationResult
        {
            SessionId = Id,
            Success = runtimeError is null,
            State = runtimeError is not null ? "error" : Engine.State switch
            {
                RunState.Completed => "completed",
                RunState.Paused => "paused",
                _ => "idle",
            },
            Clock = Engine.AbsoluteClock,
            TerminationCount = Engine.TerminationCount,
            RuntimeError = runtimeError,
            Journal = journal,
            Report = StandardReportBuilder.Build(Engine, ModelName),
        };
    }
}
