using System.Globalization;
using GpssStudio.Projects.Model;
using GpssStudio.Simulation.Parsing;
using GpssStudio.Simulation.Translation;

namespace GpssStudio.Projects.Generation;

public sealed record GenerationMessage(string Severity, string Message, string? NodeId = null, string? Teb = null)
{
    public const string Error = "error";
    public const string Warning = "warning";
    public const string Info = "info";
}

public sealed class GenerationResult
{
    public required string Text { get; init; }
    public required IReadOnlyList<GenerationMessage> Messages { get; init; }

    /// <summary>Number of lines produced by the generator (not written by the user).</summary>
    public int GeneratedLines { get; init; }

    public bool Success => Messages.All(message => message.Severity != GenerationMessage.Error);
}

/// <summary>
/// Builds the GPSS World model text from a structural scheme (GPSS Studio manual, 3.15): TEB models with
/// name correction, data TEB definitions, transitions between TEB outputs and inputs (direct, copies with
/// SPLIT, first available, random) and connection models.
/// </summary>
public sealed class ModelGenerator
{
    private const string Separator = "************************************************************";
    private static readonly HashSet<string> ControlCommands = new(StringComparer.OrdinalIgnoreCase) { "START", "STEP", "RESET", "CLEAR", "SHOW", "HALT", "CONTINUE", "STOP" };

    private readonly List<GenerationMessage> _messages = [];
    private readonly List<FlatTeb> _tebs = [];
    private readonly List<Scope> _scopes = [];
    private readonly Dictionary<TebScheme, (TebScheme Parent, TebNode Composite)> _parents = [];
    private readonly HashSet<string> _usedNames = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<(FlatTeb, int), string> _entryLabels = [];
    private readonly List<Output> _outputs = [];
    private int _autoCounter;
    private int _connectionCounter;
    private int _generatedLines;

    private ModelGenerator()
    {
    }

    public static GenerationResult Generate(TebScheme scheme, string modelName) => new ModelGenerator().Run(scheme, modelName);

    private GenerationResult Run(TebScheme scheme, string modelName)
    {
        var root = new Scope(null, null, string.Empty);
        _scopes.Add(root);
        Collect(scheme, root);
        AssignEntryLabels();
        foreach (var teb in _tebs)
        {
            ResolveOutputs(teb);
        }

        foreach (var teb in _tebs)
        {
            teb.Corrector = CreateCorrector(teb);
        }

        var lines = new List<string>
        {
            Separator,
            $"* Имитационная модель: «{modelName}»",
            Separator,
            string.Empty,
        };
        _generatedLines += 4;

        foreach (var scope in _scopes)
        {
            EmitScope(scope, lines);
        }

        foreach (var teb in Order())
        {
            EmitTeb(teb, lines);
        }

        MoveControlStatementsToEnd(lines);
        var text = string.Join("\n", RemoveJumpsToNextLine(lines)).TrimEnd() + "\n";
        Validate(text);
        return new GenerationResult { Text = text, Messages = _messages, GeneratedLines = _generatedLines };
    }

    // ----------------------------------------------------------------- collection

    private void Collect(TebScheme scheme, Scope scope)
    {
        foreach (var node in scheme.Nodes)
        {
            switch (node.Kind)
            {
                case TebKinds.Composite:
                {
                    var name = UniqueName(node);
                    var child = new Scope(scope, node, name + "_") { Header = node.Header };
                    _scopes.Add(child);
                    if (node.Child is not null)
                    {
                        _parents[node.Child] = (scheme, node);
                        Collect(node.Child, child);
                    }

                    break;
                }
                case TebKinds.Data:
                    scope.DataTebs.Add(node);
                    foreach (var entity in node.Entities)
                    {
                        scope.DataNames[entity.Name] = scope.Prefix + entity.Name;
                    }

                    break;
                case TebKinds.Simple:
                {
                    var teb = new FlatTeb(node, scheme, scope, UniqueName(node));
                    if (node.InstancesCount > 1)
                    {
                        Warn(teb, $"Задано {node.InstancesCount} экземпляров ТЭБа; генерируется один экземпляр.");
                    }

                    _tebs.Add(teb);
                    break;
                }
            }
        }
    }

    private string UniqueName(TebNode node)
    {
        var name = node.NameInModel;
        if (string.IsNullOrWhiteSpace(name) || !_usedNames.Add(name))
        {
            var index = _usedNames.Count + 1;
            do
            {
                name = "teb" + index.ToString(CultureInfo.InvariantCulture);
                index++;
            }
            while (!_usedNames.Add(name));
        }

        return name;
    }

    // ----------------------------------------------------------------- connections

    private void AssignEntryLabels()
    {
        var targeted = new HashSet<(FlatTeb, int)>();
        foreach (var teb in _tebs)
        {
            foreach (var output in teb.Node.Outputs)
            {
                foreach (var link in LinksFrom(teb.Scheme, teb.Node.Id, output.Id))
                {
                    foreach (var target in ResolveTargets(teb.Scheme, link.ToNodeId, link.ToPortId, 0))
                    {
                        targeted.Add(target);
                    }
                }
            }
        }

        foreach (var teb in _tebs)
        {
            foreach (var input in teb.Node.Inputs)
            {
                if (!targeted.Contains((teb, input.Id)))
                {
                    continue;
                }

                switch (input.Mode)
                {
                    case ConnectedBlockModes.FirstBlock:
                        var first = teb.Lines.FirstOrDefault(line => line.IsBlock);
                        if (first is null)
                        {
                            Error(teb, "Вход связан с первым блоком, но в модели ТЭБа нет блоков.");
                            _entryLabels[(teb, input.Id)] = teb.Prefix + "noBlocks";
                        }
                        else if (first.Label is not null)
                        {
                            _entryLabels[(teb, input.Id)] = teb.Prefix + first.Label;
                        }
                        else
                        {
                            var label = $"{teb.Prefix}autoGenerated{++_autoCounter}_firstBlock";
                            first.Label = label;
                            first.LabelIsFinal = true;
                            _entryLabels[(teb, input.Id)] = label;
                            _generatedLines++;
                        }

                        break;
                    case ConnectedBlockModes.Label when !string.IsNullOrEmpty(input.Label):
                        if (!teb.LocalLabels.Contains(input.Label))
                        {
                            Error(teb, $"Метка входа «{input.Label}» не найдена в модели ТЭБа.");
                        }

                        _entryLabels[(teb, input.Id)] = teb.Prefix + input.Label;
                        break;
                    default:
                        Error(teb, $"Для входа №{input.Id} не задан связанный блок.");
                        _entryLabels[(teb, input.Id)] = teb.Prefix + "input" + input.Id.ToString(CultureInfo.InvariantCulture);
                        break;
                }
            }
        }
    }

    private IEnumerable<TebLink> LinksFrom(TebScheme scheme, string nodeId, int portId) =>
        scheme.Links.Where(link => link.FromNodeId == nodeId && link.FromPortId == portId)
            .Select((link, index) => (link, index))
            .OrderByDescending(item => item.link.Priority)
            .ThenBy(item => item.index)
            .Select(item => item.link);

    /// <summary>Elementary TEB inputs reached through a connection, crossing composite TEB boundaries.</summary>
    private List<(FlatTeb Teb, int Input)> ResolveTargets(TebScheme scheme, string nodeId, int portId, int depth)
    {
        var result = new List<(FlatTeb, int)>();
        if (depth > 32)
        {
            return result;
        }

        var node = scheme.Nodes.FirstOrDefault(item => item.Id == nodeId);
        if (node is null)
        {
            // Output connector of the enclosing composite TEB: continue on the parent level.
            var boundary = scheme.Boundary.FirstOrDefault(item => item.Id == nodeId);
            if (boundary is not null && _parents.TryGetValue(scheme, out var parent))
            {
                foreach (var link in LinksFrom(parent.Parent, parent.Composite.Id, boundary.DefinitionId))
                {
                    result.AddRange(ResolveTargets(parent.Parent, link.ToNodeId, link.ToPortId, depth + 1));
                }
            }

            return result;
        }

        switch (node.Kind)
        {
            case TebKinds.Simple:
                if (_tebs.FirstOrDefault(teb => teb.Node == node) is { } target)
                {
                    result.Add((target, portId));
                }

                break;
            case TebKinds.Composite when node.Child is not null:
                foreach (var boundary in node.Child.Boundary.Where(item => item.Direction == "input" && item.DefinitionId == portId))
                {
                    foreach (var link in node.Child.Links.Where(link => link.FromNodeId == boundary.Id))
                    {
                        result.AddRange(ResolveTargets(node.Child, link.ToNodeId, link.ToPortId, depth + 1));
                    }
                }

                break;
        }

        return result;
    }

    private void ResolveOutputs(FlatTeb teb)
    {
        for (var index = 0; index < teb.Node.Outputs.Count; index++)
        {
            var port = teb.Node.Outputs[index];
            var output = new Output(teb, port, index + 1);
            foreach (var link in LinksFrom(teb.Scheme, teb.Node.Id, port.Id))
            {
                var targets = ResolveTargets(teb.Scheme, link.ToNodeId, link.ToPortId, 0);
                if (targets.Count == 0)
                {
                    Warn(teb, $"Связь выхода №{index + 1} не ведёт ко входу элементарного ТЭБа и пропущена.");
                }

                foreach (var target in targets)
                {
                    var entry = _entryLabels.GetValueOrDefault(target, target.Teb.Prefix + "input");
                    if (!string.IsNullOrWhiteSpace(link.GpssText))
                    {
                        var fragment = new ConnectionFragment(++_connectionCounter, link, entry, target.Teb);
                        output.Fragments.Add(fragment);
                        entry = fragment.EntryLabel;
                    }

                    output.Targets.Add(new OutputTarget(target.Teb, entry, link.Probability));
                }
            }

            if (port.ConnectionsLimit > 0 && output.Targets.Count > port.ConnectionsLimit)
            {
                Error(teb, $"У выхода №{index + 1} {output.Targets.Count} соединений при ограничении {port.ConnectionsLimit}.");
            }

            var needsDispatch = output.Targets.Count > 1 || port.TransferMode == TransferModes.CustomModel;
            if (port.Mode == ConnectedBlockModes.Label)
            {
                if (string.IsNullOrEmpty(port.Label))
                {
                    Error(teb, $"Для выхода №{index + 1} не задана метка фиктивного блока.");
                }
                else
                {
                    if (!teb.ReferencedNames.Contains(port.Label))
                    {
                        Warn(teb, $"Метка выхода «{port.Label}» не используется в модели ТЭБа.");
                    }

                    output.LabelTarget = output.Targets.Count == 1 && !needsDispatch ? output.Targets[0].Entry : output.DispatchLabel;
                    teb.OutputLabels[port.Label] = output.LabelTarget;
                }
            }
            else if (port.Mode != ConnectedBlockModes.LastBlock)
            {
                Error(teb, $"Для выхода №{index + 1} не задан фиктивный блок.");
            }

            if (output.Targets.Count == 0)
            {
                Warn(teb, $"Выход №{index + 1} не соединён ни с одним ТЭБом: транзакты будут уничтожены.");
            }

            _outputs.Add(output);
            teb.Outputs.Add(output);
        }
    }

    private NameCorrector CreateCorrector(FlatTeb teb)
    {
        var parameters = teb.Node.Parameters
            .Where(parameter => parameter.NameInModel.Length > 0 && (parameter.Value ?? parameter.DefaultValue) is not null)
            .ToDictionary(parameter => parameter.NameInModel, parameter => (parameter.Value ?? parameter.DefaultValue)!, StringComparer.OrdinalIgnoreCase);
        return new NameCorrector(teb.Prefix, teb.LocalLabels, teb.OutputLabels, teb.Scope.VisibleDataNames(), parameters);
    }

    // ----------------------------------------------------------------- ordering

    /// <summary>
    /// Depth-first along connections so that a TEB is usually followed by the TEB it passes transactions
    /// to (no extra TRANSFER needed); TEBs with control statements (START ...) come last.
    /// </summary>
    private List<FlatTeb> Order()
    {
        var incoming = new HashSet<FlatTeb>(_outputs.SelectMany(output => output.Targets).Select(target => target.Teb));
        var control = _tebs.Where(teb => teb.HasControlStatements && !incoming.Contains(teb)).ToHashSet();
        var visited = new HashSet<FlatTeb>();
        var order = new List<FlatTeb>();

        void Visit(FlatTeb teb)
        {
            if (!visited.Add(teb))
            {
                return;
            }

            order.Add(teb);
            foreach (var output in teb.Outputs)
            {
                foreach (var target in output.Targets)
                {
                    Visit(target.Teb);
                }
            }
        }

        foreach (var teb in _tebs.Where(teb => !incoming.Contains(teb) && !control.Contains(teb)))
        {
            Visit(teb);
        }

        foreach (var teb in _tebs.Where(teb => !control.Contains(teb)))
        {
            Visit(teb);
        }

        foreach (var teb in control)
        {
            Visit(teb);
        }

        return order;
    }

    // ----------------------------------------------------------------- emission

    private void EmitScope(Scope scope, List<string> lines)
    {
        if (scope.Composite is not null)
        {
            lines.Add($"* ТЭБ «{scope.Header}»");
            _generatedLines++;
        }

        foreach (var data in scope.DataTebs)
        {
            lines.Add($"* ТЭБ «{data.Header}»");
            var corrector = new NameCorrector(scope.Prefix, new HashSet<string>(), new Dictionary<string, string>(), scope.VisibleDataNames(), new Dictionary<string, string>());
            foreach (var entity in data.Entities)
            {
                lines.AddRange(DefineEntity(entity, scope.Prefix + entity.Name, corrector, data));
            }

            lines.Add(string.Empty);
            _generatedLines += 2;
        }
    }

    private IEnumerable<string> DefineEntity(DataEntity entity, string name, NameCorrector corrector, TebNode owner)
    {
        string Value() => corrector.CorrectExpression(entity.Value ?? string.Empty);
        var result = new List<string>();
        switch (entity.Type.ToUpperInvariant())
        {
            case "EQU":
                result.Add($"{name} EQU {Value()}");
                break;
            case "SAVEVALUE":
                result.Add($"INITIAL X${name},{Value()}");
                break;
            case "LOGICSWITCH":
                result.Add($"INITIAL LS${name},{(string.IsNullOrEmpty(entity.Value) ? "1" : Value())}");
                break;
            case "STORAGE":
                result.Add($"{name} STORAGE {Value()}");
                break;
            case "BVARIABLE":
                result.Add($"{name} BVARIABLE ({Value()})");
                break;
            case "VARIABLE":
                result.Add($"{name} VARIABLE ({Value()})");
                break;
            case "FVARIABLE":
                result.Add($"{name} FVARIABLE ({Value()})");
                break;
            case "TABLE":
                result.Add($"{name} TABLE {Value()}");
                break;
            case "MATRIX":
            {
                var cells = entity.Cells ?? [];
                var columns = cells.Count == 0 ? 1 : cells.Max(row => row.Count);
                result.Add($"{name} MATRIX ,{Math.Max(1, cells.Count)},{Math.Max(1, columns)}");
                for (var row = 0; row < cells.Count; row++)
                {
                    for (var column = 0; column < cells[row].Count; column++)
                    {
                        var cell = cells[row][column].Trim();
                        if (cell.Length > 0)
                        {
                            result.Add($"INITIAL MX${name}({row + 1},{column + 1}),{corrector.CorrectExpression(cell)}");
                        }
                    }
                }

                break;
            }
            case "FUNCTION":
            {
                var points = entity.Points ?? [];
                if (points.Count == 0)
                {
                    _messages.Add(new GenerationMessage(GenerationMessage.Error, $"У функции {entity.Name} не заданы точки.", owner.Id, owner.Header));
                    break;
                }

                var type = string.IsNullOrEmpty(entity.FunctionType) ? "D" : entity.FunctionType[..1].ToUpperInvariant();
                result.Add($"{name} FUNCTION {Value()},{type}{points.Count.ToString(CultureInfo.InvariantCulture)}");
                result.Add(string.Join("/", points.Select(point => corrector.CorrectExpression(point))));
                break;
            }
        }

        _generatedLines += result.Count;
        return result;
    }

    private void EmitTeb(FlatTeb teb, List<string> lines)
    {
        var corrector = teb.Corrector!;
        lines.Add($"* ТЭБ «{teb.Node.Header}»");
        _generatedLines++;

        foreach (var entity in teb.Node.Entities)
        {
            lines.AddRange(DefineEntity(entity, corrector.Entity(entity.Name), corrector, teb.Node));
        }

        foreach (var line in teb.Lines)
        {
            lines.Add(corrector.Correct(line).Render());
        }

        var lastOutput = teb.Outputs.FirstOrDefault(output => output.Port.Mode == ConnectedBlockModes.LastBlock && output.Targets.Count > 0);
        if (lastOutput is null && teb.Lines.LastOrDefault(line => line.IsBlock) is { } lastBlock && !EndsFlow(lastBlock))
        {
            // Transactions must not fall through into the next TEB of the assembled text.
            lines.Add("TERMINATE");
            _generatedLines++;
        }

        if (lastOutput is not null)
        {
            EmitTransition(lastOutput, lines, labelled: lastOutput.Targets.Count > 1 || lastOutput.Port.TransferMode == TransferModes.CustomModel);
        }

        foreach (var output in teb.Outputs.Where(output => output != lastOutput))
        {
            if (output.Port.Mode == ConnectedBlockModes.Label && output.LabelTarget == output.DispatchLabel)
            {
                EmitTransition(output, lines, labelled: true);
            }
        }

        lines.Add(string.Empty);
        _generatedLines++;

        foreach (var fragment in teb.Outputs.SelectMany(output => output.Fragments))
        {
            EmitFragment(fragment, lines);
        }
    }

    private static bool EndsFlow(StatementLine block) =>
        block.Operation == "TERMINATE" || (block.Operation == "TRANSFER" && block.Operands.Count > 1 && block.Operands[0].Length == 0);

    /// <summary>Transition code of an output (manual 3.15.1, "Описание режима перехода транзакта").</summary>
    private void EmitTransition(Output output, List<string> lines, bool labelled)
    {
        var targets = output.Targets;
        var label = labelled ? output.DispatchLabel + " " : string.Empty;
        if (targets.Count == 0)
        {
            lines.Add($"{label}TERMINATE");
            _generatedLines++;
            return;
        }

        if (labelled)
        {
            lines.Add($"* Выход №{output.Index}");
            _generatedLines++;
        }

        var emitted = new List<string>();
        switch (output.Port.TransferMode)
        {
            case TransferModes.FirstAvailable when targets.Count > 1:
                // Each TRANSFER BOTH tries its target and otherwise passes on to the next one.
                for (var i = 0; i < targets.Count - 2; i++)
                {
                    emitted.Add($"TRANSFER BOTH,{targets[i].Entry},{output.DispatchLabel}_{i + 2}");
                }

                emitted.Add($"TRANSFER BOTH,{targets[^2].Entry},{targets[^1].Entry}");
                for (var i = 1; i < emitted.Count; i++)
                {
                    emitted[i] = $"{output.DispatchLabel}_{i + 1} {emitted[i]}";
                }

                break;
            case TransferModes.Random when targets.Count > 1:
            {
                var probabilities = Probabilities(targets);
                var remaining = 1.0;
                for (var i = 0; i < targets.Count - 1; i++)
                {
                    var fraction = remaining <= 0 ? 0 : probabilities[i] / remaining;
                    emitted.Add($"TRANSFER {Format(fraction)},,{targets[i].Entry}");
                    remaining -= probabilities[i];
                }

                emitted.Add($"TRANSFER ,{targets[^1].Entry}");
                break;
            }
            case TransferModes.CustomModel:
            {
                var corrector = output.Teb.Corrector!;
                emitted.AddRange(StatementLine.ParseText(output.Port.GpssText).Select(line => corrector.Correct(line).Render()));
                emitted.Add($"TRANSFER ,{targets[0].Entry}");
                break;
            }
            default:
                emitted.AddRange(targets.Skip(1).Select(target => $"SPLIT 1,{target.Entry}"));
                emitted.Add($"TRANSFER ,{targets[0].Entry}");
                break;
        }

        if (labelled)
        {
            emitted[0] = label + emitted[0];
        }

        lines.AddRange(emitted);
        _generatedLines += emitted.Count;
    }

    private static double[] Probabilities(IReadOnlyList<OutputTarget> targets)
    {
        var given = targets.Select(target => target.Probability).ToArray();
        if (given.All(value => value <= 0))
        {
            return targets.Select(_ => 1.0 / targets.Count).ToArray();
        }

        var total = given.Sum();
        return given.Select(value => value / total).ToArray();
    }

    private void EmitFragment(ConnectionFragment fragment, List<string> lines)
    {
        lines.Add($"* Соединение «{fragment.Link.Description ?? string.Empty}»");
        var prefix = $"connection{fragment.Number}_";
        var source = StatementLine.ParseText(fragment.Link.GpssText);
        var labels = source.Where(line => line.Label is not null && line.Operation is not null && !OperandKinds.LabelIsEntity(line.Operation))
            .Select(line => line.Label!).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var corrector = new NameCorrector(prefix, labels, new Dictionary<string, string>(), fragment.Target.Scope.VisibleDataNames(), new Dictionary<string, string>());
        var first = true;
        foreach (var line in source)
        {
            var corrected = corrector.Correct(line);
            if (first && corrected.IsBlock)
            {
                if (corrected.Label is not null)
                {
                    lines.Add($"{fragment.EntryLabel} TRANSFER ,{corrected.Label}");
                }
                else
                {
                    corrected.Label = fragment.EntryLabel;
                }

                first = false;
            }

            lines.Add(corrected.Render());
        }

        if (first)
        {
            lines.Add($"{fragment.EntryLabel} TRANSFER ,{fragment.TargetEntry}");
        }
        else
        {
            lines.Add($"TRANSFER ,{fragment.TargetEntry}");
        }

        lines.Add(string.Empty);
        _generatedLines += 3;
    }

    /// <summary>
    /// Control statements (START, RESET, ...) written in TEB models run the simulation; GPSS Studio places
    /// them after the whole model, keeping their relative order.
    /// </summary>
    private static void MoveControlStatementsToEnd(List<string> lines)
    {
        var control = new List<string>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = StatementLine.Parse(lines[i]);
            if (line.Operation is not null && line.Label is null && ControlCommands.Contains(line.Operation))
            {
                control.Add(lines[i]);
                lines.RemoveAt(i--);
            }
        }

        if (control.Count > 0)
        {
            while (lines.Count > 0 && lines[^1].Length == 0)
            {
                lines.RemoveAt(lines.Count - 1);
            }

            lines.Add(string.Empty);
            lines.AddRange(control);
        }
    }

    /// <summary>An unlabelled "TRANSFER ,X" directly followed by the block labelled X is redundant.</summary>
    private static List<string> RemoveJumpsToNextLine(List<string> lines)
    {
        var result = new List<string>(lines.Count);
        for (var i = 0; i < lines.Count; i++)
        {
            var line = StatementLine.Parse(lines[i]);
            if (line is { Label: null, Operation: "TRANSFER", Operands: [{ Length: 0 }, var target] } && NextStatement(lines, i + 1)?.Label is { } next
                && next.Equals(target, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            result.Add(lines[i]);
        }

        return result;
    }

    private static StatementLine? NextStatement(List<string> lines, int start)
    {
        for (var i = start; i < lines.Count; i++)
        {
            var line = StatementLine.Parse(lines[i]);
            if (line.Operation is not null)
            {
                return line;
            }
        }

        return null;
    }

    /// <summary>The generated text is translated to report syntax errors with their TEB.</summary>
    private void Validate(string text)
    {
        var model = Translator.Translate(text);
        var lines = text.Split('\n');
        foreach (var error in model.Errors)
        {
            var teb = error.Line > 0 ? OwningTeb(lines, error.Line) : null;
            _messages.Add(new GenerationMessage(GenerationMessage.Error, $"Строка {error.Line} сгенерированного текста: {error.Message}", null, teb));
        }
    }

    private static string? OwningTeb(string[] lines, int lineNumber)
    {
        for (var i = Math.Min(lineNumber, lines.Length) - 1; i >= 0; i--)
        {
            if (lines[i].StartsWith("* ТЭБ «", StringComparison.Ordinal))
            {
                return lines[i]["* ТЭБ «".Length..].TrimEnd('»');
            }
        }

        return null;
    }

    private static string Format(double value) => value.ToString("0.###############", CultureInfo.InvariantCulture);

    private void Warn(FlatTeb teb, string message) => _messages.Add(new GenerationMessage(GenerationMessage.Warning, message, teb.Node.Id, teb.Node.Header));

    private void Error(FlatTeb teb, string message) => _messages.Add(new GenerationMessage(GenerationMessage.Error, message, teb.Node.Id, teb.Node.Header));

    // ----------------------------------------------------------------- model

    private sealed class Scope(Scope? parent, TebNode? composite, string prefix)
    {
        public Scope? Parent { get; } = parent;
        public TebNode? Composite { get; } = composite;
        public string Prefix { get; } = prefix;
        public string Header { get; init; } = string.Empty;
        public List<TebNode> DataTebs { get; } = [];
        public Dictionary<string, string> DataNames { get; } = new(StringComparer.OrdinalIgnoreCase);

        /// <summary>Data described on this level and all enclosing levels; inner descriptions win.</summary>
        public Dictionary<string, string> VisibleDataNames()
        {
            var chain = new List<Scope>();
            for (var scope = this; scope is not null; scope = scope.Parent)
            {
                chain.Add(scope);
            }

            var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var scope in Enumerable.Reverse(chain))
            {
                foreach (var (name, qualified) in scope.DataNames)
                {
                    result[name] = qualified;
                }
            }

            return result;
        }
    }

    private sealed class FlatTeb
    {
        public FlatTeb(TebNode node, TebScheme scheme, Scope scope, string name)
        {
            Node = node;
            Scheme = scheme;
            Scope = scope;
            Prefix = name + "_";
            Lines = StatementLine.ParseText(node.GpssText);
            LocalLabels = Lines.Where(line => line.Label is not null && line.Operation is not null && !OperandKinds.LabelIsEntity(line.Operation))
                .Select(line => line.Label!).ToHashSet(StringComparer.OrdinalIgnoreCase);
            ReferencedNames = Lines.SelectMany(line => line.Operands).SelectMany(operand => operand.Split([',', ' ', '(', ')', '$', '+', '-', '#', '/', '*'], StringSplitOptions.RemoveEmptyEntries))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            HasControlStatements = Lines.Any(line => line.Operation is not null && ControlCommands.Contains(line.Operation));
        }

        public TebNode Node { get; }
        public TebScheme Scheme { get; }
        public Scope Scope { get; }
        public string Prefix { get; }
        public List<StatementLine> Lines { get; }
        public HashSet<string> LocalLabels { get; }
        public HashSet<string> ReferencedNames { get; }
        public bool HasControlStatements { get; }
        public Dictionary<string, string> OutputLabels { get; } = new(StringComparer.OrdinalIgnoreCase);
        public List<Output> Outputs { get; } = [];
        public NameCorrector? Corrector { get; set; }
    }

    private sealed class Output(FlatTeb teb, TebPort port, int index)
    {
        public FlatTeb Teb { get; } = teb;
        public TebPort Port { get; } = port;
        public int Index { get; } = index;
        public List<OutputTarget> Targets { get; } = [];
        public List<ConnectionFragment> Fragments { get; } = [];
        public string DispatchLabel => $"{Teb.Prefix}autoGenerated_output{Index}";
        public string? LabelTarget { get; set; }
    }

    private sealed record OutputTarget(FlatTeb Teb, string Entry, double Probability);

    private sealed class ConnectionFragment(int number, TebLink link, string targetEntry, FlatTeb target)
    {
        public int Number { get; } = number;
        public TebLink Link { get; } = link;
        public string TargetEntry { get; } = targetEntry;
        public FlatTeb Target { get; } = target;
        public string EntryLabel => $"connection{Number}_autoGenerated1_firstBlock";
    }
}
