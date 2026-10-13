using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using GpssStudio.Projects.Model;

namespace GpssStudio.Projects.Import;

/// <summary>
/// Reads a GPSS Studio form (<c>Form.fog</c>, an OPC/ZIP package): <c>Objects/InputObjects.xml</c>,
/// <c>Objects/ModelText.txt</c>, <c>Objects/ModelingObjects.xml</c>, <c>Objects/Planning.xml</c>,
/// <c>Forms/EntryForm.xml</c>, <c>Forms/DynamicForm.xml</c> and the pictures they use.
/// </summary>
public static class FormReader
{
    public const int MaxImageBytes = 3 * 1024 * 1024;
    public const int MaxImagesBytes = 8 * 1024 * 1024;
    private const long MaxUnpackedBytes = 64L * 1024 * 1024;

    private static readonly Dictionary<string, string> ImageTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png", [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".gif"] = "image/gif", [".bmp"] = "image/bmp",
    };

    /// <summary>Length of one unit of model / monitoring time in seconds.</summary>
    private static readonly Dictionary<string, double> TimeUnitSeconds = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Seconds"] = 1, ["Minutes"] = 60, ["Hours"] = 3600, ["Days"] = 86_400, ["Weeks"] = 604_800,
    };

    public static StudioForm Read(string name, byte[] package, List<string> notes)
    {
        var files = Unpack(package);
        var form = new StudioForm { Name = name };
        if (files.TryGetValue("Objects/ModelText.txt", out var text))
        {
            form.ModelText = DecodeText(text);
        }

        if (Load(files, "Objects/InputObjects.xml") is { } inputs)
        {
            form.Inputs = ReadInputs(inputs);
        }

        if (Load(files, "Objects/ModelingObjects.xml") is { } modeling)
        {
            ReadModelingObjects(modeling, form);
        }

        if (Load(files, "Objects/Planning.xml") is { } planning)
        {
            form.Plan = ReadPlan(planning);
        }

        form.EntryForm = Load(files, "Forms/EntryForm.xml")?.Root is { } entry ? ReadControl(entry) : null;
        form.DynamicForm = Load(files, "Forms/DynamicForm.xml")?.Root is { } dynamic ? ReadControl(dynamic) : null;
        form.HasAnimation = files.ContainsKey("Forms/AnimationForm.xml");
        if (form.HasAnimation)
        {
            notes.Add($"Форма «{name}»: анимационная форма не переносится, доступны форма ввода и динамическая форма.");
        }

        ReadImages(files, form, notes);
        return form;
    }

    // ----------------------------------------------------------------------------- input objects

    private static List<FormInput> ReadInputs(XDocument document)
    {
        var inputs = new List<FormInput>();
        foreach (var element in document.Root?.Element("Objects")?.Elements() ?? [])
        {
            var kind = element.Name.LocalName.Replace("InputModelObject", string.Empty).ToLowerInvariant();
            inputs.Add(new FormInput
            {
                Number = Int(element, "ObjectNumber") ?? inputs.Count,
                Name = Attr(element, "Name") ?? string.Empty,
                Kind = kind.Length == 0 ? "command" : kind,
                Operator = (Attr(element, "OperatorSpecWorld") ?? string.Empty).ToLowerInvariant(),
                Line = (Int(element, "RowIndex") ?? -1) + 1,
                Operands = element.Element("Operands")?.Elements("OperandModelObject").Select(ReadOperand).ToList() ?? [],
            });
        }

        return inputs;
    }

    private static FormOperand ReadOperand(XElement element)
    {
        var valueObject = element.Element("Value")?.Elements().FirstOrDefault();
        return new FormOperand
        {
            Name = Attr(element, "Name") ?? string.Empty,
            Operand = (Attr(element, "OperandType") ?? "A").ToUpperInvariant(),
            ValueType = Attr(element, "ValueType") ?? "Numeric",
            Value = valueObject is null ? Attr(element, "DefaultValue") ?? string.Empty : ValueText(valueObject),
            DefaultValue = Attr(element, "DefaultValue"),
        };
    }

    /// <summary>Value objects: numbers use the decimal comma of the Russian locale; time values are .NET ticks.</summary>
    private static string ValueText(XElement valueObject)
    {
        var inner = Attr(valueObject, "InnerValue") ?? string.Empty;
        switch (valueObject.Name.LocalName)
        {
            case "NumericValueObject":
                return NormalizeNumber(inner);
            case "TimeValueObject" when long.TryParse(inner, NumberStyles.Integer, CultureInfo.InvariantCulture, out var ticks):
            {
                var unit = TimeConverterUnit(Attr(valueObject, "OutputConverterType"));
                return (TimeSpan.FromTicks(ticks).TotalSeconds / unit).ToString("0.######", CultureInfo.InvariantCulture);
            }
            default:
                return inner;
        }
    }

    /// <summary>"MmTimeFormatConverter" → minutes, "HhTimeFormatConverter" → hours, ...</summary>
    private static double TimeConverterUnit(string? converter) => converter?[..Math.Min(2, converter.Length)] switch
    {
        "Ss" => 1,
        "Mm" => 60,
        "Hh" => 3600,
        "Dd" => 86_400,
        _ => 60,
    };

    private static string NormalizeNumber(string text)
    {
        var candidate = text.Trim().Replace(',', '.');
        return double.TryParse(candidate, NumberStyles.Float, CultureInfo.InvariantCulture, out _) ? candidate : text.Trim();
    }

    // ----------------------------------------------------------------------------- modeling objects

    private static void ReadModelingObjects(XDocument document, StudioForm form)
    {
        var root = document.Root;
        if (root is null)
        {
            return;
        }

        var modelUnit = Attr(root, "UnitTimeInModel");
        var monitoringUnit = Attr(root, "UnitTimeInMonitoring");
        var monitoringInterval = Double(root, "IntervalTimeInMonitoring") ?? 1;
        var modelInterval = Double(root, "IntervalTimeInModel") ?? 1;
        var interval = modelUnit is not null && monitoringUnit is not null
                       && TimeUnitSeconds.TryGetValue(modelUnit, out var modelSeconds) && TimeUnitSeconds.TryGetValue(monitoringUnit, out var monitoringSeconds)
            ? monitoringInterval * monitoringSeconds / (modelSeconds * modelInterval)
            : monitoringInterval;

        form.Run = new FormRunSettings
        {
            StartCount = Int(root, "StartCommandValue") is > 0 and var count ? count : 1,
            CollectDynamics = Bool(root, "IsCollectDynamics"),
            MonitorInterval = interval > 0 ? interval : 1,
            ModelTimeUnit = modelUnit,
            Period = Double(root, "PeriodTime"),
            PeriodUnit = Attr(root, "PeriodUnitTime"),
        };

        foreach (var element in root.Element("Objects")?.Elements().Where(item => item.Name.LocalName.EndsWith("ModelingObject", StringComparison.Ordinal)) ?? [])
        {
            var alias = Attr(element, "Alias") ?? string.Empty;
            var type = Attr(element, "BlockType") ?? string.Empty;
            foreach (var sna in element.Element("Snas")?.Elements() ?? [])
            {
                var family = Attr(sna, "Alias") ?? string.Empty;
                var cell = sna.Name.LocalName == "MatrixSnaModelObject" && Int(sna, "RowIndex") is { } row && Int(sna, "ColumnIndex") is { } column
                    ? $"MX${alias}({row},{column})"
                    : null;
                form.Indicators.Add(new FormIndicator
                {
                    Id = Int(sna, "Id") ?? form.Indicators.Count,
                    Title = Attr(element, "Name") ?? alias,
                    Object = alias,
                    ObjectType = type,
                    Sna = cell is null ? family : Attr(sna, "Name") ?? family,
                    Expression = cell ?? SnaExpression(family, alias),
                    Monitored = Bool(sna, "IsMonitored"),
                });
            }
        }
    }

    /// <summary>"SR" + "Berth1" → <c>SR$Berth1</c>; numeric entities → <c>QT1</c>; matrices have no scalar value.</summary>
    public static string? SnaExpression(string family, string entity)
    {
        family = family.Trim().ToUpperInvariant();
        entity = entity.Trim();
        if (family.Length == 0 || entity.Length == 0 || family == "MX" || !family.All(char.IsAsciiLetterUpper))
        {
            return null;
        }

        return entity.All(char.IsAsciiDigit) ? family + entity : $"{family}${entity}";
    }

    // ----------------------------------------------------------------------------- planning

    private static FormPlan ReadPlan(XDocument document)
    {
        var root = document.Root!;
        var method = (Attr(root, "SelectedMethod") ?? "Stepwise").Split('.').Last().Replace("PlanningMethod", string.Empty);
        var factors = root.Element("FactorCollection")?.Elements("FactorCore")
            .Where(element => !string.Equals(Attr(element, "IsInclude"), "False", StringComparison.OrdinalIgnoreCase))
            .Select(element => new FormFactor
            {
                Id = Int(element, "Id") ?? 0,
                Name = Attr(element, "Name") ?? string.Empty,
                Line = (Int(element, "LineIndex") ?? -1) + 1,
                Operand = (Attr(element, "OperandType") ?? "A").ToUpperInvariant(),
                Object = Attr(element, "ObjectAlias"),
                Default = NumericChild(element, "DefaultValue"),
            })
            .ToList() ?? [];

        // Ranges come from the stepwise method (also used as the bounds of IOSO optimisation).
        foreach (var info in root.Descendants().Where(element => element.Name.LocalName is "StepwiseFactorInfo" or "IosoFactorInfo"))
        {
            var factor = factors.FirstOrDefault(item => item.Id == Int(info, "FactorId"));
            if (factor is null || (factor.Min is not null && info.Name.LocalName == "IosoFactorInfo"))
            {
                continue;
            }

            factor.Min = NumericChild(info, "MinValue") ?? factor.Min;
            factor.Max = NumericChild(info, "MaxValue") ?? factor.Max;
            factor.Step = NumericChild(info, "Step") ?? factor.Step;
        }

        var targets = root.Element("TargetCollection")?.Elements("TargetCore")
            .Select(element => (Name: Attr(element, "Name")?.Trim() ?? string.Empty, Expression: SnaExpression(Attr(element, "SnaAlias") ?? string.Empty, Attr(element, "ObjectAlias") ?? string.Empty)))
            .Where(target => target.Expression is not null)
            .Select(target => new FormTarget { Name = target.Name, Expression = target.Expression! })
            .ToList() ?? [];

        var points = root.Element("Plan")?.Elements("ExperimentCore")
            .Select(point => factors.Select(factor => point.Elements("ExperimentFactorValueCore").FirstOrDefault(value => Int(value, "FactorId") == factor.Id) is { } value
                    && double.TryParse(NormalizeNumber(Attr(value, "Value") ?? string.Empty), NumberStyles.Float, CultureInfo.InvariantCulture, out var number)
                    ? number
                    : factor.Default ?? 0).ToList())
            .Where(point => point.Count > 0)
            .ToList() ?? [];

        return new FormPlan { Method = method, Factors = factors, Targets = targets, Points = points };
    }

    private static double? NumericChild(XElement element, string name) =>
        element.Element(name)?.Elements().FirstOrDefault() is { } valueObject
        && double.TryParse(ValueText(valueObject), NumberStyles.Float, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;

    // ----------------------------------------------------------------------------- layouts

    private static readonly Dictionary<string, string> ControlTypes = new(StringComparer.Ordinal)
    {
        ["FormHostPanel"] = "panel", ["FormLabel"] = "label", ["FormGroupBox"] = "group", ["FormTabControl"] = "tabs",
        ["FormTabPage"] = "tab", ["TabPage"] = "tab", ["FormInputTextBox"] = "input", ["FormInputComboBox"] = "combo",
        ["FormInputCheckBox"] = "check", ["FormSnaTextBox"] = "sna", ["FormPictureBox"] = "picture",
        ["FormChartControl"] = "chart", ["FormModelDatetime"] = "clock",
    };

    private static FormControl ReadControl(XElement element)
    {
        var control = new FormControl
        {
            Type = ControlTypes.GetValueOrDefault(element.Name.LocalName, "label"),
            Name = Attr(element, "Name") ?? string.Empty,
            X = Int(element, "Left") ?? 0,
            Y = Int(element, "Top") ?? 0,
            Width = Int(element, "Width") ?? 0,
            Height = Int(element, "Height") ?? 0,
            Text = Attr(element, "Text"),
            ForeColor = Attr(element, "ForeColor"),
            BackColor = Attr(element, "BackColor"),
            FontName = Attr(element, "FontName"),
            FontSize = Double(element, "FontSize") ?? 8.25,
            FontStyle = Attr(element, "FontStyle"),
            TextAlign = Attr(element, "TextAlign"),
            Image = Attr(element, "ImageSource"),
            SizeMode = Attr(element, "SizeMode"),
        };

        if (control.Type is "input" or "combo" or "check")
        {
            control.Input = Int(element, "ObjectNumber");
            control.Operand = Attr(element, "OperandType")?.ToUpperInvariant();
            control.Value = Attr(element, "ValueString");
            control.Choices = element.Element("Values")?.Elements()
                .Select(item => new FormChoice { Label = Attr(item, "InputValue") ?? string.Empty, Value = NormalizeNumber(Attr(item, "OutputValue") ?? string.Empty) })
                .ToList() ?? [];
            if (control.Type == "combo" && Int(element, "SelectedIndex") is { } selected && selected >= 0 && selected < control.Choices.Count)
            {
                control.Value = control.Choices[selected].Value;
            }
            else if (control.Type == "check")
            {
                var state = Attr(element, "CheckState") ?? "Unchecked";
                control.Value = element.Element("Values")?.Elements().FirstOrDefault(item => Attr(item, "CheckState") == state) is { } item
                    ? NormalizeNumber(Attr(item, "OutputValue") ?? "0")
                    : "0";
            }
        }
        else if (control.Type == "sna")
        {
            // ObjectNumber -1: the box is not bound to a model object.
            control.Indicator = Int(element, "ObjectNumber") is < 0 ? null : Int(element, "SnaId");
            control.Intervals = element.Descendants("ValueInterval").Select(interval => new FormValueInterval
            {
                Low = Double(interval, "LowValue") ?? double.MinValue,
                High = Double(interval, "HighValue") ?? double.MaxValue,
                TextColor = Attr(interval, "TextColor"),
                BackColor = Attr(interval, "BackColor"),
            }).ToList();
        }
        else if (control.Type == "chart")
        {
            control.Series = element.Element("Series")?.Elements("SerializeSeria").Select(series => new FormChartSeries
            {
                Name = Attr(series, "Name") ?? string.Empty,
                ViewType = Attr(series, "ViewType") ?? "Bar",
                Points = series.Element("Points")?.Elements("SerializePoint")
                    .Select(point => new FormChartPoint { Argument = Attr(point, "Argument") ?? string.Empty, Indicator = Int(point, "Tag") ?? -1 })
                    .ToList() ?? [],
            }).ToList() ?? [];
        }

        var children = element.Element("Controls")?.Elements() ?? element.Element("TabPages")?.Elements() ?? [];
        control.Children = children.Select(ReadControl).ToList();
        return control;
    }

    private static void ReadImages(Dictionary<string, byte[]> files, StudioForm form, List<string> notes)
    {
        var used = new[] { form.EntryForm, form.DynamicForm }
            .Where(control => control is not null)
            .SelectMany(control => Flatten(control!))
            .Select(control => control.Image)
            .OfType<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase);
        long total = 0;
        foreach (var source in used)
        {
            var path = source.TrimStart('/');
            if (!files.TryGetValue(path, out var bytes) || !ImageTypes.TryGetValue(Path.GetExtension(path), out var mediaType))
            {
                continue;
            }

            if (bytes.Length > MaxImageBytes || total + bytes.Length > MaxImagesBytes)
            {
                notes.Add($"Форма «{form.Name}»: изображение {path} не перенесено (слишком большое).");
                continue;
            }

            total += bytes.Length;
            form.Images[source] = $"data:{mediaType};base64,{Convert.ToBase64String(bytes)}";
        }
    }

    public static IEnumerable<FormControl> Flatten(FormControl control) => control.Children.SelectMany(Flatten).Prepend(control);

    // ----------------------------------------------------------------------------- helpers

    private static Dictionary<string, byte[]> Unpack(byte[] package)
    {
        using var zip = new ZipArchive(new MemoryStream(package), ZipArchiveMode.Read);
        var files = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
        long total = 0;
        foreach (var entry in zip.Entries.Where(entry => !entry.FullName.EndsWith('/')))
        {
            total += entry.Length;
            if (total > MaxUnpackedBytes)
            {
                throw new InvalidDataException("Файл формы слишком большой.");
            }

            using var stream = entry.Open();
            using var buffer = new MemoryStream();
            stream.CopyTo(buffer);
            files[entry.FullName.Replace('\\', '/').TrimStart('/')] = buffer.ToArray();
        }

        return files;
    }

    private static XDocument? Load(Dictionary<string, byte[]> files, string path)
    {
        if (!files.TryGetValue(path, out var content))
        {
            return null;
        }

        using var stream = new MemoryStream(content);
        return XDocument.Load(stream);
    }

    private static string DecodeText(byte[] bytes)
    {
        try
        {
            return new UTF8Encoding(false, throwOnInvalidBytes: true).GetString(bytes).TrimStart('﻿');
        }
        catch (DecoderFallbackException)
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(1251).GetString(bytes);
        }
    }

    private static string? Attr(XElement element, string name) => element.Attribute(name)?.Value;

    private static int? Int(XElement element, string name) =>
        int.TryParse(Attr(element, name), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : null;

    private static double? Double(XElement element, string name) =>
        double.TryParse(Attr(element, name)?.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var value) ? value : null;

    private static bool Bool(XElement element, string name) => string.Equals(Attr(element, name), "True", StringComparison.OrdinalIgnoreCase);
}
