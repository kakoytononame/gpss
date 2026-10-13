namespace GpssStudio.Projects.Model;

/// <summary>
/// User form of a model (GPSS Studio <c>Forms/&lt;name&gt;/Form.fog</c>): input data bound to operands of the
/// form's model text, the entry and dynamic form layouts, monitored indicators and the experiment plan.
/// </summary>
public sealed class StudioForm
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Model text the form is bound to (input lines refer to it).</summary>
    public string? ModelText { get; set; }

    public List<FormInput> Inputs { get; set; } = [];

    /// <summary>"Форма ввода исходных данных" (root panel), if designed.</summary>
    public FormControl? EntryForm { get; set; }

    /// <summary>"Динамическая форма" shown during the run, if designed.</summary>
    public FormControl? DynamicForm { get; set; }

    /// <summary>The form has an animation layout (not ported: shown as a note).</summary>
    public bool HasAnimation { get; set; }

    /// <summary>SNA of the model objects that forms and dynamics refer to.</summary>
    public List<FormIndicator> Indicators { get; set; } = [];

    public FormRunSettings Run { get; set; } = new();

    public FormPlan? Plan { get; set; }

    /// <summary>Pictures used by the layouts: resource path (e.g. <c>/Resources/Image1.png</c>) → data URI.</summary>
    public Dictionary<string, string> Images { get; set; } = [];
}

/// <summary>Statement of the form's model text with editable operands.</summary>
public sealed class FormInput
{
    /// <summary>Object number referenced by form controls.</summary>
    public int Number { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>command | block | matrix | function.</summary>
    public string Kind { get; set; } = "command";

    /// <summary>GPSS operation in lower case (initial, storage, generate, ...).</summary>
    public string Operator { get; set; } = string.Empty;

    /// <summary>1-based line in <see cref="StudioForm.ModelText"/>.</summary>
    public int Line { get; set; }
    public List<FormOperand> Operands { get; set; } = [];
}

public sealed class FormOperand
{
    /// <summary>Caption shown to the user (e.g. "Время между приходом кораблей").</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Operand letter: A, B, C, ...</summary>
    public string Operand { get; set; } = "A";

    /// <summary>Numeric | Text | Time.</summary>
    public string ValueType { get; set; } = "Numeric";

    /// <summary>Value written into the model text (numbers with a decimal point).</summary>
    public string Value { get; set; } = string.Empty;
    public string? DefaultValue { get; set; }
}

/// <summary>Standard numerical attribute of a model object (e.g. SR of storage Berth1).</summary>
public sealed class FormIndicator
{
    public int Id { get; set; }

    /// <summary>Caption of the object in the form (often in Russian).</summary>
    public string Title { get; set; } = string.Empty;
    public string Object { get; set; } = string.Empty;

    /// <summary>Facility | Storage | Queue | Savevalue | Table | ...</summary>
    public string ObjectType { get; set; } = string.Empty;
    public string Sna { get; set; } = string.Empty;

    /// <summary>GPSS expression, e.g. <c>SR$Berth1</c> or <c>QT1</c>; null when it cannot be evaluated (matrices).</summary>
    public string? Expression { get; set; }

    /// <summary>Collected over model time ("динамика показателей").</summary>
    public bool Monitored { get; set; }
}

public sealed class FormRunSettings
{
    /// <summary>Termination count of START used by the form.</summary>
    public int StartCount { get; set; } = 1;
    public bool CollectDynamics { get; set; }

    /// <summary>Monitoring interval in model time units (1 when the units cannot be converted).</summary>
    public double MonitorInterval { get; set; } = 1;
    public string? ModelTimeUnit { get; set; }
    public double? Period { get; set; }
    public string? PeriodUnit { get; set; }
}

/// <summary>Experiment plan of the form (factors bound to operands, targets as SNA).</summary>
public sealed class FormPlan
{
    /// <summary>Manual | Stepwise | Ioso.</summary>
    public string Method { get; set; } = "Stepwise";
    public List<FormFactor> Factors { get; set; } = [];
    public List<FormTarget> Targets { get; set; } = [];

    /// <summary>Plan points: factor values in the order of <see cref="Factors"/>.</summary>
    public List<List<double>> Points { get; set; } = [];
}

public sealed class FormFactor
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>1-based line of the form's model text.</summary>
    public int Line { get; set; }
    public string Operand { get; set; } = "A";
    public string? Object { get; set; }
    public double? Default { get; set; }
    public double? Min { get; set; }
    public double? Max { get; set; }
    public double? Step { get; set; }
}

public sealed class FormTarget
{
    public string Name { get; set; } = string.Empty;
    public string Expression { get; set; } = string.Empty;
}

/// <summary>Control of a form layout; coordinates are relative to the parent.</summary>
public sealed class FormControl
{
    /// <summary>panel | label | group | tabs | tab | input | combo | check | sna | picture | chart | clock.</summary>
    public string Type { get; set; } = "label";
    public string Name { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public string? Text { get; set; }
    public string? ForeColor { get; set; }
    public string? BackColor { get; set; }
    public string? FontName { get; set; }
    public double FontSize { get; set; }
    public string? FontStyle { get; set; }
    public string? TextAlign { get; set; }

    /// <summary>Input controls: <see cref="FormInput.Number"/> and operand letter.</summary>
    public int? Input { get; set; }
    public string? Operand { get; set; }
    public string? Value { get; set; }

    /// <summary>Combo box / check box values: caption and the value written into the model.</summary>
    public List<FormChoice> Choices { get; set; } = [];

    /// <summary>SNA text boxes: <see cref="FormIndicator.Id"/> and value colouring.</summary>
    public int? Indicator { get; set; }
    public List<FormValueInterval> Intervals { get; set; } = [];

    /// <summary>Pictures: key of <see cref="StudioForm.Images"/> and Normal | Zoom | StretchImage | CenterImage.</summary>
    public string? Image { get; set; }
    public string? SizeMode { get; set; }

    public List<FormChartSeries> Series { get; set; } = [];
    public List<FormControl> Children { get; set; } = [];
}

public sealed class FormChoice
{
    public string Label { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}

public sealed class FormValueInterval
{
    public double Low { get; set; }
    public double High { get; set; }
    public string? TextColor { get; set; }
    public string? BackColor { get; set; }
}

public sealed class FormChartSeries
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Bar | Line | Pie | ... (DevExpress view type names).</summary>
    public string ViewType { get; set; } = "Bar";
    public List<FormChartPoint> Points { get; set; } = [];
}

public sealed class FormChartPoint
{
    public string Argument { get; set; } = string.Empty;
    public int Indicator { get; set; }
}
