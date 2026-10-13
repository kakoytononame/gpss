using System.Diagnostics;
using System.Globalization;
using GpssStudio.Simulation.Blocks;
using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Translation;

namespace GpssStudio.Simulation.Runtime;

public enum RunState
{
    /// <summary>No START in progress.</summary>
    Idle,

    /// <summary>A START was interrupted by STEP / HALT and can be continued.</summary>
    Paused,

    /// <summary>The termination count reached zero.</summary>
    Completed,
}

/// <summary>
/// GPSS transaction-flow interpreter: current and future events chains, facilities, queues,
/// storages, logic switches, savevalues, tables and user chains.
/// </summary>
public sealed class SimulationEngine : IEvaluationContext
{
    public const long DefaultMaxBlockEntries = 5_000_000;
    public const int MaxActiveTransactions = 50_000;
    private static readonly TimeSpan DefaultTimeLimit = TimeSpan.FromSeconds(15);

    private readonly GpssModel _model;
    private readonly LinkedList<Transaction> _currentChain = new();

    /// <summary>Transactions refused by TEST / GATE / TRANSFER; retried when the model status changes.</summary>
    private readonly List<Transaction> _retryChain = [];
    private const int RetryOnClockLimit = 1000;
    private readonly SortedSet<Transaction> _futureChain = new(Comparer<Transaction>.Create(CompareFutureEvents));
    // Entities are keyed by entity number: a name and its EQU number (or a number held in a
    // parameter) address the same entity, as in GPSS World.
    private readonly Dictionary<string, int> _entityNumbers = new(StringComparer.OrdinalIgnoreCase);
    private int _nextNamedEntityNumber = 10000;
    private readonly Dictionary<int, Facility> _facilities = [];
    private readonly Dictionary<int, QueueEntity> _queues = [];
    private readonly Dictionary<int, Storage> _storages = [];
    private readonly Dictionary<int, LogicSwitch> _logicSwitches = [];
    private readonly Dictionary<int, Savevalue> _savevalues = [];
    private readonly Dictionary<int, TableEntity> _tables = [];
    private readonly Dictionary<int, UserChain> _userChains = [];
    private readonly Dictionary<int, MatrixEntity> _matrices = [];
    private readonly Dictionary<int, NumericGroup> _numericGroups = [];
    private readonly Dictionary<int, TransactionGroup> _transactionGroups = [];
    private readonly RandomStreams _random = new();
    private readonly Dictionary<int, Transaction> _liveTransactions = [];
    private readonly Dictionary<int, DataStream> _streams = [];
    private const int MaxTraceLinesPerRun = 10_000;
    private readonly HashSet<(int Transaction, int Block)> _breakpoints = [];
    private (int Transaction, int Block)? _resumeAfterBreak;
    private bool _breakHit;
    private int _traceLines;

    /// <summary>Time series for result charts, keyed "Q:name", "S:name", "F:name".</summary>
    public SeriesRecorder Series { get; } = new();

    private long _chainSequence;
    private readonly Dictionary<string, double> _userVariables = new(StringComparer.OrdinalIgnoreCase);
    private const int MaxMonitorSamples = 4000;
    private List<(string Key, Expr Expression)> _monitors = [];
    private double _monitorInterval;
    private double _nextMonitorTime;
    private int _monitorSamples;
    private int _nextTransactionNumber = 1;
    private bool _generatorsPrimed;
    private long? _stepBudget;
    private long _entriesThisRun;
    private readonly Stopwatch _runStopwatch = new();
    private bool _statusChanged;

    public SimulationEngine(GpssModel model)
    {
        _model = model;
        foreach (var name in model.EntityNames)
        {
            RegisterEntityNumber(name);
        }

        CreateDefinedEntities();
    }

    public GpssModel Model => _model;
    public IReadOnlyList<Block> Blocks => _model.Blocks;
    public double AbsoluteClock { get; private set; }

    /// <summary>Time of the last RESET / CLEAR (start of statistics).</summary>
    public double StatisticsStartTime { get; private set; }

    public double RelativeClock => AbsoluteClock - StatisticsStartTime;
    public int TerminationCount { get; private set; }
    public RunState State { get; private set; } = RunState.Idle;
    public long MaxBlockEntries { get; set; } = DefaultMaxBlockEntries;
    public TimeSpan TimeLimit { get; set; } = DefaultTimeLimit;

    /// <summary>Receives a line for every block entry while stepping (STEP).</summary>
    public Action<string>? Trace { get; set; }

    /// <summary>Stop conditions (STOP command): transaction number (0 = any) and block number.</summary>
    public IReadOnlyCollection<(int Transaction, int Block)> Breakpoints => _breakpoints;

    /// <summary>Why the last run stopped before completion (stop condition), or null.</summary>
    public string? StopReason { get; private set; }

    /// <summary>Receives block entries of transactions switched on by TRACE.</summary>
    public Action<string>? Journal { get; set; }

    /// <summary>In-memory text files used by the data stream blocks (OPEN / READ / WRITE / SEEK / CLOSE).</summary>
    public Dictionary<string, List<string>> Files { get; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Transactions that exist in the model, by number.</summary>
    public IReadOnlyDictionary<int, Transaction> LiveTransactions => _liveTransactions;

    public IReadOnlyCollection<Facility> Facilities => _facilities.Values;
    public IReadOnlyCollection<QueueEntity> Queues => _queues.Values;
    public IReadOnlyCollection<Storage> Storages => _storages.Values;
    public IReadOnlyCollection<LogicSwitch> LogicSwitches => _logicSwitches.Values;
    public IReadOnlyCollection<Savevalue> Savevalues => _savevalues.Values;
    public IReadOnlyCollection<TableEntity> Tables => _tables.Values;
    public IReadOnlyCollection<UserChain> UserChains => _userChains.Values;
    public IReadOnlyCollection<MatrixEntity> Matrices => _matrices.Values;
    public IReadOnlyCollection<NumericGroup> NumericGroups => _numericGroups.Values;
    public IReadOnlyCollection<TransactionGroup> TransactionGroups => _transactionGroups.Values;
    public IEnumerable<Transaction> FutureEvents => _futureChain;
    public IEnumerable<Transaction> CurrentEvents => _currentChain;
    public IReadOnlyList<Transaction> RetryChain => _retryChain;
    public IReadOnlyDictionary<string, int> EntityNumbers => _entityNumbers;

    private static int CompareFutureEvents(Transaction? a, Transaction? b)
    {
        var byTime = a!.MoveTime.CompareTo(b!.MoveTime);
        return byTime != 0 ? byTime : a.ChainSequence.CompareTo(b.ChainSequence);
    }

    private void CreateDefinedEntities()
    {
        foreach (var definition in _model.Storages.Values)
        {
            var number = EntityNumber(definition.Name);
            _storages[number] = new Storage(definition.Name, number, definition.Capacity);
        }

        foreach (var definition in _model.Tables.Values)
        {
            var number = EntityNumber(definition.Name);
            _tables[number] = new TableEntity(definition.Name, number, definition.Argument, definition.FirstUpperLimit, definition.Width, definition.Classes);
        }

        foreach (var definition in _model.Matrices.Values)
        {
            var number = EntityNumber(definition.Name);
            _matrices[number] = new MatrixEntity(definition.Name, number, definition.Rows, definition.Columns);
        }
    }

    // ----------------------------------------------------------------- commands

    /// <summary>START A: runs until the termination count, set to A, reaches zero.</summary>
    public RunState Start(int terminationCount, long? stepBudget = null)
    {
        if (terminationCount < 0)
        {
            throw new SimulationException("START: счётчик завершений не может быть отрицательным.");
        }

        TerminationCount = terminationCount;
        PrimeGenerators();
        return Run(stepBudget);
    }

    /// <summary>Continues a START interrupted by STEP or HALT.</summary>
    public RunState Continue(long? stepBudget = null)
    {
        if (State != RunState.Paused)
        {
            throw new SimulationException("Нет прерванного моделирования: выполните START.");
        }

        return Run(stepBudget);
    }

    public void Halt()
    {
        if (State == RunState.Paused || State == RunState.Idle)
        {
            return;
        }

        State = RunState.Idle;
    }

    /// <summary>RESET: clears statistics but keeps transactions and the absolute clock.</summary>
    public void ResetStatistics()
    {
        StatisticsStartTime = AbsoluteClock;
        foreach (var block in _model.Blocks)
        {
            block.EntryCount = 0;
        }

        foreach (var facility in _facilities.Values)
        {
            facility.Entries = 0;
            facility.Busy.Reset(AbsoluteClock);
        }

        foreach (var queue in _queues.Values)
        {
            queue.Entries = queue.Content;
            queue.ZeroEntries = 0;
            queue.MaxContent = queue.Content;
            queue.TotalTime = 0;
            queue.ContentIntegral.Reset(AbsoluteClock);
        }

        foreach (var storage in _storages.Values)
        {
            storage.Entries = storage.Used;
            storage.MinUsed = storage.Used;
            storage.MaxUsed = storage.Used;
            storage.UsedIntegral.Reset(AbsoluteClock);
        }

        foreach (var table in _tables.Values)
        {
            table.Reset();
        }

        foreach (var chain in _userChains.Values)
        {
            chain.Entries = chain.Members.Count;
            chain.MaxContent = chain.Members.Count;
            chain.TotalTime = 0;
            chain.ContentIntegral.Reset(AbsoluteClock);
        }
    }

    /// <summary>CLEAR: removes all transactions and returns the model to its translated state.</summary>
    public void Clear()
    {
        _currentChain.Clear();
        _retryChain.Clear();
        _futureChain.Clear();
        _facilities.Clear();
        _queues.Clear();
        _storages.Clear();
        _logicSwitches.Clear();
        _savevalues.Clear();
        _tables.Clear();
        _userChains.Clear();
        _matrices.Clear();
        _numericGroups.Clear();
        _transactionGroups.Clear();
        _random.Reset();
        _liveTransactions.Clear();
        _streams.Clear();
        _resumeAfterBreak = null;
        Series.Clear();
        _nextMonitorTime = 0;
        _monitorSamples = 0;
        CreateDefinedEntities();

        foreach (var block in _model.Blocks)
        {
            block.EntryCount = 0;
            block.CurrentCount = 0;
            block.Clear();
        }

        AbsoluteClock = 0;
        StatisticsStartTime = 0;
        TerminationCount = 0;
        _nextTransactionNumber = 1;
        _generatorsPrimed = false;
        State = RunState.Idle;
    }

    public void SeedRandom(int stream, long seed) => _random.Seed(stream, seed);

    /// <summary>
    /// Indicators sampled every <paramref name="interval"/> units of model time into <see cref="Series"/>
    /// under the keys "M:label" (GPSS Studio "динамика показателей"). The interval doubles when a run
    /// produces more than <see cref="MaxMonitorSamples"/> samples.
    /// </summary>
    public void SetMonitors(IEnumerable<(string Label, Expr Expression)> monitors, double interval)
    {
        if (!(interval > 0) || !double.IsFinite(interval))
        {
            throw new ArgumentException("Интервал сбора динамики должен быть положительным числом.");
        }

        _monitors = monitors.Select(monitor => ($"M:{monitor.Label}", monitor.Expression)).ToList();
        _monitorInterval = interval;
        _nextMonitorTime = AbsoluteClock;
        _monitorSamples = 0;
    }

    /// <summary>Samples the monitors at grid points before <paramref name="time"/> (the state is constant between events).</summary>
    private void SampleMonitors(double time, bool inclusive)
    {
        if (_monitors.Count == 0)
        {
            return;
        }

        var clock = AbsoluteClock;
        while (_nextMonitorTime < time || (inclusive && _nextMonitorTime <= time))
        {
            // Time-weighted SNA (SR, QA, AC1, ...) are evaluated at the grid point itself.
            AbsoluteClock = Math.Max(clock, _nextMonitorTime);
            foreach (var (key, expression) in _monitors)
            {
                double value;
                try
                {
                    value = expression.Evaluate(this, null);
                }
                catch (SimulationException)
                {
                    value = double.NaN;
                }

                if (double.IsFinite(value))
                {
                    Series.Record(key, _nextMonitorTime, value);
                }
            }

            _nextMonitorTime += _monitorInterval;
            if (++_monitorSamples >= MaxMonitorSamples)
            {
                _monitorInterval *= 2;
                _monitorSamples /= 2;
            }
        }

        AbsoluteClock = clock;
    }

    private void PrimeGenerators()
    {
        if (_generatorsPrimed)
        {
            return;
        }

        _generatorsPrimed = true;
        foreach (var generator in _model.Blocks.OfType<GenerateBlock>())
        {
            generator.Prime(this);
        }
    }

    // ----------------------------------------------------------------- scheduler

    private RunState Run(long? stepBudget)
    {
        _stepBudget = stepBudget;
        _entriesThisRun = 0;
        _traceLines = 0;
        _breakHit = false;
        StopReason = null;
        _runStopwatch.Restart();
        State = RunState.Paused;

        while (true)
        {
            if (TerminationCount <= 0)
            {
                SampleMonitors(AbsoluteClock, inclusive: true);
                return State = RunState.Completed;
            }

            if (!ScanCurrentChain())
            {
                SampleMonitors(AbsoluteClock, inclusive: TerminationCount <= 0);
                return State = TerminationCount <= 0 ? RunState.Completed : RunState.Paused;
            }

            if (_futureChain.Count == 0)
            {
                State = RunState.Paused;
                throw new SimulationException($"Цепь будущих событий пуста, а счётчик завершений не достиг нуля ({TerminationCount}). Модель заблокирована при времени {AbsoluteClock:F3}.");
            }

            var nextTime = _futureChain.Min!.MoveTime;
            SampleMonitors(nextTime, inclusive: false);
            AbsoluteClock = nextTime;
            while (_futureChain.Count > 0 && _futureChain.Min!.MoveTime == nextTime)
            {
                var transaction = _futureChain.Min!;
                _futureChain.Remove(transaction);
                transaction.OnFutureChain = false;
                AddToCurrentChain(transaction);
            }
        }
    }

    /// <summary>Guards the server against models that loop forever (also within a single time instant).</summary>
    private void CheckComputationLimits()
    {
        _entriesThisRun++;
        if (_entriesThisRun > MaxBlockEntries || (_entriesThisRun % 4096 == 0 && _runStopwatch.Elapsed > TimeLimit))
        {
            State = RunState.Paused;
            throw new SimulationException($"Превышен предел вычислений ({MaxBlockEntries:N0} входов в блоки или {TimeLimit.TotalSeconds:N0} с). Проверьте модель на бесконечные циклы. Абсолютное время {AbsoluteClock:F3}.");
        }
    }

    /// <summary>
    /// Moves transactions on the current events chain as far as possible. The scan restarts from the
    /// highest-priority transaction whenever something moved, because the state of the model changed.
    /// Returns false when the run must stop (termination count reached or step budget used up).
    /// </summary>
    private bool ScanCurrentChain()
    {
        // Clock-dependent conditions (C1, AC1, M1) are re-checked on every clock tick while the retry chain is small.
        if (_retryChain.Count <= RetryOnClockLimit)
        {
            WakeRetryChain();
        }

        var node = _currentChain.First;
        while (node is not null)
        {
            var transaction = node.Value;
            var next = node.Next;
            _statusChanged = false;

            MoveTransaction(transaction, out var yielded);

            if (TerminationCount <= 0 || _stepBudget <= 0 || _breakHit)
            {
                return false;
            }

            if (yielded)
            {
                // BUFFER: move behind transactions of the same priority and rescan.
                RemoveFromCurrentChain(transaction);
                AddToCurrentChain(transaction);
                node = _currentChain.First;
                continue;
            }

            // GPSS rule: restart the scan only when the model status changed.
            if (_statusChanged)
            {
                WakeRetryChain();
                node = _currentChain.First;
            }
            else
            {
                node = next;
            }
        }

        return true;
    }

    private bool MoveTransaction(Transaction transaction, out bool yielded)
    {
        var moved = false;
        yielded = false;

        while (true)
        {
            if (_stepBudget <= 0)
            {
                return moved;
            }

            var block = BlockAt(transaction.NextBlock, transaction);
            if (ShouldBreak(transaction, block))
            {
                return moved;
            }

            if (!block.CanEnter(this, transaction))
            {
                block.OnRefused(this, transaction);
                if (transaction.CurrentChainNode is not null)
                {
                    RemoveFromCurrentChain(transaction);
                    _retryChain.Add(transaction);
                }

                return moved;
            }

            EnterBlock(transaction, block);
            moved = true;

            if (_stepBudget is not null)
            {
                _stepBudget--;
                Trace?.Invoke(DescribeEntry(transaction, block));
            }
            else if (transaction.Traced && Journal is not null && _traceLines++ < MaxTraceLinesPerRun)
            {
                Journal(DescribeEntry(transaction, block));
            }

            transaction.NextBlock = block.Number + 1;
            BlockOutcome outcome;
            try
            {
                outcome = block.Execute(this, transaction);
            }
            catch (SimulationException exception)
            {
                throw new SimulationException($"Блок {block.Number} {block.Operation} (строка {block.Line}), транзакт {transaction.Number}: {exception.Message}");
            }

            switch (outcome)
            {
                case BlockOutcome.Continue:
                    continue;
                case BlockOutcome.Terminated:
                    block.CurrentCount--;
                    transaction.CurrentBlock = 0;
                    return true;
                case BlockOutcome.Yield:
                    yielded = true;
                    return true;
                default:
                    return true;
            }
        }
    }

    /// <summary>
    /// Stop condition: the run halts before the transaction enters the block. When the run continues,
    /// the same transaction passes this block once.
    /// </summary>
    private bool ShouldBreak(Transaction transaction, Block block)
    {
        if (_breakpoints.Count == 0 || !(_breakpoints.Contains((0, block.Number)) || _breakpoints.Contains((transaction.Number, block.Number))))
        {
            return false;
        }

        if (_resumeAfterBreak == (transaction.Number, block.Number))
        {
            _resumeAfterBreak = null;
            return false;
        }

        _resumeAfterBreak = (transaction.Number, block.Number);
        _breakHit = true;
        StopReason = $"Останов: транзакт {transaction.Number} перед входом в блок {block.Number} {block.Operation}{(block.Label is null ? string.Empty : $" ({block.Label})")}. Время {AbsoluteClock:F3}.";
        return true;
    }

    public void SetBreakpoint(int transaction, int block, bool enabled)
    {
        if (block < 1 || block > _model.Blocks.Count)
        {
            throw new SimulationException($"STOP: блок {block} не существует.");
        }

        if (enabled)
        {
            _breakpoints.Add((transaction, block));
        }
        else
        {
            _breakpoints.Remove((transaction, block));
        }
    }

    public void ClearBreakpoints() => _breakpoints.Clear();

    /// <summary>Where every transaction of the model is: chain, current and next block, timing and parameters.</summary>
    public IReadOnlyList<TransactionState> TransactionStates(int limit)
    {
        var places = new Dictionary<Transaction, string>();
        foreach (var transaction in _currentChain)
        {
            places[transaction] = "Текущих событий";
        }

        foreach (var transaction in _retryChain)
        {
            places[transaction] = "Ожидает условия (TEST, GATE)";
        }

        foreach (var transaction in _futureChain)
        {
            places[transaction] = "Будущих событий";
        }

        foreach (var facility in _facilities.Values)
        {
            foreach (var transaction in facility.DelayChain)
            {
                places[transaction] = $"Ожидает устройство {facility.Name}";
            }

            foreach (var transaction in facility.InterruptChain)
            {
                places[transaction] = $"Прерван на устройстве {facility.Name}";
            }
        }

        foreach (var storage in _storages.Values)
        {
            foreach (var (transaction, _) in storage.DelayChain)
            {
                places[transaction] = $"Ожидает память {storage.Name}";
            }
        }

        foreach (var chain in _userChains.Values)
        {
            foreach (var transaction in chain.Members)
            {
                places[transaction] = $"Список пользователя {chain.Name}";
            }
        }

        return _liveTransactions.Values
            .OrderBy(transaction => transaction.Number)
            .Take(limit)
            .Select(transaction => new TransactionState(
                transaction.Number,
                transaction.Priority,
                transaction.AssemblySet,
                transaction.CurrentBlock,
                transaction.NextBlock,
                places.GetValueOrDefault(transaction, transaction.CurrentBlock > 0 ? $"Задержан в блоке {transaction.CurrentBlock}" : "Не вошёл в модель"),
                transaction.OnFutureChain ? transaction.MoveTime : null,
                AbsoluteClock - transaction.MarkTime,
                transaction.Parameters.ToDictionary(pair => pair.Key, pair => pair.Value)))
            .ToList();
    }

    private string DescribeEntry(Transaction transaction, Block block) =>
        $"Транзакт {transaction.Number} вошёл в блок {block.Number} {block.Operation}{(block.OperandText.Length > 0 ? " " + block.OperandText : string.Empty)}. Время {AbsoluteClock:F3}.";

    private Block BlockAt(int number, Transaction transaction)
    {
        if (number < 1 || number > _model.Blocks.Count)
        {
            throw new SimulationException($"Транзакт {transaction.Number} пытается войти в несуществующий блок {number} (в модели {_model.Blocks.Count} блоков).");
        }

        return _model.Blocks[number - 1];
    }

    private void EnterBlock(Transaction transaction, Block block)
    {
        if (transaction.CurrentBlock > 0)
        {
            _model.Blocks[transaction.CurrentBlock - 1].CurrentCount--;
        }

        CheckComputationLimits();
        block.EntryCount++;
        block.CurrentCount++;
        transaction.CurrentBlock = block.Number;
    }

    private void WakeRetryChain()
    {
        if (_retryChain.Count == 0)
        {
            return;
        }

        var waiting = _retryChain.ToList();
        _retryChain.Clear();
        var changed = _statusChanged;
        foreach (var transaction in waiting)
        {
            AddToCurrentChain(transaction);
        }

        _statusChanged = changed;
    }

    public bool CanEnterBlock(int number, Transaction transaction) =>
        number >= 1 && number <= _model.Blocks.Count && _model.Blocks[number - 1].CanEnter(this, transaction);

    public void NotifyStatusChange() => _statusChanged = true;

    // ----------------------------------------------------------------- chains

    public Transaction CreateTransaction(int priority)
    {
        if (_currentChain.Count + _retryChain.Count + _futureChain.Count > MaxActiveTransactions)
        {
            throw new SimulationException($"В модели более {MaxActiveTransactions:N0} активных транзактов. Вероятно, транзакты накапливаются из-за блокировки.");
        }

        var transaction = new Transaction { Number = _nextTransactionNumber++, Priority = priority, MarkTime = AbsoluteClock };
        transaction.AssemblySet = transaction.Number;
        _liveTransactions[transaction.Number] = transaction;
        return transaction;
    }

    public void ScheduleFuture(Transaction transaction, double time)
    {
        RemoveFromCurrentChain(transaction);
        transaction.MoveTime = time;
        transaction.ChainSequence = ++_chainSequence;
        transaction.OnFutureChain = true;
        _futureChain.Add(transaction);
    }

    /// <summary>Adds the transaction behind all transactions of the same or higher priority.</summary>
    public void AddToCurrentChain(Transaction transaction)
    {
        if (transaction.CurrentChainNode is not null)
        {
            return;
        }

        var node = _currentChain.Last;
        while (node is not null && node.Value.Priority < transaction.Priority)
        {
            node = node.Previous;
        }

        transaction.CurrentChainNode = node is null ? _currentChain.AddFirst(transaction) : _currentChain.AddAfter(node, transaction);
        _statusChanged = true;
    }

    public void RemoveFromCurrentChain(Transaction transaction)
    {
        if (transaction.CurrentChainNode is not null)
        {
            _currentChain.Remove(transaction.CurrentChainNode);
            transaction.CurrentChainNode = null;
        }
    }

    public void RepositionInCurrentChain(Transaction transaction)
    {
        if (transaction.CurrentChainNode is not null)
        {
            RemoveFromCurrentChain(transaction);
            AddToCurrentChain(transaction);
        }
    }

    public void DestroyTransaction(Transaction transaction)
    {
        _liveTransactions.Remove(transaction.Number);
        RemoveFromCurrentChain(transaction);
        _retryChain.Remove(transaction);
        if (transaction.OnFutureChain)
        {
            _futureChain.Remove(transaction);
            transaction.OnFutureChain = false;
        }

        foreach (var facility in _facilities.Values.Where(facility => facility.Owner == transaction))
        {
            throw new SimulationException($"Транзакт {transaction.Number} уничтожен, не освободив устройство {facility.Name}.");
        }

        foreach (var group in transaction.Groups)
        {
            group.Members.Remove(transaction);
        }

        transaction.Groups.Clear();
    }

    public void DecrementTerminationCount(int count) => TerminationCount -= count;

    public Transaction? FindTransaction(int number) => _liveTransactions.GetValueOrDefault(number);

    /// <summary>
    /// DISPLACE: takes the transaction off the future events, retry, delay and user chains and sends it to
    /// <paramref name="destination"/>. Returns the residual ADVANCE time if it was on the future events chain.
    /// </summary>
    public double? Displace(Transaction transaction, int destination)
    {
        double? residual = null;
        if (transaction.OnFutureChain)
        {
            residual = transaction.MoveTime - AbsoluteClock;
            _futureChain.Remove(transaction);
            transaction.OnFutureChain = false;
        }

        _retryChain.Remove(transaction);
        foreach (var facility in _facilities.Values)
        {
            facility.DelayChain.Remove(transaction);
        }

        foreach (var storage in _storages.Values)
        {
            var node = storage.DelayChain.First;
            while (node is not null)
            {
                var next = node.Next;
                if (node.Value.Transaction == transaction)
                {
                    storage.DelayChain.Remove(node);
                }

                node = next;
            }
        }

        foreach (var chain in _userChains.Values)
        {
            chain.Members.Remove(transaction);
        }

        transaction.NextBlock = destination;
        AddToCurrentChain(transaction);
        return residual;
    }

    // ----------------------------------------------------------------- data streams

    public void OpenStream(int number, string fileName)
    {
        if (!Files.TryGetValue(fileName, out var lines))
        {
            lines = [];
            Files[fileName] = lines;
        }

        _streams[number] = new DataStream(fileName, lines);
    }

    public DataStream? DataStream(int number) => _streams.GetValueOrDefault(number);

    public DataStream? CloseStream(int number)
    {
        if (_streams.Remove(number, out var stream))
        {
            return stream;
        }

        return null;
    }

    /// <summary>Text value of an operand: string constants as is, numbers in invariant format.</summary>
    public string EvalText(Expr expression, Transaction? transaction) =>
        expression is StringExpr text ? text.Value : Eval(expression, transaction).ToString("0.##########", CultureInfo.InvariantCulture);

    // ----------------------------------------------------------------- facilities

    public Facility Facility(string name)
    {
        var number = EntityNumber(name);
        if (!_facilities.TryGetValue(number, out var facility))
        {
            facility = new Facility(name, number);
            facility.Busy.Reset(StatisticsStartTime);
            _facilities[number] = facility;
        }

        return facility;
    }

    public void WaitOnFacility(Transaction transaction, Facility facility)
    {
        RemoveFromCurrentChain(transaction);
        var node = facility.DelayChain.Last;
        while (node is not null && node.Value.Priority < transaction.Priority)
        {
            node = node.Previous;
        }

        if (node is null)
        {
            facility.DelayChain.AddFirst(transaction);
        }
        else
        {
            facility.DelayChain.AddAfter(node, transaction);
        }
    }

    public void SeizeFacility(Facility facility, Transaction transaction)
    {
        facility.Busy.Accumulate(AbsoluteClock, facility.IsBusy ? 1 : 0);
        _statusChanged = true;
        facility.Owner = transaction;
        facility.Entries++;
        Series.Record($"F:{facility.Name}", AbsoluteClock, 1);
    }

    public void ReleaseFacility(Facility facility, Transaction transaction)
    {
        if (facility.Owner != transaction)
        {
            throw new SimulationException($"устройство {facility.Name} не занято этим транзактом.");
        }

        facility.Busy.Accumulate(AbsoluteClock, 1);
        facility.Owner = null;
        _statusChanged = true;
        Series.Record($"F:{facility.Name}", AbsoluteClock, 0);
        ResumeInterruptedOrWake(facility);
    }

    public void PreemptFacility(Facility facility, Transaction transaction)
    {
        var victim = facility.Owner;
        facility.Busy.Accumulate(AbsoluteClock, victim is null ? 0 : 1);

        if (victim is not null)
        {
            if (victim.OnFutureChain)
            {
                victim.PreemptedRemainingTime = victim.MoveTime - AbsoluteClock;
                _futureChain.Remove(victim);
                victim.OnFutureChain = false;
            }
            else
            {
                RemoveFromCurrentChain(victim);
            }

            facility.InterruptChain.Push(victim);
        }

        facility.Owner = transaction;
        facility.Entries++;
    }

    public void ReturnFacility(Facility facility, Transaction transaction) => ReleaseFacility(facility, transaction);

    private void ResumeInterruptedOrWake(Facility facility)
    {
        if (facility.InterruptChain.Count > 0)
        {
            var resumed = facility.InterruptChain.Pop();
            facility.Owner = resumed;
            if (resumed.PreemptedRemainingTime is { } remaining)
            {
                resumed.PreemptedRemainingTime = null;
                ScheduleFuture(resumed, AbsoluteClock + remaining);
            }
            else
            {
                AddToCurrentChain(resumed);
            }

            return;
        }

        WakeFacilityWaiters(facility);
    }

    private void WakeFacilityWaiters(Facility facility)
    {
        if (facility.DelayChain.First is { } first && facility.Available)
        {
            facility.DelayChain.RemoveFirst();
            AddToCurrentChain(first.Value);
        }
    }

    public void SetFacilityAvailability(Facility facility, bool available)
    {
        _statusChanged = true;
        facility.Available = available;
        if (available && !facility.IsBusy)
        {
            WakeFacilityWaiters(facility);
        }
    }

    // ----------------------------------------------------------------- queues

    public QueueEntity Queue(string name)
    {
        var number = EntityNumber(name);
        if (!_queues.TryGetValue(number, out var queue))
        {
            queue = new QueueEntity(name, number);
            queue.ContentIntegral.Reset(StatisticsStartTime);
            _queues[number] = queue;
        }

        return queue;
    }

    public void JoinQueue(QueueEntity queue, Transaction transaction, int units)
    {
        queue.ContentIntegral.Accumulate(AbsoluteClock, queue.Content);
        queue.Content += units;
        _statusChanged = true;
        queue.Entries += units;
        queue.MaxContent = Math.Max(queue.MaxContent, queue.Content);
        Series.Record($"Q:{queue.Name}", AbsoluteClock, queue.Content);
        transaction.QueueEntryTimes[queue.Number] = AbsoluteClock;
        transaction.QueueUnits[queue.Number] = transaction.QueueUnits.GetValueOrDefault(queue.Number) + units;
    }

    public void DepartQueue(QueueEntity queue, Transaction transaction, int units)
    {
        if (queue.Content < units)
        {
            throw new SimulationException($"очередь {queue.Name} содержит {queue.Content} единиц, запрошен выход {units}.");
        }

        queue.ContentIntegral.Accumulate(AbsoluteClock, queue.Content);
        queue.Content -= units;
        _statusChanged = true;
        Series.Record($"Q:{queue.Name}", AbsoluteClock, queue.Content);

        if (transaction.QueueEntryTimes.TryGetValue(queue.Number, out var entryTime))
        {
            var residence = AbsoluteClock - entryTime;
            queue.TotalTime += residence * units;
            if (residence == 0)
            {
                queue.ZeroEntries += units;
            }

            var remaining = transaction.QueueUnits.GetValueOrDefault(queue.Number) - units;
            if (remaining <= 0)
            {
                transaction.QueueEntryTimes.Remove(queue.Number);
                transaction.QueueUnits.Remove(queue.Number);
            }
            else
            {
                transaction.QueueUnits[queue.Number] = remaining;
            }
        }
    }

    // ----------------------------------------------------------------- storages

    public Storage Storage(string name) =>
        _storages.TryGetValue(EntityNumber(name), out var storage)
            ? storage
            : throw new SimulationException($"многоканальное устройство {name} не описано оператором STORAGE.");

    public void WaitOnStorage(Transaction transaction, Storage storage, int units)
    {
        RemoveFromCurrentChain(transaction);
        storage.DelayChain.AddLast((transaction, units));
    }

    public void EnterStorage(Storage storage, int units)
    {
        storage.UsedIntegral.Accumulate(AbsoluteClock, storage.Used);
        storage.Used += units;
        _statusChanged = true;
        storage.Entries += units;
        storage.MaxUsed = Math.Max(storage.MaxUsed, storage.Used);
        Series.Record($"S:{storage.Name}", AbsoluteClock, storage.Used);
    }

    public void LeaveStorage(Storage storage, int units)
    {
        if (storage.Used < units)
        {
            throw new SimulationException($"из памяти {storage.Name} освобождается {units} единиц, занято {storage.Used}.");
        }

        storage.UsedIntegral.Accumulate(AbsoluteClock, storage.Used);
        storage.Used -= units;
        _statusChanged = true;
        storage.MinUsed = Math.Min(storage.MinUsed, storage.Used);
        Series.Record($"S:{storage.Name}", AbsoluteClock, storage.Used);
        WakeStorageWaiters(storage);
    }

    private void WakeStorageWaiters(Storage storage)
    {
        if (!storage.Available)
        {
            return;
        }

        var available = storage.Remaining;
        var node = storage.DelayChain.First;
        while (node is not null && available > 0)
        {
            var next = node.Next;
            if (node.Value.Units <= available)
            {
                available -= node.Value.Units;
                storage.DelayChain.Remove(node);
                AddToCurrentChain(node.Value.Transaction);
            }

            node = next;
        }
    }

    public void SetStorageAvailability(Storage storage, bool available)
    {
        _statusChanged = true;
        storage.Available = available;
        if (available)
        {
            WakeStorageWaiters(storage);
        }
    }

    // ----------------------------------------------------------------- other entities

    private static T GetOrCreate<T>(Dictionary<int, T> entities, int number, Func<T> create)
    {
        if (!entities.TryGetValue(number, out var entity))
        {
            entity = create();
            entities[number] = entity;
        }

        return entity;
    }

    public LogicSwitch Logic(string name)
    {
        var number = EntityNumber(name);
        return GetOrCreate(_logicSwitches, number, () => new LogicSwitch(name, number));
    }

    public Savevalue Savevalue(string name)
    {
        var number = EntityNumber(name);
        return GetOrCreate(_savevalues, number, () => new Savevalue(name, number));
    }

    public TableEntity Table(string name) =>
        _tables.TryGetValue(EntityNumber(name), out var table) ? table : throw new SimulationException($"таблица {name} не описана оператором TABLE.");

    public MatrixEntity Matrix(string name) =>
        _matrices.TryGetValue(EntityNumber(name), out var matrix) ? matrix : throw new SimulationException($"матрица {name} не описана оператором MATRIX.");

    public double MatrixValue(string matrix, int row, int column) => Matrix(matrix)[row, column];

    public NumericGroup NumericGroup(string name)
    {
        var number = EntityNumber(name);
        return GetOrCreate(_numericGroups, number, () => new NumericGroup(name, number));
    }

    public TransactionGroup TransactionGroup(string name)
    {
        var number = EntityNumber(name);
        return GetOrCreate(_transactionGroups, number, () => new TransactionGroup(name, number));
    }

    public UserChain UserChain(string name)
    {
        var number = EntityNumber(name);
        return GetOrCreate(_userChains, number, () =>
        {
            var chain = new UserChain(name, number);
            chain.ContentIntegral.Reset(StatisticsStartTime);
            return chain;
        });
    }

    public void LinkToUserChain(UserChain chain, Transaction transaction, string order)
    {
        RemoveFromCurrentChain(transaction);
        chain.ContentIntegral.Accumulate(AbsoluteClock, chain.Members.Count);
        chain.Entries++;
        transaction.UserChainEntryTime = AbsoluteClock;

        if (order == "LIFO")
        {
            chain.Members.AddFirst(transaction);
        }
        else if (order == "FIFO")
        {
            chain.Members.AddLast(transaction);
        }
        else
        {
            var key = transaction.GetParameter(order.StartsWith("P$", StringComparison.OrdinalIgnoreCase) ? order[2..] : order.TrimStart('P', 'p'));
            var node = chain.Members.First;
            while (node is not null && node.Value.GetParameter(order) <= key)
            {
                node = node.Next;
            }

            if (node is null)
            {
                chain.Members.AddLast(transaction);
            }
            else
            {
                chain.Members.AddBefore(node, transaction);
            }
        }

        chain.MaxContent = Math.Max(chain.MaxContent, chain.Members.Count);
    }

    public int UnlinkFromUserChain(UserChain chain, int limit, int destination)
    {
        var moved = 0;
        while (moved < limit && chain.Members.First is { } first)
        {
            chain.ContentIntegral.Accumulate(AbsoluteClock, chain.Members.Count);
            chain.TotalTime += AbsoluteClock - first.Value.UserChainEntryTime;
            chain.Members.RemoveFirst();
            first.Value.NextBlock = destination;
            AddToCurrentChain(first.Value);
            moved++;
        }

        if (chain.Members.Count == 0)
        {
            chain.LinkIndicator = false;
        }

        return moved;
    }

    // ----------------------------------------------------------------- names

    /// <summary>Numbers come from the name itself ("3"), from an EQU constant, or are assigned from 10000 on.</summary>
    private int RegisterEntityNumber(string name)
    {
        if (!_entityNumbers.TryGetValue(name, out var number))
        {
            if (int.TryParse(name, NumberStyles.Integer, CultureInfo.InvariantCulture, out var numeric))
            {
                number = numeric;
            }
            else if (_model.Constants.TryGetValue(name, out var constant) && constant >= 1 && constant == Math.Floor(constant))
            {
                number = (int)constant;
            }
            else
            {
                number = _nextNamedEntityNumber++;
            }

            _entityNumbers[name] = number;
        }

        return number;
    }

    public int EntityNumber(string name) => RegisterEntityNumber(name);

    public string EntityNameByNumber(int number)
    {
        foreach (var (name, value) in _entityNumbers)
        {
            if (value == number)
            {
                return name;
            }
        }

        return number.ToString(CultureInfo.InvariantCulture);
    }

    // ----------------------------------------------------------------- evaluation

    public double Eval(Expr expression, Transaction? transaction) => expression.Evaluate(this, transaction);

    /// <summary>A±B, or A×FN when B is a function (GENERATE / ADVANCE timing rule).</summary>
    public double Interval(Expr mean, Expr? spread, Transaction? transaction)
    {
        var a = Eval(mean, transaction);
        if (spread is null)
        {
            return a;
        }

        if (spread is SnaExpr { Family: "FN" })
        {
            return a * Eval(spread, transaction);
        }

        var b = Eval(spread, transaction);
        return b == 0 ? a : a - b + 2 * b * Random(1);
    }

    public double Random(int stream) => _random.Next(stream);

    /// <summary>Global user variable assigned by a PLUS procedure (it takes precedence over EQU values).</summary>
    public void SetUserVariable(string name, double value) => _userVariables[name] = value;

    public double CallProcedure(string name, IReadOnlyList<double> arguments, Transaction? transaction) => CallProcedure(name, arguments, transaction, 0);

    public double CallProcedure(string name, IReadOnlyList<double> arguments, Transaction? transaction, int depth) =>
        _model.Procedures.TryGetValue(name, out var procedure) && !procedure.IsExperiment
            ? procedure.Invoke(this, transaction, arguments, depth)
            : throw new SimulationException($"Неизвестная процедура {name}.");

    public double NameValue(string name)
    {
        if (_userVariables.TryGetValue(name, out var variable))
        {
            return variable;
        }

        if (_model.Constants.TryGetValue(name, out var constant))
        {
            return constant;
        }

        return _model.Labels.TryGetValue(name, out var block) ? block : EntityNumber(name);
    }

    /// <summary>Block number for a label or number; throws if the block does not exist.</summary>
    public int BlockNumber(string reference)
    {
        var number = _model.Labels.TryGetValue(reference, out var labelled) ? labelled : int.TryParse(reference, out var numeric) ? numeric : 0;
        if (number < 1 || number > _model.Blocks.Count)
        {
            throw new SimulationException($"блок {reference} не существует.");
        }

        return number;
    }

    public double Sna(string family, string argument, Transaction? transaction)
    {
        Transaction RequireTransaction() => transaction ?? throw new SimulationException($"СЧА {family} требует активного транзакта.");

        switch (family)
        {
            case "P":
                return RequireTransaction().GetParameter(argument);
            case "MP":
                return AbsoluteClock - RequireTransaction().GetParameter(argument);
            case "RN":
                return Math.Floor(Random(int.TryParse(argument, out var stream) ? stream : 1) * 1000);
            case "AC1":
                return AbsoluteClock;
            case "C1":
                return RelativeClock;
            case "M1":
                return AbsoluteClock - RequireTransaction().MarkTime;
            case "XN1":
                return RequireTransaction().Number;
            case "PR":
                return RequireTransaction().Priority;
            case "A1":
                return RequireTransaction().AssemblySet;
            case "TG1":
                return TerminationCount;
            case "X":
                return _savevalues.TryGetValue(EntityNumber(argument), out var savevalue) ? savevalue.Value : 0;
            case "GN":
                return _numericGroups.TryGetValue(EntityNumber(argument), out var numericGroup) ? numericGroup.Members.Count : 0;
            case "GT":
                return _transactionGroups.TryGetValue(EntityNumber(argument), out var transactionGroup) ? transactionGroup.Members.Count : 0;
            case "MB":
            {
                var number = BlockNumber(argument);
                return _model.Blocks[number - 1] is MatchBlock match && match.HasWaitingFamilyMember(RequireTransaction()) ? 1 : 0;
            }
            case "FN":
                return _model.Functions.TryGetValue(argument, out var function)
                    ? function.Evaluate(this, transaction)
                    : throw new SimulationException($"функция {argument} не определена.");
            case "V":
            case "BV":
                if (!_model.Variables.TryGetValue(argument, out var variable))
                {
                    throw new SimulationException($"переменная {argument} не определена.");
                }

                var value = variable.Expression.Evaluate(this, transaction);
                return variable.Kind == VariableKind.Boolean ? (value != 0 ? 1 : 0) : value;
            case "N":
            case "W":
            {
                var block = _model.Blocks[BlockNumber(argument) - 1];
                return family == "N" ? block.EntryCount : block.CurrentCount;
            }
            case "LS":
                return _logicSwitches.TryGetValue(EntityNumber(argument), out var set) && set.IsSet ? 1 : 0;
            case "LR":
                return _logicSwitches.TryGetValue(EntityNumber(argument), out var reset) && reset.IsSet ? 0 : 1;
        }

        if (family.StartsWith('Q'))
        {
            var queue = _queues.GetValueOrDefault(EntityNumber(argument));
            if (queue is null)
            {
                return 0;
            }

            var nonZero = queue.Entries - queue.ZeroEntries;
            return family switch
            {
                "Q" => queue.Content,
                "QA" => queue.ContentIntegral.Average(AbsoluteClock, queue.Content),
                "QM" => queue.MaxContent,
                "QC" => queue.Entries,
                "QZ" => queue.ZeroEntries,
                "QT" => queue.Entries > 0 ? queue.TotalTime / queue.Entries : 0,
                "QX" => nonZero > 0 ? queue.TotalTime / nonZero : 0,
                _ => throw new SimulationException($"Неизвестный СЧА {family}."),
            };
        }

        if (family.StartsWith('F'))
        {
            var facility = _facilities.GetValueOrDefault(EntityNumber(argument));
            if (facility is null)
            {
                return family == "FV" ? 1 : 0;
            }

            var utilization = facility.Busy.Average(AbsoluteClock, facility.IsBusy ? 1 : 0);
            return family switch
            {
                "F" => facility.IsBusy ? 1 : 0,
                "FC" => facility.Entries,
                "FR" => Math.Floor(utilization * 1000),
                "FT" => facility.Entries > 0 ? utilization * RelativeClock / facility.Entries : 0,
                "FI" => facility.InterruptChain.Count > 0 ? 1 : 0,
                "FV" => facility.Available ? 1 : 0,
                _ => throw new SimulationException($"Неизвестный СЧА {family}."),
            };
        }

        if (family.StartsWith('S') || family == "R")
        {
            var storage = Storage(argument);
            var average = storage.UsedIntegral.Average(AbsoluteClock, storage.Used);
            return family switch
            {
                "S" => storage.Used,
                "R" => storage.Remaining,
                "SR" => Math.Floor(average / storage.Capacity * 1000),
                "SM" => storage.MaxUsed,
                "SC" => storage.Entries,
                "SA" => average,
                "ST" => storage.Entries > 0 ? average * RelativeClock / storage.Entries : 0,
                "SE" => storage.Used == 0 ? 1 : 0,
                "SF" => storage.Remaining == 0 ? 1 : 0,
                "SV" => storage.Available ? 1 : 0,
                _ => throw new SimulationException($"Неизвестный СЧА {family}."),
            };
        }

        if (family.StartsWith('T'))
        {
            var table = Table(argument);
            return family switch
            {
                "TB" => table.Mean,
                "TC" => table.WeightedCount,
                "TD" => table.StandardDeviation,
                _ => throw new SimulationException($"Неизвестный СЧА {family}."),
            };
        }

        if (family.StartsWith('C'))
        {
            var chain = _userChains.GetValueOrDefault(EntityNumber(argument));
            return family switch
            {
                "CH" => chain?.Members.Count ?? 0,
                "CC" => chain?.Entries ?? 0,
                "CM" => chain?.MaxContent ?? 0,
                "CA" => chain is null ? 0 : chain.ContentIntegral.Average(AbsoluteClock, chain.Members.Count),
                "CT" => chain is null || chain.Entries == 0 ? 0 : chain.ContentIntegral.Average(AbsoluteClock, chain.Members.Count) * RelativeClock / chain.Entries,
                _ => throw new SimulationException($"Неизвестный СЧА {family}."),
            };
        }

        throw new SimulationException($"Неизвестный СЧА {family}.");
    }
}
