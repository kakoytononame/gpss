using System.Globalization;
using GpssStudio.Simulation.Blocks;
using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Parsing;

namespace GpssStudio.Simulation.Translation;

/// <summary>
/// Translates GPSS World model text into blocks, entity definitions and control statements.
/// </summary>
public static class Translator
{
    public static GpssModel Translate(string text)
    {
        var model = new GpssModel();
        var statements = SourceParser.Parse(text, model.Errors);

        CollectLabelsAndDefinitions(statements, model);

        foreach (var statement in statements)
        {
            try
            {
                TranslateStatement(statement, model);
            }
            catch (FormatException exception)
            {
                model.Errors.Add(new TranslationError(statement.Line, $"{statement.Operation}: {exception.Message}"));
            }
            catch (SimulationException exception)
            {
                model.Errors.Add(new TranslationError(statement.Line, $"{statement.Operation}: {exception.Message}"));
            }
        }

        if (model.Blocks.Count == 0 && model.Errors.Count == 0)
        {
            model.Errors.Add(new TranslationError(0, "Модель не содержит ни одного блока."));
        }

        model.Errors.Sort((a, b) => a.Line.CompareTo(b.Line));
        return model;
    }

    private static void CollectLabelsAndDefinitions(IReadOnlyList<SourceStatement> statements, GpssModel model)
    {
        var blockNumber = 0;
        foreach (var statement in statements)
        {
            if (Keywords.SupportedBlocks.Contains(statement.Operation) || Keywords.UnsupportedBlocks.Contains(statement.Operation))
            {
                blockNumber++;
                if (statement.Label is not null)
                {
                    if (!model.Labels.TryAdd(statement.Label, blockNumber))
                    {
                        model.Errors.Add(new TranslationError(statement.Line, $"Метка \"{statement.Label}\" определена повторно."));
                    }
                }
            }
            else if (statement.Operation == "EQU" && statement.Label is not null)
            {
                if (double.TryParse(statement.Operand(0), NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
                {
                    model.Constants[statement.Label] = value;
                }
                else
                {
                    model.Errors.Add(new TranslationError(statement.Line, $"EQU: значение \"{statement.Operand(0)}\" должно быть числом."));
                }
            }
        }
    }

    private static void RegisterName(GpssModel model, string? name)
    {
        if (!string.IsNullOrEmpty(name) && !model.Labels.ContainsKey(name) && !model.Constants.ContainsKey(name)
            && !model.EntityNames.Contains(name, StringComparer.OrdinalIgnoreCase) && !name.All(char.IsDigit))
        {
            model.EntityNames.Add(name);
        }
    }

    private static void TranslateStatement(SourceStatement statement, GpssModel model)
    {
        var op = statement.Operation;

        if (Keywords.UnsupportedBlocks.Contains(op))
        {
            throw new FormatException("блок не поддерживается веб-версией симулятора.");
        }

        if (Keywords.UnsupportedCommands.Contains(op))
        {
            throw new FormatException("команда не поддерживается веб-версией симулятора.");
        }

        if (Keywords.SupportedBlocks.Contains(op))
        {
            var block = CreateBlock(statement, model);
            block.Number = model.Blocks.Count + 1;
            model.Blocks.Add(block);
            return;
        }

        switch (op)
        {
            case "EQU":
            case "SIMULATE":
            case "END":
                return;
            case "STORAGE":
            {
                var name = RequireLabel(statement);
                var capacity = RequireConstant(statement, 0, model, "ёмкость");
                RegisterName(model, name);
                model.Storages[name] = new StorageDefinition(name, (int)capacity);
                return;
            }
            case "TABLE":
            case "QTABLE":
            {
                var name = RequireLabel(statement);
                RegisterName(model, name);
                var argument = op == "QTABLE" ? new SnaExpr("QT", statement.Operand(0)) : Parse(statement, 0, "аргумент");
                model.Tables[name] = new TableDefinition(
                    name,
                    argument,
                    RequireConstant(statement, 1, model, "верхняя граница первого интервала"),
                    RequireConstant(statement, 2, model, "ширина интервала"),
                    (int)RequireConstant(statement, 3, model, "число интервалов"));
                return;
            }
            case "VARIABLE":
            case "FVARIABLE":
            case "BVARIABLE":
            {
                var name = RequireLabel(statement);
                RegisterName(model, name);
                var kind = op switch { "BVARIABLE" => VariableKind.Boolean, "FVARIABLE" => VariableKind.Floating, _ => VariableKind.Arithmetic };
                model.Variables[name] = new VariableDefinition(name, ExpressionParser.Parse(string.Join(",", statement.Operands)), kind);
                return;
            }
            case "FUNCTION":
                model.Functions[RequireLabel(statement)] = TranslateFunction(statement, model);
                RegisterName(model, statement.Label);
                return;
            case "MATRIX":
            {
                var name = RequireLabel(statement);
                RegisterName(model, name);
                var rows = (int)RequireConstant(statement, 1, model, "число строк");
                var columns = (int)RequireConstant(statement, 2, model, "число столбцов");
                if (rows < 1 || columns < 1)
                {
                    throw new FormatException("размеры матрицы должны быть положительными.");
                }

                // Dimensions above the second are fixed at index 1 for MX$ and MSAVEVALUE (as in GPSS World).
                model.Matrices[name] = new MatrixDefinition(name, rows, columns);
                return;
            }
        }

        if (Keywords.Commands.Contains(op))
        {
            model.ControlStatements.Add(TranslateControl(statement, model));
        }
    }

    public static ControlStatement TranslateControl(SourceStatement statement, GpssModel model)
    {
        var kind = statement.Operation switch
        {
            "INITIAL" => ControlKind.Initial,
            "START" => ControlKind.Start,
            "RESET" => ControlKind.Reset,
            "CLEAR" => ControlKind.Clear,
            "SHOW" => ControlKind.Show,
            "RMULT" => ControlKind.Rmult,
            "STEP" => ControlKind.Step,
            "HALT" => ControlKind.Halt,
            "CONTINUE" => ControlKind.Continue,
            _ => throw new FormatException("неизвестная команда."),
        };

        switch (kind)
        {
            case ControlKind.Initial:
                if (!statement.HasOperand(0))
                {
                    throw new FormatException("не указан объект.");
                }

                RegisterName(model, statement.Operand(0).Split('$').Last());
                break;
            case ControlKind.Start:
                if (!statement.HasOperand(0))
                {
                    throw new FormatException("не указано значение счётчика завершений.");
                }

                ExpressionParser.Parse(statement.Operand(0));
                break;
            case ControlKind.Show:
                if (!statement.HasOperand(0))
                {
                    throw new FormatException("не указано выражение.");
                }

                ExpressionParser.Parse(string.Join(",", statement.Operands));
                break;
        }

        return new ControlStatement(statement.Line, kind, statement.Operands);
    }

    private static FunctionDefinition TranslateFunction(SourceStatement statement, GpssModel model)
    {
        var argumentText = statement.Operand(0);
        var typeText = statement.Operand(1).ToUpperInvariant();
        if (typeText.Length < 2 || !"DCLE".Contains(typeText[0]) || !int.TryParse(typeText[1..], out var count) || count < 1)
        {
            throw new FormatException("тип функции должен иметь вид Dn, Cn, Ln или En.");
        }

        var argument = ExpressionParser.Parse(argumentText);
        int? randomStream = argument is SnaExpr { Family: "RN" } rn && int.TryParse(rn.Argument, out var stream) ? stream : null;

        var data = string.Concat(statement.FollowerLines).Split('/', StringSplitOptions.RemoveEmptyEntries);
        var points = new List<(Expr X, Expr Y)>();
        var listIndex = 0;
        foreach (var pair in data)
        {
            var parts = SourceParser.SplitOperands(pair);
            if (typeText[0] == 'L')
            {
                // L functions list only Y values: "y1/y2/..." or "x,y" pairs.
                foreach (var part in parts.Where(part => part.Length > 0))
                {
                    points.Add((new NumberExpr(++listIndex), ParseFunctionValue(part, model)));
                }

                continue;
            }

            if (parts.Count != 2 || parts[0].Length == 0 || parts[1].Length == 0)
            {
                throw new FormatException($"неверная точка функции \"{pair}\".");
            }

            Expr x;
            try
            {
                x = ExpressionParser.Parse(parts[0]);
            }
            catch (FormatException)
            {
                throw new FormatException($"неверная точка функции \"{pair}\".");
            }

            points.Add((x, ParseFunctionValue(parts[1], model)));
        }

        // GPSS World reads exactly the declared number of points; extra points are ignored.
        if (points.Count < count)
        {
            throw new FormatException($"ожидалось {count} точек, задано {points.Count}.");
        }

        points = points.Take(count).ToList();
        var constants = points.Select(point => point.X.AsConstant()).ToList();
        if (typeText[0] is 'C' or 'D' && constants.Zip(constants.Skip(1)).Any(pair => pair.First > pair.Second))
        {
            throw new FormatException("значения аргумента функции должны возрастать.");
        }

        return new FunctionDefinition
        {
            Name = statement.Label!,
            Argument = argument,
            Type = typeText[0],
            Points = points,
            RandomStream = randomStream,
        };
    }

    private static Expr ParseFunctionValue(string text, GpssModel model) =>
        model.Labels.TryGetValue(text, out var block) ? new NumberExpr(block) : ExpressionParser.Parse(text);

    private static Block CreateBlock(SourceStatement s, GpssModel model)
    {
        var operandText = string.Join(",", s.Operands).TrimEnd(',');
        var common = (label: s.Label, line: s.Line, text: s.Auxiliary is null ? operandText : $"{s.Auxiliary} {operandText}");

        EntityRef Entity(int index)
        {
            var reference = EntityRef.Parse(Require(s, index, "имя объекта"));
            RegisterName(model, reference.LiteralName);
            return reference;
        }

        BlockRef? OptionalBlock(int index) => s.HasOperand(index) ? BlockRef.Parse(s.Operand(index), model.Labels) : null;
        Expr? Optional(int index) => s.HasOperand(index) ? ExpressionParser.Parse(s.Operand(index)) : null;

        switch (s.Operation)
        {
            case "GENERATE":
                if (!s.HasOperand(0) && !s.HasOperand(3) && !s.HasOperand(2))
                {
                    throw new FormatException("необходимо задать интервал (A), смещение (C) или ограничение (D).");
                }

                return new GenerateBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Interval = Optional(0), Spread = Optional(1), Offset = Optional(2), Limit = Optional(3), Priority = Optional(4),
                };
            case "TERMINATE":
                return new TerminateBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Count = Optional(0) };
            case "ADVANCE":
                return new AdvanceBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Time = Optional(0), Spread = Optional(1) };
            case "SEIZE":
                return new SeizeBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0) };
            case "RELEASE":
                return new ReleaseBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0) };
            case "PREEMPT":
                return new PreemptBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0),
                    PriorityMode = s.Operand(1).Equals("PR", StringComparison.OrdinalIgnoreCase),
                };
            case "RETURN":
                return new ReturnBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0) };
            case "FAVAIL":
            case "FUNAVAIL":
                return new FacilityAvailabilityBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), MakeAvailable = s.Operation == "FAVAIL",
                };
            case "QUEUE":
                return new QueueBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), Units = Optional(1) };
            case "DEPART":
                return new DepartBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), Units = Optional(1) };
            case "ENTER":
                return new EnterBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), Units = Optional(1) };
            case "LEAVE":
                return new LeaveBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), Units = Optional(1) };
            case "SAVAIL":
            case "SUNAVAIL":
                return new StorageAvailabilityBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), MakeAvailable = s.Operation == "SAVAIL",
                };
            case "TRANSFER":
                return CreateTransfer(s, model, common.label, common.text);
            case "TEST":
                if (s.Auxiliary is null)
                {
                    throw new FormatException("не задан оператор отношения (L, LE, E, NE, G, GE).");
                }

                return new TestBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Relation = s.Auxiliary, Left = ExpressionParser.Parse(Require(s, 0, "A")), Right = ExpressionParser.Parse(Require(s, 1, "B")), Alternate = OptionalBlock(2),
                };
            case "GATE":
                if (s.Auxiliary is null)
                {
                    throw new FormatException("не задано условие (U, NU, SE, SNE, SF, SNF, LS, LR ...).");
                }

                return new GateBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Condition = s.Auxiliary, Entity = Entity(0), Alternate = OptionalBlock(1),
                };
            case "LOGIC":
                if (s.Auxiliary is null)
                {
                    throw new FormatException("не задан режим (S, R или I).");
                }

                return new LogicBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Mode = s.Auxiliary, Entity = Entity(0) };
            case "SAVEVALUE":
            {
                var (name, mode) = SplitModeSuffix(Require(s, 0, "имя ячейки"));
                var reference = EntityRef.Parse(name);
                RegisterName(model, reference.LiteralName);
                return new SavevalueBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Entity = reference, Mode = mode, Value = ExpressionParser.Parse(Require(s, 1, "значение")),
                };
            }
            case "ASSIGN":
            {
                var (name, mode) = SplitModeSuffix(Require(s, 0, "параметр"));
                return new AssignBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Parameter = ParameterRef.Parse(name), Mode = mode, Value = ExpressionParser.Parse(Require(s, 1, "значение")),
                };
            }
            case "MARK":
                return new MarkBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Parameter = s.HasOperand(0) ? ParameterRef.Parse(s.Operand(0)) : null,
                };
            case "PRIORITY":
                return new PriorityBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Value = ExpressionParser.Parse(Require(s, 0, "приоритет")), Buffer = s.Operand(1).Equals("BU", StringComparison.OrdinalIgnoreCase),
                };
            case "SPLIT":
                return new SplitBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Count = ExpressionParser.Parse(Require(s, 0, "число копий")),
                    Destination = OptionalBlock(1),
                    SerialParameter = s.HasOperand(2) ? ParameterRef.Parse(s.Operand(2)) : null,
                };
            case "ASSEMBLE":
                return new AssembleBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Count = ExpressionParser.Parse(Require(s, 0, "число")) };
            case "GATHER":
                return new GatherBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Count = ExpressionParser.Parse(Require(s, 0, "число")) };
            case "LOOP":
                return new LoopBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Parameter = ParameterRef.Parse(Require(s, 0, "параметр")), Destination = BlockRef.Parse(Require(s, 1, "метка"), model.Labels),
                };
            case "BUFFER":
                return new BufferBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text };
            case "TABULATE":
                return new TabulateBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), Weight = Optional(1) };
            case "LINK":
            {
                var order = Require(s, 1, "порядок (FIFO, LIFO или параметр)");
                return new LinkBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Entity = Entity(0), Order = order.ToUpperInvariant() is "FIFO" or "LIFO" ? order.ToUpperInvariant() : order, Alternate = OptionalBlock(2),
                };
            }
            case "UNLINK":
            {
                var countText = s.Operand(2);
                return new UnlinkBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Entity = Entity(0), Destination = BlockRef.Parse(Require(s, 1, "метка назначения"), model.Labels),
                    Count = countText.Length == 0 || countText.Equals("ALL", StringComparison.OrdinalIgnoreCase) ? null : ExpressionParser.Parse(countText),
                    Alternate = OptionalBlock(5),
                };
            }
            case "ADOPT":
                return new AdoptBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, AssemblySet = ExpressionParser.Parse(Require(s, 0, "номер семейства")) };
            case "MSAVEVALUE":
            {
                var (name, mode) = SplitModeSuffix(Require(s, 0, "матрица"));
                var reference = EntityRef.Parse(name);
                RegisterName(model, reference.LiteralName);
                return new MsavevalueBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = reference, Mode = mode,
                    Row = Parse(s, 1, "строка"), Column = Parse(s, 2, "столбец"), Value = Parse(s, 3, "значение"),
                };
            }
            case "COUNT":
            case "SELECT":
            {
                var condition = s.Auxiliary ?? throw new FormatException("не задан условный или логический оператор.");
                var parameter = ParameterRef.Parse(Require(s, 0, "параметр"));
                var snaClass = s.HasOperand(4) ? s.Operand(4).ToUpperInvariant() : null;
                if (!ConditionOperators.Logical.Contains(condition) && snaClass is null)
                {
                    throw new FormatException("в условном режиме требуется класс СЧА (операнд E).");
                }

                if (s.Operation == "COUNT")
                {
                    return new CountBlock
                    {
                        Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Condition = condition, Parameter = parameter,
                        From = Parse(s, 1, "нижняя граница"), To = Parse(s, 2, "верхняя граница"), Reference = Optional(3), SnaClass = snaClass,
                    };
                }

                return new SelectBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Condition = condition, Parameter = parameter,
                    From = Parse(s, 1, "нижняя граница"), To = Parse(s, 2, "верхняя граница"), Reference = Optional(3), SnaClass = snaClass, Alternate = OptionalBlock(5),
                };
            }
            case "DISPLACE":
                return new DisplaceBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Target = Parse(s, 0, "номер транзакта"), Destination = BlockRef.Parse(Require(s, 1, "блок назначения"), model.Labels),
                    ResidualParameter = s.HasOperand(2) ? ParameterRef.Parse(s.Operand(2)) : null, Alternate = OptionalBlock(3),
                };
            case "JOIN":
                return new JoinBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), Value = Optional(1) };
            case "EXAMINE":
                return new ExamineBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), Value = Optional(1),
                    Alternate = BlockRef.Parse(Require(s, 2, "альтернативный блок"), model.Labels),
                };
            case "REMOVE":
                return new RemoveBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), Condition = s.Auxiliary,
                    Limit = s.Operand(1).Equals("ALL", StringComparison.OrdinalIgnoreCase) ? null : Optional(1), Value = Optional(2),
                    Tested = s.HasOperand(3) ? MemberAttribute.Parse(s.Operand(3)) : null, Reference = Optional(4), Alternate = OptionalBlock(5),
                };
            case "SCAN":
                return new ScanBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), Condition = s.Auxiliary,
                    Tested = s.HasOperand(1) ? MemberAttribute.Parse(s.Operand(1)) : null, Reference = Optional(2),
                    Source = MemberAttribute.Parse(Require(s, 3, "атрибут члена группы")), Target = ParameterRef.Parse(Require(s, 4, "параметр")), Alternate = OptionalBlock(5),
                };
            case "ALTER":
                return new AlterBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Entity = Entity(0), Condition = s.Auxiliary,
                    Limit = s.Operand(1).Equals("ALL", StringComparison.OrdinalIgnoreCase) ? null : Optional(1),
                    Changed = MemberAttribute.Parse(Require(s, 2, "изменяемый атрибут")), Value = Parse(s, 3, "значение"),
                    Tested = s.HasOperand(4) ? MemberAttribute.Parse(s.Operand(4)) : null, Reference = Optional(5), Alternate = OptionalBlock(6),
                };
            case "MATCH":
                return new MatchBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Conjugate = BlockRef.Parse(Require(s, 0, "сопряжённый блок MATCH"), model.Labels),
                };
            case "PLUS":
                return new PlusBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Expression = Parse(s, 0, "выражение"), Parameter = s.HasOperand(1) ? ParameterRef.Parse(s.Operand(1)) : null,
                };
            case "EXECUTE":
                return new ExecuteBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Target = BlockRef.Parse(Require(s, 0, "блок"), model.Labels),
                };
            case "TRACE":
            case "UNTRACE":
                return new TraceBlock { Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text, Enable = s.Operation == "TRACE" };
            case "OPEN":
                return new OpenBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    FileName = Parse(s, 0, "имя файла"), Stream = Optional(1), Alternate = OptionalBlock(2),
                };
            case "READ":
                return new ReadBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Parameter = ParameterRef.Parse(Require(s, 0, "параметр")), Stream = Optional(1), Alternate = OptionalBlock(2),
                };
            case "WRITE":
                return new WriteBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Value = Parse(s, 0, "значение"), Stream = Optional(1), Alternate = OptionalBlock(2),
                    Replace = s.Operand(3).Equals("OFF", StringComparison.OrdinalIgnoreCase),
                };
            case "SEEK":
                return new SeekBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    TargetLine = Parse(s, 0, "номер строки"), Stream = Optional(1),
                };
            case "CLOSE":
                return new CloseBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    ErrorParameter = s.HasOperand(0) ? ParameterRef.Parse(s.Operand(0)) : null, Stream = Optional(1), Alternate = OptionalBlock(2),
                };
            case "INDEX":
                return new IndexBlock
                {
                    Operation = s.Operation, Label = common.label, Line = common.line, OperandText = common.text,
                    Parameter = ParameterRef.Parse(Require(s, 0, "параметр")), Value = ExpressionParser.Parse(Require(s, 1, "значение")),
                };
            default:
                throw new FormatException("блок не поддерживается.");
        }
    }

    private static TransferBlock CreateTransfer(SourceStatement s, GpssModel model, string? label, string text)
    {
        var a = s.Operand(0);
        BlockRef? Ref(int index) => s.HasOperand(index) ? BlockRef.Parse(s.Operand(index), model.Labels) : null;

        TransferBlock Make(TransferMode mode, Expr? fraction = null, BlockRef? first = null, BlockRef? second = null, Expr? step = null, ParameterRef? parameter = null) => new()
        {
            Operation = s.Operation, Label = label, Line = s.Line, OperandText = text,
            Mode = mode, Fraction = fraction, First = first, Second = second, Step = step, Parameter = parameter,
        };

        switch (a.ToUpperInvariant())
        {
            case "":
                if (!s.HasOperand(1))
                {
                    throw new FormatException("не задана метка перехода (B).");
                }

                return Make(TransferMode.Unconditional, second: Ref(1));
            case "BOTH":
                return Make(TransferMode.Both, first: Ref(1), second: Ref(2));
            case "ALL":
                return Make(TransferMode.All, first: Ref(1), second: Ref(2), step: s.HasOperand(3) ? ExpressionParser.Parse(s.Operand(3)) : null);
            case "PICK":
                return Make(TransferMode.Pick, first: Ref(1), second: Ref(2));
            case "SBR":
                return Make(TransferMode.Subroutine, first: Ref(1), parameter: ParameterRef.Parse(Require(s, 2, "параметр возврата")));
            case "P":
                return Make(TransferMode.Parameter, parameter: ParameterRef.Parse(Require(s, 1, "параметр")), step: s.HasOperand(2) ? ExpressionParser.Parse(s.Operand(2)) : null);
            default:
                // Fraction: .XXX or parts per thousand, with probability A go to C, otherwise to B.
                return Make(TransferMode.Fraction, fraction: ExpressionParser.Parse(a), first: Ref(1), second: Ref(2));
        }
    }

    private static (string Name, char Mode) SplitModeSuffix(string operand) =>
        operand.EndsWith('+') ? (operand[..^1], '+') : operand.EndsWith('-') ? (operand[..^1], '-') : (operand, '\0');

    private static string RequireLabel(SourceStatement statement) =>
        statement.Label ?? throw new FormatException("требуется имя в поле метки.");

    private static string Require(SourceStatement statement, int index, string description) =>
        statement.HasOperand(index) ? statement.Operand(index) : throw new FormatException($"не задан операнд {(char)('A' + index)} ({description}).");

    private static double RequireConstant(SourceStatement statement, int index, GpssModel model, string description)
    {
        var text = Require(statement, index, description);
        if (double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
        {
            return value;
        }

        return model.Constants.TryGetValue(text, out value) ? value : throw new FormatException($"операнд {(char)('A' + index)} ({description}) должен быть числом.");
    }

    private static Expr Parse(SourceStatement statement, int index, string description) => ExpressionParser.Parse(Require(statement, index, description));
}
