using System.Globalization;
using System.Text;

namespace GpssStudio.Simulation.Queueing;

/// <summary>How the servers of a node are represented in GPSS.</summary>
public enum NodeImplementation
{
    /// <summary>Unlimited servers: ADVANCE only.</summary>
    InfiniteServer,

    /// <summary>STORAGE with its priority-ordered delay chain (FIFO, priority, round robin).</summary>
    Storage,

    /// <summary>STORAGE with a user chain holding the waiting customers (LIFO, random, SPT, impatience).</summary>
    StorageWithChain,

    /// <summary>Facility taken with PREEMPT in priority mode (preemptive priority).</summary>
    PreemptiveFacility,
}

/// <summary>GPSS names of the objects generated for a node (used to read the results).</summary>
public sealed record GeneratedNode(string NodeId, string Name, NodeImplementation Implementation, int Servers)
{
    public string Server => Name;
    public string InNode => $"{Name}_S";
    public string Waiting => $"{Name}_Q";
    public string Orbit => $"{Name}_O";
    public string Down => $"{Name}_D";
    public string OnVacation => $"{Name}_V";
    public string Chain => $"{Name}_W";
    public string ArrivalLabel => $"{Name}_IN";
    public string LostLabel => $"{Name}_LOST";
    public string OrbitLabel => $"{Name}_ORB";
    public string BalkLabel => $"{Name}_BALK";
    public string RenegeLabel => $"{Name}_RNG";
    public string DoneLabel => $"{Name}_DONE";
}

/// <summary>GPSS names of the objects generated for a customer class.</summary>
public sealed record GeneratedClass(string ClassId, string Name)
{
    public string InSystem => Name;
    public string ResponseTable => $"{Name}_T";
    public string DoneLabel => $"{Name}_DONE";
    public string LostLabel => $"{Name}_LOST";
}

public sealed class GeneratedQueueingModel
{
    public required string Text { get; init; }
    public required IReadOnlyList<GeneratedNode> Nodes { get; init; }
    public required IReadOnlyList<GeneratedClass> Classes { get; init; }
    public IReadOnlyList<string> Warnings { get; init; } = [];

    /// <summary>Random number streams used by the model (RN1 drives the routing TRANSFER blocks).</summary>
    public int StreamCount { get; init; }
}

/// <summary>
/// Builds a GPSS World model of a queueing system or network: one segment per customer class (source, think
/// phase of a closed class, completion), one segment per node (balking, capacity, waiting, discipline, service,
/// impatience, orbit, routing), controller transactions for failures and vacations, and a timer with an optional
/// warm-up (START, RESET, START). Statistics are taken from queues (whole node, waiting, orbit), the storage or
/// facility of the servers, block entry counts of labelled blocks and a response time table per class.
/// </summary>
public static class QueueingGenerator
{
    public const int MaxNodes = 30;
    public const int MaxClasses = 10;
    public const int MaxReplications = 30;
    private const string RoundRobinEpsilon = "0.000000001";

    public static GeneratedQueueingModel Generate(QueueingModel model)
    {
        var errors = Validate(model);
        if (errors.Count > 0)
        {
            throw new ArgumentException(string.Join(" ", errors));
        }

        return new Writer(model).Write();
    }

    /// <summary>All problems of the description; an empty list when it can be generated.</summary>
    public static IReadOnlyList<string> Validate(QueueingModel model)
    {
        var errors = new List<string>();
        void Check(string? message, string where)
        {
            if (message is not null)
            {
                errors.Add($"{where}: {message}.");
            }
        }

        if (model.Nodes.Count == 0 || model.Nodes.Count > MaxNodes)
        {
            errors.Add($"Нужен хотя бы один узел (не более {MaxNodes}).");
        }

        if (model.Classes.Count == 0 || model.Classes.Count > MaxClasses)
        {
            errors.Add($"Нужен хотя бы один класс заявок (не более {MaxClasses}).");
        }

        if (!(model.Duration > 0) || model.Duration > 1e9)
        {
            errors.Add("Длительность моделирования должна быть положительной (не более 10⁹).");
        }

        if (model.WarmUp < 0 || model.WarmUp > 1e9 || !double.IsFinite(model.WarmUp))
        {
            errors.Add("Разгонный период не может быть отрицательным.");
        }

        if (model.Replications < 1 || model.Replications > MaxReplications)
        {
            errors.Add($"Число прогонов — от 1 до {MaxReplications}.");
        }

        var nodeIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var node in model.Nodes)
        {
            var where = $"Узел «{Title(node)}»";
            if (string.IsNullOrWhiteSpace(node.Id) || node.Id.Length > 40)
            {
                errors.Add($"{where}: нужен идентификатор длиной до 40 символов.");
            }
            else if (!nodeIds.Add(node.Id))
            {
                errors.Add($"{where}: идентификатор «{node.Id}» повторяется.");
            }
        }

        foreach (var node in model.Nodes)
        {
            ValidateNode(node, nodeIds, Check, errors);
        }

        var classIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var customerClass in model.Classes)
        {
            var where = $"Класс «{Title(customerClass)}»";
            if (string.IsNullOrWhiteSpace(customerClass.Id) || !classIds.Add(customerClass.Id))
            {
                errors.Add($"{where}: идентификатор пуст или повторяется.");
            }

            if (!nodeIds.Contains(customerClass.Entry))
            {
                errors.Add($"{where}: не задан узел, в который поступают заявки.");
            }

            if (customerClass.Kind == CustomerClassKind.Open)
            {
                if (customerClass.Arrival is null)
                {
                    errors.Add($"{where}: не задан интервал между поступлениями.");
                }
                else
                {
                    Check(DistributionMath.Validate(customerClass.Arrival), $"{where}, интервал поступления");
                }

                if (customerClass.Batch is not null)
                {
                    Check(DistributionMath.Validate(customerClass.Batch), $"{where}, групповое поступление");
                }
            }
            else
            {
                if (customerClass.Population < 1 || customerClass.Population > 2000)
                {
                    errors.Add($"{where}: число заявок замкнутого класса — от 1 до 2000.");
                }

                if (customerClass.Think is not null)
                {
                    Check(DistributionMath.Validate(customerClass.Think, allowZero: true), $"{where}, время вне системы");
                }
            }

            if (customerClass.Priority is < -1000 or > 1000)
            {
                errors.Add($"{where}: приоритет — от −1000 до 1000.");
            }

            foreach (var service in customerClass.Services)
            {
                if (!nodeIds.Contains(service.Node))
                {
                    errors.Add($"{where}: время обслуживания задано для неизвестного узла «{service.Node}».");
                }
                else
                {
                    Check(DistributionMath.Validate(service.Service), $"{where}, обслуживание в узле «{service.Node}»");
                }
            }
        }

        if (errors.Count == 0)
        {
            CheckExits(model, errors);
        }

        return errors;
    }

    private static void ValidateNode(QueueingNode node, HashSet<string> nodeIds, Action<string?, string> check, List<string> errors)
    {
        var where = $"Узел «{Title(node)}»";
        var infinite = node.Servers == 0;
        if (node.Servers < 0 || node.Servers > 1000)
        {
            errors.Add($"{where}: число каналов — от 1 до 1000 (0 — неограниченно).");
        }

        if (node.Capacity is { } capacity && (capacity < Math.Max(1, node.Servers) || capacity > 100_000))
        {
            errors.Add($"{where}: ёмкость узла (мест всего, вместе с каналами) должна быть не меньше числа каналов.");
        }

        check(DistributionMath.Validate(node.Service), $"{where}, время обслуживания");

        if (node.Discipline == QueueDiscipline.PreemptivePriority && node.Servers != 1)
        {
            errors.Add($"{where}: приоритет с прерыванием обслуживания поддерживается для одного канала.");
        }

        if (node.Discipline == QueueDiscipline.RoundRobin && !(node.Quantum > 0))
        {
            errors.Add($"{where}: для циклического обслуживания нужен положительный квант.");
        }

        if (node.Patience is not null)
        {
            check(DistributionMath.Validate(node.Patience), $"{where}, время терпения");
            if (node.Discipline is QueueDiscipline.PreemptivePriority or QueueDiscipline.RoundRobin)
            {
                errors.Add($"{where}: уход из очереди не поддерживается при приоритете с прерыванием и циклическом обслуживании.");
            }
        }

        if (node.Balking == BalkingKind.Linear && !(node.BalkingThreshold > 0))
        {
            errors.Add($"{where}: для отказа от вступления в очередь задайте положительный порог длины очереди.");
        }

        if (node.WhenFull == FullPolicy.Retry)
        {
            if (node.Capacity is null)
            {
                errors.Add($"{where}: повторные попытки возможны только при ограниченной ёмкости узла.");
            }

            if (node.Retrial is null)
            {
                errors.Add($"{where}: не задан интервал повторных попыток.");
            }
            else
            {
                check(DistributionMath.Validate(node.Retrial), $"{where}, интервал повторных попыток");
            }
        }

        if ((node.TimeToFailure is null) != (node.Repair is null))
        {
            errors.Add($"{where}: для отказов задайте и время работы до отказа, и время восстановления.");
        }
        else if (node.TimeToFailure is not null)
        {
            check(DistributionMath.Validate(node.TimeToFailure), $"{where}, время до отказа");
            check(DistributionMath.Validate(node.Repair!), $"{where}, время восстановления");
        }

        if (node.Vacation is not null)
        {
            check(DistributionMath.Validate(node.Vacation), $"{where}, отпуск прибора");
            if (node.TimeToFailure is not null)
            {
                errors.Add($"{where}: отпуска и отказы прибора одновременно не поддерживаются.");
            }
        }

        if (infinite && (node.Patience is not null || node.Balking != BalkingKind.None || node.Vacation is not null || node.TimeToFailure is not null))
        {
            errors.Add($"{where}: в узле с неограниченным числом каналов нет очереди, отказов и отпусков.");
        }

        var total = 0.0;
        foreach (var route in node.Routes)
        {
            if (route.Probability < 0 || route.Probability > 1 || !double.IsFinite(route.Probability))
            {
                errors.Add($"{where}: вероятность перехода должна быть от 0 до 1.");
            }

            if (!string.IsNullOrEmpty(route.Target) && !nodeIds.Contains(route.Target))
            {
                errors.Add($"{where}: переход в неизвестный узел «{route.Target}».");
            }

            total += route.Probability;
        }

        if (total > 1 + 1e-9)
        {
            errors.Add($"{where}: сумма вероятностей переходов больше 1.");
        }
    }

    /// <summary>Every node a class can reach must have a path to the exit, otherwise customers circulate forever.</summary>
    private static void CheckExits(QueueingModel model, List<string> errors)
    {
        var byId = model.Nodes.ToDictionary(node => node.Id);
        var canExit = new HashSet<string>(model.Nodes.Where(node => ExitProbability(node) > 1e-12).Select(node => node.Id));
        bool changed;
        do
        {
            changed = false;
            foreach (var node in model.Nodes.Where(node => !canExit.Contains(node.Id)))
            {
                if (node.Routes.Any(route => route.Probability > 0 && !string.IsNullOrEmpty(route.Target) && canExit.Contains(route.Target!)))
                {
                    canExit.Add(node.Id);
                    changed = true;
                }
            }
        }
        while (changed);

        var reachable = new HashSet<string>();
        var pending = new Stack<string>(model.Classes.Select(customerClass => customerClass.Entry));
        while (pending.Count > 0)
        {
            var id = pending.Pop();
            if (!reachable.Add(id))
            {
                continue;
            }

            foreach (var route in byId[id].Routes.Where(route => route.Probability > 0 && !string.IsNullOrEmpty(route.Target)))
            {
                pending.Push(route.Target!);
            }
        }

        foreach (var id in reachable.Where(id => !canExit.Contains(id)))
        {
            errors.Add($"Узел «{Title(byId[id])}»: из него заявки не могут покинуть систему (проверьте вероятности переходов).");
        }
    }

    public static double ExitProbability(QueueingNode node) =>
        Math.Max(0, 1 - node.Routes.Where(route => !string.IsNullOrEmpty(route.Target)).Sum(route => route.Probability));

    public static string Title(QueueingNode node) => string.IsNullOrWhiteSpace(node.Name) ? node.Id : node.Name;

    public static string Title(CustomerClass customerClass) => string.IsNullOrWhiteSpace(customerClass.Name) ? customerClass.Id : customerClass.Name;

    public static NodeImplementation ImplementationOf(QueueingNode node) =>
        node.Servers == 0 ? NodeImplementation.InfiniteServer
        : node.Discipline == QueueDiscipline.PreemptivePriority ? NodeImplementation.PreemptiveFacility
        : node.Discipline is QueueDiscipline.Lifo or QueueDiscipline.Random or QueueDiscipline.ShortestJob || node.Patience is not null
            ? NodeImplementation.StorageWithChain
            : NodeImplementation.Storage;

    private static bool UsesPriority(QueueingNode node) => node.Discipline is QueueDiscipline.Priority or QueueDiscipline.PreemptivePriority;

    private sealed class Writer(QueueingModel model)
    {
        private readonly StringBuilder _text = new();
        private readonly List<string> _warnings = [];
        private int _nextStream = 2;
        private readonly Dictionary<string, GeneratedNode> _nodes = new(StringComparer.Ordinal);
        private readonly List<GeneratedClass> _classes = [];

        private int Stream() => _nextStream++;

        private void Line(string? label, string operation, string operands = "", string? comment = null)
        {
            var line = $"{label ?? string.Empty,-12}{operation,-10}{operands}";
            _text.AppendLine(comment is null ? line.TrimEnd() : $"{line,-46} ; {comment}");
        }

        private void Comment(string text) => _text.AppendLine($"; {text}");

        public GeneratedQueueingModel Write()
        {
            for (var index = 0; index < model.Nodes.Count; index++)
            {
                var node = model.Nodes[index];
                _nodes[node.Id] = new GeneratedNode(node.Id, $"Node{index + 1}", ImplementationOf(node), node.Servers);
            }

            for (var index = 0; index < model.Classes.Count; index++)
            {
                _classes.Add(new GeneratedClass(model.Classes[index].Id, $"Cls{index + 1}"));
            }

            Comment($"Модель СМО «{OneLine(model.Name)}», сформирована конструктором систем массового обслуживания.");
            Comment($"Единица модельного времени: {OneLine(model.TimeUnit)}. Статистика собирается {DistributionMath.Format(model.Duration)} ед. времени"
                + (model.WarmUp > 0 ? $" после разгона {DistributionMath.Format(model.WarmUp)} ед." : "."));
            Comment("Параметры транзактов: Cls — номер класса, Prio — приоритет класса, Done/Lost — блоки завершения и потери заявки.");
            _text.AppendLine();

            WriteDefinitions();
            for (var index = 0; index < model.Classes.Count; index++)
            {
                WriteClass(model.Classes[index], _classes[index], index + 1);
            }

            foreach (var node in model.Nodes)
            {
                WriteNode(node, _nodes[node.Id]);
            }

            foreach (var node in model.Nodes.Where(node => node.Vacation is not null || node.TimeToFailure is not null))
            {
                WriteController(node, _nodes[node.Id]);
            }

            WriteTimer();
            return new GeneratedQueueingModel { Text = _text.ToString(), Nodes = model.Nodes.Select(node => _nodes[node.Id]).ToList(), Classes = _classes, Warnings = _warnings, StreamCount = _nextStream - 1 };
        }

        private void WriteDefinitions()
        {
            foreach (var node in model.Nodes)
            {
                var names = _nodes[node.Id];
                if (names.Implementation is NodeImplementation.Storage or NodeImplementation.StorageWithChain)
                {
                    Line(names.Server, "STORAGE", node.Servers.ToString(CultureInfo.InvariantCulture), $"каналы узла «{OneLine(Title(node))}»");
                }
            }

            for (var index = 0; index < model.Classes.Count; index++)
            {
                var width = TableWidth(model.Classes[index]);
                Line(_classes[index].ResponseTable, "TABLE", $"M1,0,{DistributionMath.Format(width)},40", $"время пребывания класса «{OneLine(Title(model.Classes[index]))}»");
            }

            _text.AppendLine();
        }

        private double TableWidth(CustomerClass customerClass)
        {
            var service = model.Nodes.Sum(node => DistributionMath.Mean(ServiceOf(node, customerClass)));
            var raw = Math.Max(service / 4, 1e-6);
            var magnitude = Math.Pow(10, Math.Floor(Math.Log10(raw)));
            return Math.Round(raw / magnitude) * magnitude;
        }

        private static Distribution ServiceOf(QueueingNode node, CustomerClass customerClass) =>
            customerClass.Services.FirstOrDefault(service => service.Node == node.Id)?.Service ?? node.Service;

        private void WriteClass(CustomerClass customerClass, GeneratedClass names, int number)
        {
            var entry = _nodes[customerClass.Entry].ArrivalLabel;
            if (customerClass.Kind == CustomerClassKind.Open)
            {
                Comment($"===== Класс {number} «{OneLine(Title(customerClass))}»: поток заявок, интервал — {DistributionMath.Describe(customerClass.Arrival!)}"
                    + (customerClass.Batch is null ? "" : $", {DistributionMath.Describe(customerClass.Batch)}"));
                Line(null, "GENERATE", DistributionMath.GpssOperand(customerClass.Arrival!, Stream()));
                if (customerClass.Batch is { } batch && !(batch.Kind == BatchKind.Fixed && batch.Size == 1))
                {
                    Line(null, "SPLIT", DistributionMath.GpssSplitCount(batch, Stream()), "остальные заявки группы");
                }

                WriteClassParameters(number, customerClass, names);
                Line(null, "QUEUE", names.InSystem, "заявок класса в системе");
                Line(null, "TRANSFER", $",{entry}");
                Line(names.DoneLabel, "DEPART", names.InSystem, "обслуженная заявка");
                Line(null, "TABULATE", names.ResponseTable);
                Line(null, "TERMINATE");
                Line(names.LostLabel, "DEPART", names.InSystem, "потерянная заявка");
                Line(null, "TERMINATE");
            }
            else
            {
                var think = customerClass.Think is { } distribution && !(distribution.Kind == DistributionKind.Deterministic && distribution.Mean == 0) ? distribution : null;
                Comment($"===== Класс {number} «{OneLine(Title(customerClass))}»: замкнутый, {customerClass.Population} заявок"
                    + (think is null ? "" : $", время вне системы — {DistributionMath.Describe(think)}"));
                var think_label = $"{names.Name}_THINK";
                Line(null, "GENERATE", $",,0,{customerClass.Population.ToString(CultureInfo.InvariantCulture)}");
                WriteClassParameters(number, customerClass, names);
                if (think is not null)
                {
                    Line(think_label, "ADVANCE", DistributionMath.GpssOperand(think, Stream()), "вне системы");
                    Line(null, "MARK");
                }
                else
                {
                    Line(think_label, "MARK");
                }

                Line(null, "QUEUE", names.InSystem, "заявок класса в системе");
                Line(null, "TRANSFER", $",{entry}");
                Line(names.DoneLabel, "DEPART", names.InSystem, "заявка обслужена");
                Line(null, "TABULATE", names.ResponseTable);
                Line(null, "TRANSFER", $",{think_label}");
                Line(names.LostLabel, "DEPART", names.InSystem, "заявка потеряна");
                Line(null, "TRANSFER", $",{think_label}");
            }

            _text.AppendLine();
        }

        private void WriteClassParameters(int number, CustomerClass customerClass, GeneratedClass names)
        {
            Line(null, "ASSIGN", $"Cls,{number}");
            Line(null, "ASSIGN", $"Prio,{customerClass.Priority.ToString(CultureInfo.InvariantCulture)}");
            Line(null, "ASSIGN", $"Done,{names.DoneLabel}");
            Line(null, "ASSIGN", $"Lost,{names.LostLabel}");
        }

        private string ServiceOperand(QueueingNode node)
        {
            var distributions = model.Classes.Select(customerClass => ServiceOf(node, customerClass)).ToList();
            if (distributions.All(distribution => ReferenceEquals(distribution, node.Service)))
            {
                return DistributionMath.GpssOperand(node.Service, Stream());
            }

            var stream = Stream();
            var terms = distributions.Select((distribution, index) => $"(P$Cls={index + 1})#{Wrap(DistributionMath.GpssOperand(distribution, stream))}");
            return $"({string.Join("+", terms)})";
        }

        private static string Wrap(string operand) => operand.StartsWith('(') ? operand : $"({operand})";

        private void WriteNode(QueueingNode node, GeneratedNode names)
        {
            var title = OneLine(Title(node));
            var servers = node.Servers == 0 ? "∞" : node.Servers.ToString(CultureInfo.InvariantCulture);
            Comment($"===== Узел «{title}» ({names.Name}): каналов {servers}, ёмкость {(node.Capacity is { } k ? k.ToString(CultureInfo.InvariantCulture) : "∞")}, "
                + $"дисциплина {DisciplineLabel(node)}, обслуживание — {DistributionMath.Describe(node.Service)}");

            Line(names.ArrivalLabel, "PRIORITY", UsesPriority(node) ? "P$Prio" : "0", UsesPriority(node) ? "приоритет класса" : "без приоритетов");
            switch (node.Balking)
            {
                case BalkingKind.Linear:
                {
                    var threshold = DistributionMath.Format(node.BalkingThreshold);
                    Line(null, "TEST L", $"(Uniform({Stream()},0,1)#{threshold}),({threshold}-Q${names.Waiting}),{names.BalkLabel}", "вступает с вероятностью 1 − w/порог");
                    break;
                }
                case BalkingKind.Discouraged:
                    Line(null, "TEST L", $"(Uniform({Stream()},0,1)#(Q${names.Waiting}+1)),1,{names.BalkLabel}", "вступает с вероятностью 1/(w+1)");
                    break;
            }

            var tryLabel = node.WhenFull == FullPolicy.Retry ? $"{names.Name}_TRY" : null;
            var fullLabel = node.WhenFull == FullPolicy.Retry ? names.OrbitLabel : names.LostLabel;
            if (node.Capacity is { } capacity)
            {
                Line(tryLabel, "TEST L", $"Q${names.InNode},{capacity.ToString(CultureInfo.InvariantCulture)},{fullLabel}", "есть свободное место?");
            }

            Line(null, "QUEUE", names.InNode, "заявок в узле");
            var service = ServiceOperand(node);
            string? backLabel = null;
            switch (names.Implementation)
            {
                case NodeImplementation.InfiniteServer:
                    Line(null, "ADVANCE", service, "обслуживание (каналов неограниченно)");
                    break;
                case NodeImplementation.PreemptiveFacility:
                    Line(null, "QUEUE", names.Waiting, "ожидающих");
                    Line(null, "PREEMPT", $"{names.Server},PR", "прерывает заявку с меньшим приоритетом");
                    Line(null, "DEPART", names.Waiting);
                    Line(null, "ADVANCE", service, "обслуживание (дообслуживание после прерывания)");
                    Line(null, "RETURN", names.Server);
                    break;
                case NodeImplementation.Storage when node.Discipline == QueueDiscipline.RoundRobin:
                {
                    var queueLabel = $"{names.Name}_RQ";
                    backLabel = $"{names.Name}_BACK";
                    Line(null, "ASSIGN", $"Rem,{service}", "необходимое время обслуживания");
                    Line(queueLabel, "QUEUE", names.Waiting, "ожидающих кванта");
                    Line(null, "ENTER", names.Server);
                    Line(null, "DEPART", names.Waiting);
                    Line(null, "ASSIGN", $"Slc,(MIN(P$Rem,{DistributionMath.Format(node.Quantum)}))", "квант");
                    Line(null, "ADVANCE", "P$Slc");
                    Line(null, "ASSIGN", "Rem-,P$Slc");
                    Line(null, "LEAVE", names.Server);
                    Line(null, "TEST LE", $"P$Rem,{RoundRobinEpsilon},{backLabel}", "обслуживание закончено?");
                    break;
                }
                case NodeImplementation.Storage:
                    Line(null, "QUEUE", names.Waiting, "ожидающих");
                    Line(null, "ENTER", names.Server, UsesPriority(node) ? "очередь упорядочена по приоритету" : "очередь FIFO");
                    Line(null, "DEPART", names.Waiting);
                    Line(null, "ADVANCE", service, "обслуживание");
                    Line(null, "LEAVE", names.Server);
                    break;
                case NodeImplementation.StorageWithChain:
                {
                    var waitLabel = $"{names.Name}_WAIT";
                    var goLabel = $"{names.Name}_GO";
                    Line(null, "QUEUE", names.Waiting, "ожидающих");
                    var advance = service;
                    if (node.Discipline == QueueDiscipline.ShortestJob)
                    {
                        Line(null, "ASSIGN", $"Svc,{service}", "время обслуживания известно заранее");
                        advance = "P$Svc";
                    }
                    else if (node.Discipline == QueueDiscipline.Random)
                    {
                        Line(null, "ASSIGN", $"Key,(Uniform({Stream()},0,1))", "случайный ключ выбора");
                    }

                    Line(null, "TEST E", $"CH${names.Chain},0,{waitLabel}", "никто не ждёт?");
                    Line(null, "GATE SNF", $"{names.Server},{waitLabel}", "есть свободный канал?");
                    if (node.Vacation is not null || node.TimeToFailure is not null)
                    {
                        Line(null, "GATE SV", $"{names.Server},{waitLabel}", "прибор доступен?");
                    }

                    Line(goLabel, "ENTER", names.Server);
                    Line(null, "DEPART", names.Waiting);
                    Line(null, "ADVANCE", advance, "обслуживание");
                    Line(null, "LEAVE", names.Server);
                    Line(null, "UNLINK", $"{names.Chain},{goLabel},1", "следующая заявка из очереди");
                    break;
                }
            }

            Line(names.DoneLabel, "DEPART", names.InNode, "обслуживание в узле закончено");
            WriteRouting(node);

            if (backLabel is not null)
            {
                Line(backLabel, "BUFFER", "", "пропустить вперёд ожидающих");
                Line(null, "TRANSFER", $",{names.Name}_RQ", "в конец очереди");
            }

            if (names.Implementation == NodeImplementation.StorageWithChain)
            {
                var waitLabel = $"{names.Name}_WAIT";
                if (node.Patience is not null)
                {
                    Line(waitLabel, "ASSIGN", "Id,XN1", "номер заявки для таймера терпения");
                    Line(null, "SPLIT", $"1,{names.Name}_PAT", "копия — таймер терпения");
                    Line(null, "LINK", $"{names.Chain},{ChainOrder(node)}", $"ожидание ({DisciplineLabel(node)})");
                    Line($"{names.Name}_PAT", "ADVANCE", DistributionMath.GpssOperand(node.Patience, Stream()), "терпение");
                    Line(null, "UNLINK", $"{names.Chain},{names.RenegeLabel},1,Id", "ещё ждёт — уходит");
                    Line(null, "TERMINATE");
                    Line(names.RenegeLabel, "DEPART", names.Waiting, "уход из очереди");
                    Line(null, "DEPART", names.InNode);
                    Line(null, "TRANSFER", "P,Lost");
                }
                else
                {
                    Line(waitLabel, "LINK", $"{names.Chain},{ChainOrder(node)}", $"ожидание ({DisciplineLabel(node)})");
                }
            }

            if (node.Balking != BalkingKind.None)
            {
                Line(names.BalkLabel, "TRANSFER", "P,Lost", "не встал в очередь");
            }

            if (node.Capacity is not null)
            {
                if (node.WhenFull == FullPolicy.Retry)
                {
                    Line(names.OrbitLabel, "QUEUE", names.Orbit, "мест нет — на орбиту");
                    Line(null, "ADVANCE", DistributionMath.GpssOperand(node.Retrial!, Stream()), "до повторной попытки");
                    Line(null, "DEPART", names.Orbit);
                    Line(null, "TRANSFER", $",{tryLabel}");
                }
                else
                {
                    Line(names.LostLabel, "TRANSFER", "P,Lost", "мест нет — отказ");
                }
            }

            _text.AppendLine();
        }

        private static string ChainOrder(QueueingNode node) => node.Discipline switch
        {
            QueueDiscipline.Lifo => "LIFO",
            QueueDiscipline.Random => "Key",
            QueueDiscipline.ShortestJob => "Svc",
            QueueDiscipline.Priority => "PR",
            _ => "FIFO",
        };

        private void WriteRouting(QueueingNode node)
        {
            var routes = node.Routes.Where(route => route.Probability > 1e-12 && !string.IsNullOrEmpty(route.Target)).ToList();
            var exit = ExitProbability(node);
            var remaining = 1.0;
            for (var index = 0; index < routes.Count; index++)
            {
                var route = routes[index];
                var target = _nodes[route.Target!].ArrivalLabel;
                var conditional = route.Probability / remaining;
                var last = index == routes.Count - 1 && exit <= 1e-12;
                var fraction = Math.Round(conditional, 6);
                if (last || fraction >= 1)
                {
                    Line(null, "TRANSFER", $",{target}", $"в узел «{OneLine(Title(model.Nodes.First(n => n.Id == route.Target)))}»");
                    return;
                }

                Line(null, "TRANSFER", $"{fraction.ToString("0.######", CultureInfo.InvariantCulture)},,{target}",
                    $"p = {DistributionMath.Format(route.Probability)} в узел «{OneLine(Title(model.Nodes.First(n => n.Id == route.Target)))}»");
                remaining -= route.Probability;
            }

            Line(null, "TRANSFER", "P,Done", "покидает систему");
        }

        private void WriteController(QueueingNode node, GeneratedNode names)
        {
            var facility = names.Implementation == NodeImplementation.PreemptiveFacility;
            var off = facility ? "FUNAVAIL" : "SUNAVAIL";
            var on = facility ? "FAVAIL" : "SAVAIL";
            var unlink = names.Implementation == NodeImplementation.StorageWithChain;
            if (node.Vacation is not null)
            {
                var label = $"{names.Name}_VAC";
                Comment($"===== Отпуска прибора узла «{OneLine(Title(node))}»: начинается, когда узел пуст; отпуск — {DistributionMath.Describe(node.Vacation)}");
                Line(null, "GENERATE", ",,0,1,100");
                Line(label, "TEST E", $"({(facility ? "F" : "S")}${names.Server}+Q${names.Waiting}),0", "узел пуст?");
                Line(null, "QUEUE", names.OnVacation);
                Line(null, off, names.Server, "отпуск");
                Line(null, "ADVANCE", DistributionMath.GpssOperand(node.Vacation, Stream()));
                Line(null, on, names.Server);
                Line(null, "DEPART", names.OnVacation);
                if (unlink)
                {
                    Line(null, "UNLINK", $"{names.Chain},{names.Name}_GO,{node.Servers}");
                }

                Line(null, "TRANSFER", $",{label}", "заявок нет — снова в отпуск");
            }
            else
            {
                var label = $"{names.Name}_BRK";
                Comment($"===== Отказы узла «{OneLine(Title(node))}»: работа до отказа — {DistributionMath.Describe(node.TimeToFailure!)}, восстановление — {DistributionMath.Describe(node.Repair!)}");
                Comment("Во время восстановления новые заявки не принимаются на обслуживание, начатое обслуживание завершается.");
                Line(null, "GENERATE", ",,0,1,100");
                Line(label, "ADVANCE", DistributionMath.GpssOperand(node.TimeToFailure!, Stream()), "работа до отказа");
                Line(null, "QUEUE", names.Down);
                Line(null, off, names.Server, "отказ");
                Line(null, "ADVANCE", DistributionMath.GpssOperand(node.Repair!, Stream()), "восстановление");
                Line(null, on, names.Server);
                Line(null, "DEPART", names.Down);
                if (unlink)
                {
                    Line(null, "UNLINK", $"{names.Chain},{names.Name}_GO,{node.Servers}");
                }

                Line(null, "TRANSFER", $",{label}");
            }

            _text.AppendLine();
        }

        private void WriteTimer()
        {
            Comment("===== Таймер");
            if (model.WarmUp > 0)
            {
                Line(null, "GENERATE", $",,{DistributionMath.Format(model.WarmUp)},1", "конец разгона");
                Line(null, "TERMINATE", "1");
            }

            Line(null, "GENERATE", $",,{DistributionMath.Format(model.WarmUp + model.Duration)},1", "конец моделирования");
            Line(null, "TERMINATE", "1");
            _text.AppendLine();
            if (model.WarmUp > 0)
            {
                Line(null, "START", "1,NP", "разгон");
                Line(null, "RESET", "", "статистика с начала установившегося режима");
            }

            Line(null, "START", "1");
        }
    }

    public static string DisciplineLabel(QueueingNode node) => node.Discipline switch
    {
        QueueDiscipline.Fifo => "FIFO",
        QueueDiscipline.Lifo => "LIFO",
        QueueDiscipline.Random => "случайный выбор (SIRO)",
        QueueDiscipline.ShortestJob => "кратчайшая работа первой (SPT)",
        QueueDiscipline.Priority => "относительный приоритет",
        QueueDiscipline.PreemptivePriority => "абсолютный приоритет (с прерыванием)",
        QueueDiscipline.RoundRobin => $"циклическое, квант {DistributionMath.Format(node.Quantum)}",
        _ => "?",
    };

    private static string OneLine(string text) => text.ReplaceLineEndings(" ").Replace(";", ",");
}
