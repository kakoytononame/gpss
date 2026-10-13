using System.IO.Compression;
using System.Text;
using GpssStudio.Projects.Forms;
using GpssStudio.Projects.Import;
using GpssStudio.Projects.Model;

namespace GpssStudio.Projects.Tests;

public sealed class FormTests
{
    private const string ModelText = "* Порт\r\nBerth EQU 1\r\nINITIAL X$Gap,26\r\nBerth STORAGE 2\r\nGENERATE X$Gap\r\nENTER Berth\r\nADVANCE 3,1\r\nLEAVE Berth\r\nTERMINATE 1\r\n";

    private const string Inputs = """
        <?xml version="1.0" encoding="utf-8"?>
        <InputModelObjectManager><Objects>
          <CommandInputModelObject Name="(3) INITIAL" ObjectNumber="7" OperandStringIndex="0" RowIndex="2" OperatorSpecWorld="initial">
            <Operands><OperandModelObject Name="Интервал" DefaultValue="26" OperandType="B" ValueType="Numeric">
              <Value><NumericValueObject InnerValue="30" /></Value></OperandModelObject></Operands>
          </CommandInputModelObject>
          <CommandInputModelObject Name="Berth" ObjectNumber="8" OperandStringIndex="0" RowIndex="3" OperatorSpecWorld="storage">
            <Operands><OperandModelObject Name="Операнд A" DefaultValue="2" OperandType="A" ValueType="Numeric">
              <Value><NumericValueObject InnerValue="2" /></Value></OperandModelObject></Operands>
          </CommandInputModelObject>
          <BlockInputModelObject Name="(7) ADVANCE" ObjectNumber="9" OperandStringIndex="0" RowIndex="6" OperatorSpecWorld="advance">
            <Operands><OperandModelObject Name="Время" DefaultValue="10" OperandType="A" ValueType="Time">
              <Value><TimeValueObject InnerValue="6000000000" OutputConverterType="MmTimeFormatConverter" /></Value></OperandModelObject></Operands>
          </BlockInputModelObject>
        </Objects></InputModelObjectManager>
        """;

    private const string Modeling = """
        <ModelingObjectManager IsCollectDynamics="True" PeriodTime="500" PeriodUnitTime="Days" IntervalTimeInModel="1" UnitTimeInModel="Minutes" IntervalTimeInMonitoring="1" UnitTimeInMonitoring="Hours" StartCommandValue="50">
          <Objects>
            <ModelingObject Name="Причал" Alias="Berth" ObjectNumber="0" BlockType="Storage"><Snas>
              <SnaModelObject Id="10" Alias="S" SnaNumber="1" IsUsed="True" IsMonitored="True" />
              <SnaModelObject Id="15" Alias="SR" SnaNumber="6" IsUsed="True" IsMonitored="False" />
            </Snas></ModelingObject>
            <ModelingObject Name="1" Alias="1" ObjectNumber="1" BlockType="Queue"><Snas>
              <SnaModelObject Id="20" Alias="QT" SnaNumber="4" IsUsed="False" IsMonitored="False" />
            </Snas></ModelingObject>
          </Objects>
        </ModelingObjectManager>
        """;

    private const string Planning = """
        <FormPlanningManager SelectedMethod="PlanningCore.Core.StepwisePlanningMethod">
          <FactorCollection>
            <FactorCore Id="1" Name="Интервал" LineIndex="2" OperandType="B" ObjectAlias="(3) INITIAL" IsInclude="True">
              <DefaultValue><NumericValueObject InnerValue="26" /></DefaultValue></FactorCore>
          </FactorCollection>
          <PlanningCollection><PlanningMethod Name="PlanningCore.Core.StepwisePlanningMethod">
            <StepwiseFactorInfo FactorId="1"><Step><NumericValueObject InnerValue="2" /></Step>
              <MinValue><NumericValueObject InnerValue="20" /></MinValue><MaxValue><NumericValueObject InnerValue="24,5" /></MaxValue></StepwiseFactorInfo>
          </PlanningMethod></PlanningCollection>
          <TargetCollection>
            <TargetCore Id="1" Name="Загрузка причала " ObjectAlias="Berth" BlockType="Storage" SnaAlias="SR" />
            <TargetCore Id="2" Name="Ожидание" ObjectAlias="1" BlockType="Queue" SnaAlias="QT" />
          </TargetCollection>
          <Plan><ExperimentCore><ExperimentFactorValueCore FactorId="1" Value="20" /></ExperimentCore>
            <ExperimentCore><ExperimentFactorValueCore FactorId="1" Value="22" /></ExperimentCore></Plan>
        </FormPlanningManager>
        """;

    private const string EntryForm = """
        <FormHostPanel Name="Root" Left="10" Top="10" Width="600" Height="400" BackColor="WhiteSmoke" FontSize="8,25"><Controls>
          <FormLabel Name="L1" Left="5" Top="5" Width="100" Height="20" Text="Интервал" ForeColor="#006400" FontSize="12" FontStyle="Italic" />
          <FormInputTextBox Name="I1" Left="110" Top="5" Width="60" Height="20" ObjectNumber="7" OperandType="B" ValueString="30" />
          <FormTabControl Name="Tabs" Left="5" Top="40" Width="300" Height="200"><TabPages>
            <TabPage Name="P1" Text="Причал"><Controls>
              <FormInputComboBox Name="C1" Left="5" Top="5" Width="80" Height="22" ObjectNumber="8" OperandType="A" SelectedIndex="1"><Values>
                <FormComboBoxItem InputValue="Малый" OutputValue="2" /><FormComboBoxItem InputValue="Большой" OutputValue="4" /></Values></FormInputComboBox>
              <FormPictureBox Name="Pic" Left="0" Top="0" Width="50" Height="50" SizeMode="Zoom" ImageSource="/Resources/Image1.png" />
            </Controls></TabPage>
          </TabPages></FormTabControl>
        </Controls></FormHostPanel>
        """;

    private const string DynamicForm = """
        <FormHostPanel Name="Root" Left="10" Top="10" Width="600" Height="400"><Controls>
          <FormSnaTextBox Name="S1" Left="5" Top="5" Width="60" Height="20" ObjectNumber="0" SnaNumber="1" SnaId="10"><ValueIntervals><ValueIntervalCollection>
            <ValueInterval LowValue="-2147483648" HighValue="1" TextColor="#000000" BackColor="#7CFC00" />
            <ValueInterval LowValue="2" HighValue="2147483647" TextColor="#000000" BackColor="#FF4500" />
          </ValueIntervalCollection></ValueIntervals></FormSnaTextBox>
          <FormChartControl Name="Chart"><Series><SerializeSeria Name="Загрузка" ViewType="Bar"><Points>
            <SerializePoint Argument="Причал" Value="2" Tag="15" /></Points></SerializeSeria></Series></FormChartControl>
        </Controls></FormHostPanel>
        """;

    public static byte[] FormPackage()
    {
        using var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            void Add(string path, byte[] content)
            {
                using var stream = zip.CreateEntry(path).Open();
                stream.Write(content);
            }

            Add("Objects/ModelText.txt", [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(ModelText)]);
            Add("Objects/InputObjects.xml", Encoding.UTF8.GetBytes(Inputs));
            Add("Objects/ModelingObjects.xml", Encoding.UTF8.GetBytes(Modeling));
            Add("Objects/Planning.xml", Encoding.UTF8.GetBytes(Planning));
            Add("Forms/EntryForm.xml", Encoding.UTF8.GetBytes(EntryForm));
            Add("Forms/DynamicForm.xml", Encoding.UTF8.GetBytes(DynamicForm));
            Add("Resources/Image1.png", [0x89, 0x50, 0x4E, 0x47]);
        }

        return buffer.ToArray();
    }

    [Fact]
    public void Read_ParsesInputsIndicatorsPlanAndLayouts()
    {
        var notes = new List<string>();
        var form = FormReader.Read("Порт", FormPackage(), notes);

        Assert.Empty(notes);
        Assert.StartsWith("* Порт", form.ModelText);
        Assert.Equal([3, 4, 7], form.Inputs.Select(input => input.Line));
        Assert.Equal("30", form.Inputs[0].Operands[0].Value);
        Assert.Equal("10", form.Inputs[2].Operands[0].Value);
        Assert.Equal("block", form.Inputs[2].Kind);

        Assert.Equal(50, form.Run.StartCount);
        Assert.Equal(60, form.Run.MonitorInterval);
        Assert.True(form.Run.CollectDynamics);
        Assert.Equal(["S$Berth", "SR$Berth", "QT1"], form.Indicators.Select(indicator => indicator.Expression));
        Assert.Equal([true, false, false], form.Indicators.Select(indicator => indicator.Monitored));

        var plan = form.Plan!;
        Assert.Equal("Stepwise", plan.Method);
        var factor = Assert.Single(plan.Factors);
        Assert.Equal((3, "B", 20.0, 24.5, 2.0, 26.0), (factor.Line, factor.Operand, factor.Min, factor.Max, factor.Step, factor.Default));
        Assert.Equal(["SR$Berth", "QT1"], plan.Targets.Select(target => target.Expression));
        Assert.Equal("Загрузка причала", plan.Targets[0].Name);
        Assert.Equal([[20.0], [22.0]], plan.Points);

        var entry = form.EntryForm!;
        Assert.Equal("panel", entry.Type);
        Assert.Equal(["panel", "label", "input", "tabs", "tab", "combo", "picture"], FormReader.Flatten(entry).Select(control => control.Type));
        var combo = FormReader.Flatten(entry).Single(control => control.Type == "combo");
        Assert.Equal((8, "A", "4"), (combo.Input, combo.Operand, combo.Value));
        Assert.Equal(["Малый", "Большой"], combo.Choices.Select(choice => choice.Label));
        Assert.Equal(12, FormReader.Flatten(entry).Single(control => control.Type == "label").FontSize);
        Assert.StartsWith("data:image/png;base64,", form.Images["/Resources/Image1.png"]);

        var sna = FormReader.Flatten(form.DynamicForm!).Single(control => control.Type == "sna");
        Assert.Equal(10, sna.Indicator);
        Assert.Equal([1.0, 2147483647.0], sna.Intervals.Select(interval => interval.High));
        var chart = FormReader.Flatten(form.DynamicForm!).Single(control => control.Type == "chart");
        Assert.Equal(15, chart.Series.Single().Points.Single().Indicator);
    }

    [Fact]
    public void Apply_WritesInputValuesIntoTheModelText()
    {
        var form = FormReader.Read("Порт", FormPackage(), []);
        form.Inputs[1].Operands[0].Value = "4";

        var (text, messages) = FormModelBuilder.Apply(form.ModelText!, form.Inputs);

        Assert.Empty(messages);
        var lines = text.Split("\r\n");
        Assert.Equal("INITIAL X$Gap,30", lines[2]);
        Assert.Equal("Berth STORAGE 4", lines[3]);
        Assert.Equal("ADVANCE 10,1", lines[6]);
        Assert.Equal("ENTER Berth", lines[5]);
    }

    [Fact]
    public void Apply_ReportsLinesOutsideTheText()
    {
        var input = new FormInput { Name = "X", Line = 40, Operands = [new FormOperand { Operand = "A", Value = "1" }] };

        var (text, messages) = FormModelBuilder.Apply("GENERATE 1\nTERMINATE 1", [input]);

        Assert.Equal("GENERATE 1\nTERMINATE 1", text);
        Assert.Contains("строка 40", Assert.Single(messages));
    }

    [Theory]
    [InlineData("SR", "Berth1", "SR$Berth1")]
    [InlineData("qt", "3", "QT3")]
    [InlineData("MX", "Table", null)]
    [InlineData("STOL", "Kassa", "STOL$Kassa")]
    [InlineData("", "A", null)]
    public void SnaExpression_BuildsGpssReferences(string family, string entity, string? expected) =>
        Assert.Equal(expected, FormReader.SnaExpression(family, entity));
}
