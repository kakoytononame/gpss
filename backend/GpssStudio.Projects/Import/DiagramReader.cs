using System.Globalization;
using GpssStudio.Projects.Formats;
using GpssStudio.Projects.Model;

namespace GpssStudio.Projects.Import;

/// <summary>
/// Reads a structural scheme (<c>Diagram.gsdiagram</c>) or a library class from the GPSS Studio
/// DataContract XML into the project model.
/// </summary>
public sealed class DiagramReader
{
    private readonly IReadOnlyDictionary<string, TebNode> _libraryClasses;
    private readonly List<string> _notes;

    /// <param name="libraryClasses">Library class templates by class id, used by instances of library TEBs.</param>
    /// <param name="notes">Receives import notes.</param>
    public DiagramReader(IReadOnlyDictionary<string, TebNode> libraryClasses, List<string> notes)
    {
        _libraryClasses = libraryClasses;
        _notes = notes;
    }

    /// <summary>Reads the root scheme of a diagram document.</summary>
    public TebScheme ReadDiagram(DataContractDocument document)
    {
        var childScheme = document.Root.Child("ChildScheme");
        return childScheme is { } scheme ? ReadScheme(scheme) : new TebScheme();
    }

    /// <summary>Reads a TEB class stored in a library as a template node.</summary>
    public TebNode ReadClass(DcNode tebClass)
    {
        var node = new TebNode();
        ApplyClass(node, tebClass);
        node.Id = node.ClassId;
        return node;
    }

    private TebScheme ReadScheme(DcNode scheme)
    {
        var result = new TebScheme();
        foreach (var instance in scheme.Child("Instances")?.Items() ?? [])
        {
            result.Nodes.Add(ReadInstance(instance));
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var connection in scheme.Child("Connections")?.Items() ?? [])
        {
            if (connection.ObjectId is { } id && !seen.Add(id))
            {
                continue;
            }

            if (ReadLink(connection) is { } link)
            {
                result.Links.Add(link);
            }
        }

        foreach (var connector in scheme.Child("StandaloneConnectors")?.Items() ?? [])
        {
            result.Boundary.Add(new BoundaryConnector
            {
                Id = BoundaryId(connector),
                Direction = connector.TypeName.Contains("Output", StringComparison.OrdinalIgnoreCase) ? "output" : "input",
                DefinitionId = connector.Integer("DefinitionId", connector.Integer("Id")),
            });
        }

        foreach (var decor in scheme.Child("Decors")?.Items() ?? [])
        {
            result.Decors.Add(new SchemeDecor
            {
                Kind = decor.TypeName.Contains("Image", StringComparison.OrdinalIgnoreCase) ? "image" : "text",
                X = decor.Number("X"),
                Y = decor.Number("Y"),
                Width = decor.Number("Width"),
                Height = decor.Number("Height"),
                Text = decor.Text("Text"),
            });
        }

        return result;
    }

    private TebNode ReadInstance(DcNode instance)
    {
        var node = new TebNode
        {
            Id = instance.Text("InstanceId") ?? instance.ObjectId ?? Guid.NewGuid().ToString(),
            NameInModel = NullIfEmpty(instance.Text("NameInModel", "NameInModel")),
            InstancesCount = Math.Max(1, instance.Integer("InstancesCount", 1)),
            X = instance.Number("X"),
            Y = instance.Number("Y"),
            Width = instance.Number("Width", 160),
            Height = instance.Number("Height", 60),
            BackgroundColor = Color(instance.Child("BackgroundBrush")),
            BorderColor = Color(instance.Child("BorderBrush")),
            TextColor = Color(instance.Child("TextBrush")),
            Description = instance.Text("Description"),
        };

        if (instance.Child("AnonymousClass") is { } anonymousClass)
        {
            ApplyClass(node, anonymousClass);
        }
        else
        {
            var classId = instance.Text("ClassId", "ClassGuid") ?? string.Empty;
            node.ClassId = classId;
            node.LibraryId = instance.Text("ClassId", "LibraryId", "Guid");
            if (_libraryClasses.TryGetValue(classId, out var template))
            {
                CopyClass(template, node);
            }
            else
            {
                _notes.Add($"Класс ТЭБ {classId} не найден в библиотеках проекта; экземпляр импортирован без модели.");
            }
        }

        if (string.IsNullOrEmpty(node.Header))
        {
            node.Header = instance.Text("Text") ?? node.NameInModel ?? "ТЭБ";
        }

        ApplyConnectorInstances(node.Inputs, instance.Child("Inputs"));
        ApplyConnectorInstances(node.Outputs, instance.Child("Outputs"));
        ApplyParameterValues(node, instance.Child("ParameterValues"));
        return node;
    }

    private void ApplyClass(TebNode node, DcNode tebClass)
    {
        node.Kind = tebClass.TypeName switch
        {
            "CompositeTebClass" => TebKinds.Composite,
            "GlobalDataTebClass" => TebKinds.Data,
            var type when type.Contains("Transaction", StringComparison.Ordinal) => TebKinds.Transaction,
            _ => TebKinds.Simple,
        };
        node.Header = tebClass.Text("Header") ?? string.Empty;
        node.Description ??= tebClass.Text("Description");
        node.ClassId = tebClass.Text("Id", "ClassGuid") ?? node.ClassId;
        node.LibraryId = tebClass.Text("Id", "LibraryId", "Guid");
        node.NameInModel ??= NullIfEmpty(tebClass.Text("NameInModel", "NameInModel"));
        node.GpssText = tebClass.Text("GpssModel", "Text");

        foreach (var entity in tebClass.Child("GpssEntities")?.Items() ?? [])
        {
            if (ReadEntity(entity) is { } dataEntity)
            {
                node.Entities.Add(dataEntity);
            }
        }

        node.Inputs = (tebClass.Child("Inputs")?.Items() ?? []).Select(ReadPortDefinition).ToList();
        node.Outputs = (tebClass.Child("Outputs")?.Items() ?? []).Select(ReadPortDefinition).ToList();
        node.Parameters = (tebClass.Child("Parameters")?.Items() ?? []).Select(ReadParameter).ToList();
        node.States = (tebClass.Child("States")?.Items() ?? []).Select(state => new TebStateDefinition
        {
            Name = state.Text("Name") ?? state.Text("Header") ?? string.Empty,
            Expression = state.Text("Expression") ?? state.Text("Value") ?? string.Empty,
            Description = state.Text("Description"),
        }).ToList();

        if (node.Kind == TebKinds.Composite && tebClass.Child("ChildScheme") is { } child)
        {
            node.Child = ReadScheme(child);
        }
    }

    private static void CopyClass(TebNode template, TebNode node)
    {
        node.Kind = template.Kind;
        node.Header = template.Header;
        node.Description ??= template.Description;
        node.GpssText = template.GpssText;
        node.Entities = template.Entities.Select(entity => entity).ToList();
        node.Inputs = template.Inputs.Select(ClonePort).ToList();
        node.Outputs = template.Outputs.Select(ClonePort).ToList();
        node.Parameters = template.Parameters.Select(parameter => new TebParameter
        {
            Id = parameter.Id, Type = parameter.Type, NameInModel = parameter.NameInModel, Header = parameter.Header, DefaultValue = parameter.DefaultValue,
        }).ToList();
        node.States = template.States.ToList();
        node.Child = template.Child;
    }

    private static TebPort ClonePort(TebPort port) => new()
    {
        Id = port.Id, Mode = port.Mode, Label = port.Label, ConnectionsLimit = port.ConnectionsLimit, Description = port.Description,
        TransferMode = port.TransferMode, GpssText = port.GpssText, Side = port.Side, Position = port.Position,
    };

    private static TebPort ReadPortDefinition(DcNode definition) => new()
    {
        Id = definition.Integer("Id"),
        Mode = definition.Text("ConnectedBlock", "Mode") ?? ConnectedBlockModes.NotSet,
        Label = NullIfEmpty(definition.Text("ConnectedBlock", "Label")),
        ConnectionsLimit = definition.Integer("ConnectionsLimit"),
        Description = definition.Text("Description"),
        Side = definition.Integer("InitialSide"),
        Position = definition.Number("InitialPosition", 0.5),
    };

    /// <summary>Instance-level connector data: transfer mode, output model, position.</summary>
    private static void ApplyConnectorInstances(List<TebPort> ports, DcNode? connectors)
    {
        foreach (var connector in connectors?.Items() ?? [])
        {
            var id = connector.Integer("DefinitionId");
            var port = ports.FirstOrDefault(item => item.Id == id);
            if (port is null)
            {
                port = new TebPort { Id = id };
                ports.Add(port);
            }

            port.Side = connector.Integer("Side", port.Side);
            port.Position = connector.Number("Position", port.Position);
            port.TransferMode = NormalizeTransferMode(connector.Text("TransactionTransferMode")) ?? port.TransferMode;
            port.GpssText = connector.Text("GpssModel", "Text") ?? port.GpssText;
        }
    }

    public static string? NormalizeTransferMode(string? mode) => mode switch
    {
        null or "" => null,
        _ when mode.Contains("First", StringComparison.OrdinalIgnoreCase) => TransferModes.FirstAvailable,
        _ when mode.Contains("Random", StringComparison.OrdinalIgnoreCase) => TransferModes.Random,
        _ when mode.Contains("Model", StringComparison.OrdinalIgnoreCase) => TransferModes.CustomModel,
        _ => TransferModes.DirectOrSplit,
    };

    private TebLink? ReadLink(DcNode connection)
    {
        var source = connection.Child("Source");
        var destination = connection.Child("Destination");
        if (source is null || destination is null)
        {
            _notes.Add("Связь без начала или конца пропущена.");
            return null;
        }

        return new TebLink
        {
            Id = connection.Text("SchemeChildId") ?? connection.ObjectId ?? Guid.NewGuid().ToString(),
            FromNodeId = EndpointNodeId(source.Value),
            FromPortId = source.Value.Integer("DefinitionId"),
            ToNodeId = EndpointNodeId(destination.Value),
            ToPortId = destination.Value.Integer("DefinitionId"),
            Priority = connection.Integer("Priority"),
            Probability = connection.Number("Probability"),
            OrderIndex = connection.Integer("OrderIndex"),
            Description = connection.Text("Description"),
            GpssText = NullIfEmpty(connection.Text("GpssModel", "Text")),
            Points = (connection.Child("Points")?.Children() ?? []).Select(point => new SchemePoint(point.Number("_x"), point.Number("_y"))).ToList(),
        };
    }

    /// <summary>Connector endpoints belong to a TEB instance or, inside composite TEBs, to a boundary connector.</summary>
    private static string EndpointNodeId(DcNode connector)
    {
        var container = connector.Child("Container");
        if (container is { } owner && owner.Text("InstanceId") is { } instanceId)
        {
            return instanceId;
        }

        return BoundaryId(container ?? connector);
    }

    private static string BoundaryId(DcNode connector) => "boundary:" + (connector.ObjectId ?? connector.Text("Id") ?? "0");

    private DataEntity? ReadEntity(DcNode entity)
    {
        var instance = entity.Child("GpssInstance") ?? entity;
        var type = instance.TypeName;
        var result = new DataEntity
        {
            Type = type switch
            {
                "Equ" => DataEntityTypes.Equ,
                "BVariable" => DataEntityTypes.BVariable,
                "FVariable" => DataEntityTypes.FVariable,
                _ => type,
            },
            Name = instance.Text("_name") ?? instance.Text("Name") ?? string.Empty,
            Value = instance.Text("_value") ?? instance.Text("_capacityString") ?? instance.Text("Value") ?? instance.Text("_expression"),
            Description = instance.Text("_description") ?? instance.Text("Description"),
        };

        if (result.Name.Length == 0)
        {
            _notes.Add($"Объект GPSS типа {type} без имени пропущен.");
            return null;
        }

        if (type == "Matrix" && instance.Text("Values") is { } values)
        {
            try
            {
                result.Cells = BinaryStringMatrix.Decode(Convert.FromBase64String(values.Trim())).Select(row => row.ToList()).ToList();
            }
            catch (FormatException exception)
            {
                _notes.Add($"Матрица {result.Name}: {exception.Message}");
            }
        }

        if (type == "Function")
        {
            result.Value = instance.Text("_argument") ?? instance.Text("Argument") ?? result.Value;
            result.FunctionType = instance.Text("_type") ?? instance.Text("_functionType") ?? instance.Text("Type");
            result.Points = instance.Element.Descendants()
                .Where(element => element.Name.LocalName is "_points" or "Points")
                .SelectMany(element => element.Elements())
                .Select(point => string.Join(",", point.Elements().Select(item => item.Value)))
                .Where(point => point.Length > 0)
                .ToList();
        }

        return result;
    }

    private static TebParameter ReadParameter(DcNode parameter) => new()
    {
        Id = parameter.Integer("Id"),
        Type = parameter.Text("Type") ?? parameter.TypeName,
        NameInModel = parameter.Text("NameInModel", "NameInModel") ?? parameter.Text("NameInModel") ?? parameter.Text("Name") ?? string.Empty,
        Header = parameter.Text("Header"),
        DefaultValue = parameter.Text("DefaultValue") ?? parameter.Text("InitialValue"),
    };

    /// <summary>Instance parameter values are a serialized dictionary: entries with Key / Value children.</summary>
    private static void ApplyParameterValues(TebNode node, DcNode? values)
    {
        if (values is null)
        {
            return;
        }

        foreach (var entry in values.Value.Element.Descendants().Where(element => element.Elements().Any(child => child.Name.LocalName == "Key")))
        {
            var key = entry.Elements().First(child => child.Name.LocalName == "Key").Value;
            var value = entry.Elements().FirstOrDefault(child => child.Name.LocalName == "Value")?.Value;
            if (int.TryParse(key, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) && node.Parameters.FirstOrDefault(parameter => parameter.Id == id) is { } parameter)
            {
                parameter.Value = value;
            }
        }
    }

    private static string? Color(DcNode? brush)
    {
        if (brush is not { } value || value.Text("R") is null)
        {
            return null;
        }

        return $"#{value.Integer("R"):X2}{value.Integer("G"):X2}{value.Integer("B"):X2}";
    }

    private static string? NullIfEmpty(string? text) => string.IsNullOrWhiteSpace(text) ? null : text;
}
