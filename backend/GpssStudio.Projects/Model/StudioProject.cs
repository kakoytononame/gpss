namespace GpssStudio.Projects.Model;

/// <summary>A simulation project: models with their structural schemes and the TEB libraries they use.</summary>
public sealed class StudioProject
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
    public List<StudioModel> Models { get; set; } = [];
    public List<TebLibrary> Libraries { get; set; } = [];

    /// <summary>Notes produced while importing (unsupported parts, missing files).</summary>
    public List<string> ImportNotes { get; set; } = [];
}

public sealed class StudioModel
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsCurrent { get; set; }

    /// <summary>Structural scheme (root level); null for text-only models.</summary>
    public TebScheme? Scheme { get; set; }

    /// <summary>Model text saved with the project (ModelText.gps), if any.</summary>
    public string? ModelText { get; set; }

    /// <summary>Names of user forms (input / dynamics / animation) stored with the model.</summary>
    public List<string> Forms { get; set; } = [];

    /// <summary>Contents of the forms that were found in the project (<c>Forms/&lt;name&gt;/Form.fog</c>).</summary>
    public List<StudioForm> UserForms { get; set; } = [];
}

/// <summary>One level of a structural scheme: TEB nodes, connections between their ports and decorations.</summary>
public sealed class TebScheme
{
    public List<TebNode> Nodes { get; set; } = [];
    public List<TebLink> Links { get; set; } = [];
    public List<SchemeDecor> Decors { get; set; } = [];

    /// <summary>Inputs / outputs of the enclosing composite TEB as seen from inside.</summary>
    public List<BoundaryConnector> Boundary { get; set; } = [];
}

public static class TebKinds
{
    /// <summary>Elementary TEB with a GPSS model.</summary>
    public const string Simple = "simple";

    /// <summary>Composite TEB with a child scheme.</summary>
    public const string Composite = "composite";

    /// <summary>TEB with data (GPSS entity definitions).</summary>
    public const string Data = "data";

    /// <summary>"Transaction" TEB: documentation only, not generated.</summary>
    public const string Transaction = "transaction";
}

public sealed class TebNode
{
    /// <summary>Instance identifier (unique within the project).</summary>
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Kind { get; set; } = TebKinds.Simple;
    public string Header { get; set; } = string.Empty;

    /// <summary>Name used for name correction in the generated model, e.g. <c>teb4</c>.</summary>
    public string? NameInModel { get; set; }
    public string? Description { get; set; }
    public string ClassId { get; set; } = Guid.NewGuid().ToString();

    /// <summary>Set when the class comes from a TEB library.</summary>
    public string? LibraryId { get; set; }
    public int InstancesCount { get; set; } = 1;
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; } = 160;
    public double Height { get; set; } = 60;
    public string? BackgroundColor { get; set; }
    public string? BorderColor { get; set; }
    public string? TextColor { get; set; }

    /// <summary>GPSS model of an elementary TEB.</summary>
    public string? GpssText { get; set; }

    /// <summary>GPSS entities described in the TEB (data TEBs and "GPSS objects" tab).</summary>
    public List<DataEntity> Entities { get; set; } = [];
    public List<TebPort> Inputs { get; set; } = [];
    public List<TebPort> Outputs { get; set; } = [];
    public List<TebParameter> Parameters { get; set; } = [];
    public List<TebStateDefinition> States { get; set; } = [];

    /// <summary>Child scheme of a composite TEB.</summary>
    public TebScheme? Child { get; set; }
}

public static class ConnectedBlockModes
{
    public const string FirstBlock = "FirstBlock";
    public const string LastBlock = "LastBlock";
    public const string Label = "Label";
    public const string NotSet = "NotSet";
}

public static class TransferModes
{
    /// <summary>Direct transition, extra connections receive copies (SPLIT).</summary>
    public const string DirectOrSplit = "DirectOrSplit";

    /// <summary>First connection whose target can be entered (TRANSFER ALL).</summary>
    public const string FirstAvailable = "FirstAvail";

    /// <summary>Uniformly random connection (statistical TRANSFER chain).</summary>
    public const string Random = "Random";

    /// <summary>The transition is written by the user in the output model.</summary>
    public const string CustomModel = "CustomModel";
}

/// <summary>Input or output of a TEB.</summary>
public sealed class TebPort
{
    /// <summary>Definition id, unique among the inputs and outputs of the class.</summary>
    public int Id { get; set; }

    /// <summary><see cref="ConnectedBlockModes"/>: how the port is bound to the TEB model.</summary>
    public string Mode { get; set; } = ConnectedBlockModes.FirstBlock;

    /// <summary>Label of the bound block (Mode = Label).</summary>
    public string? Label { get; set; }
    public int ConnectionsLimit { get; set; }
    public string? Description { get; set; }

    /// <summary>Outputs only: <see cref="TransferModes"/>.</summary>
    public string TransferMode { get; set; } = TransferModes.DirectOrSplit;

    /// <summary>Outputs only: GPSS model of the transition (TransferMode = CustomModel).</summary>
    public string? GpssText { get; set; }

    /// <summary>Side of the TEB image (1 top, 2 right, 3 bottom, 4 left as stored by GPSS Studio).</summary>
    public int Side { get; set; }
    public double Position { get; set; } = 0.5;
}

/// <summary>Connection from an output of one TEB to an input of another.</summary>
public sealed class TebLink
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    /// <summary>Node id, or a boundary connector id (<c>boundary:in:N</c>) inside a composite TEB.</summary>
    public string FromNodeId { get; set; } = string.Empty;
    public int FromPortId { get; set; }
    public string ToNodeId { get; set; } = string.Empty;
    public int ToPortId { get; set; }
    public int Priority { get; set; }
    public double Probability { get; set; }
    public int OrderIndex { get; set; }
    public string? Description { get; set; }

    /// <summary>GPSS model placed on the connection (generated as a separate fragment).</summary>
    public string? GpssText { get; set; }
    public List<SchemePoint> Points { get; set; } = [];
}

/// <summary>Input or output of a composite TEB shown inside its child scheme.</summary>
public sealed class BoundaryConnector
{
    public string Id { get; set; } = string.Empty;
    public string Direction { get; set; } = "input";
    public int DefinitionId { get; set; }
}

public sealed record SchemePoint(double X, double Y);

public sealed class SchemeDecor
{
    public string Kind { get; set; } = "image";
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public string? Text { get; set; }
}

public static class DataEntityTypes
{
    public const string Equ = "EQU";
    public const string Savevalue = "Savevalue";
    public const string Storage = "Storage";
    public const string Matrix = "Matrix";
    public const string BVariable = "BVariable";
    public const string Variable = "Variable";
    public const string FVariable = "FVariable";
    public const string Function = "Function";
    public const string LogicSwitch = "LogicSwitch";
    public const string Table = "Table";
    public const string Facility = "Facility";
    public const string Queue = "Queue";
    public const string UserChain = "UserChain";
    public const string NumericGroup = "NumericGroup";
    public const string TransactionGroup = "TransactionGroup";
}

/// <summary>A GPSS entity described in a TEB (generated as a definition statement or INITIAL).</summary>
public sealed class DataEntity
{
    public string Type { get; set; } = DataEntityTypes.Savevalue;
    public string Name { get; set; } = string.Empty;

    /// <summary>Value, capacity, expression or function argument, depending on the type.</summary>
    public string? Value { get; set; }
    public string? Description { get; set; }

    /// <summary>Matrix cells (rows of columns); function points as "x,y" strings in <see cref="Points"/>.</summary>
    public List<List<string>>? Cells { get; set; }

    /// <summary>Function type letter and points, e.g. <c>D</c> and <c>["0,1", "10,2"]</c>.</summary>
    public string? FunctionType { get; set; }
    public List<string>? Points { get; set; }
}

public sealed class TebParameter
{
    public int Id { get; set; }
    public string Type { get; set; } = "Expression";
    public string NameInModel { get; set; } = string.Empty;
    public string? Header { get; set; }
    public string? DefaultValue { get; set; }

    /// <summary>Value set on the instance; the default value when null.</summary>
    public string? Value { get; set; }
}

public sealed class TebStateDefinition
{
    public string Name { get; set; } = string.Empty;
    public string Expression { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public sealed class TebLibrary
{
    public string Id { get; set; } = string.Empty;
    public string Version { get; set; } = "1.0.0.0";
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsEditable { get; set; } = true;

    /// <summary>Classes as template nodes; <see cref="TebNode.Id"/> holds the class id, plus the category path.</summary>
    public List<LibraryClass> Classes { get; set; } = [];
}

public sealed class LibraryClass
{
    public string Category { get; set; } = string.Empty;
    public TebNode Template { get; set; } = new();
}
