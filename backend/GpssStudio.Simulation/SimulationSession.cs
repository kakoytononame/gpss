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

    /// <summary>Transactions of the model (debugger "model state"), at most <see cref="SimulationSession.MaxListedTransactions"/>.</summary>
    public IReadOnlyList<Runtime.TransactionState> Transactions { get; init; } = [];

    /// <summary>Stop conditions: transaction number (0 = any) and block number.</summary>
    public IReadOnlyList<BreakpointInfo> Breakpoints { get; init; } = [];

    /// <summary>Source line of every block (index = block number - 1).</summary>
    public IReadOnlyList<int> BlockLines { get; init; } = [];

    /// <summary>Set when the run stopped at a stop condition.</summary>
    public string? StopReason { get; init; }
}

public sealed record BreakpointInfo(int Transaction, int Block, int Line);

/// <summary>
/// A translated model with its simulation state. Mirrors a GPSS World "simulation object":
/// control statements from the model run on creation, later commands are sent interactively.
/// </summary>
public sealed class SimulationSession
{
    private const int MaxStepEntries = 10_000;
    public const int MaxListedTransactions = 300;
    private Action<SimulationEngine>? _beforeFirstStart;
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
    /// <param name="breakpointLines">Source lines of blocks with a stop condition, set before the model's statements run.</param>
    /// <param name="beforeFirstStart">Runs once before the first START / STEP (after the model's INITIAL statements), e.g. to set experiment factors.</param>
    public static (SimulationSession? Session, SimulationResult Result) Create(
        string text,
        string modelName,
        string? id = null,
        IReadOnlyCollection<int>? breakpointLines = null,
        Action<SimulationEngine>? beforeFirstStart = null)
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
        var session = new SimulationSession(id ?? Guid.NewGuid().ToString("N"), modelName, model) { _beforeFirstStart = beforeFirstStart };
        session._journal.AddRange(journal);
        foreach (var block in model.Blocks.Where(block => breakpointLines?.Contains(block.Line) == true))
        {
            session.Engine.SetBreakpoint(0, block.Number, enabled: true);
        }

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
            _journal.Add($"Неизвестная команда: {commandText.Trim()}. Доступны START, STEP, HALT, CONTINUE, RESET, CLEAR, SHOW, INITIAL, RMULT, STOP.");
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
                RunBeforeFirstStart();
                _lastStartCount = (int)Evaluate(Operand(0), 1);
                _journal.Add($"Моделирование начато (START {_lastStartCount}).");
                Engine.Trace = null;
                ReportRunState(Engine.Start(_lastStartCount));
                break;
            }
            case ControlKind.Step:
            {
                RunBeforeFirstStart();
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
            case ControlKind.Stop:
                ApplyStop(Operand(0), Operand(1), Operand(2));
                break;
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

    private void RunBeforeFirstStart()
    {
        var hook = _beforeFirstStart;
        _beforeFirstStart = null;
        hook?.Invoke(Engine);
    }

    /// <summary>STOP: without operands removes all stop conditions; STOP [A],B[,OFF] sets or removes one.</summary>
    private void ApplyStop(string transactionText, string blockText, string mode)
    {
        if (transactionText.Length == 0 && blockText.Length == 0)
        {
            Engine.ClearBreakpoints();
            _journal.Add("Все условия останова сняты (STOP).");
            return;
        }

        var block = blockText.Length == 0 ? 0 : Model.Labels.TryGetValue(blockText, out var labelled) ? labelled
            : int.TryParse(blockText, out var number) ? number : throw new SimulationException($"STOP: метка {blockText} не определена.");
        var transaction = transactionText.Length == 0 ? 0 : int.TryParse(transactionText, out var xact) ? xact : throw new SimulationException("STOP: номер транзакта должен быть числом.");
        var enabled = !mode.Equals("OFF", StringComparison.OrdinalIgnoreCase);
        if (block == 0)
        {
            throw new SimulationException("STOP: не задан блок (операнд B).");
        }

        Engine.SetBreakpoint(transaction, block, enabled);
        var who = transaction == 0 ? "любого транзакта" : $"транзакта {transaction}";
        _journal.Add(enabled ? $"Условие останова: вход {who} в блок {block}." : $"Условие останова для {who} в блоке {block} снято.");
    }

    private void ReportRunState(RunState state)
    {
        if (state == RunState.Completed)
        {
            _journal.Add("Счётчик завершений достиг нуля.");
            _journal.Add($"Моделирование завершено. Время {Clock()}.");
            _journal.Add("Стандартный отчёт сформирован.");
        }
        else if (Engine.StopReason is { } reason)
        {
            _journal.Add($"{reason} Используйте STEP или CONTINUE.");
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
            Transactions = Engine.TransactionStates(MaxListedTransactions),
            Breakpoints = Engine.Breakpoints.OrderBy(item => item.Block)
                .Select(item => new BreakpointInfo(item.Transaction, item.Block, Model.Blocks[item.Block - 1].Line)).ToList(),
            BlockLines = Model.Blocks.Select(block => block.Line).ToList(),
            StopReason = Engine.State == RunState.Paused ? Engine.StopReason : null,
        };
    }
}
