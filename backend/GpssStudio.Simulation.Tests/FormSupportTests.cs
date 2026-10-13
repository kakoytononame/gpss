using GpssStudio.Simulation.Experiments;
using GpssStudio.Simulation.Parsing;

namespace GpssStudio.Simulation.Tests;

/// <summary>Operand editing for input forms, indicator dynamics and SNA evaluation.</summary>
public sealed class FormSupportTests
{
    [Theory]
    [InlineData("Berth1 EQU 1", 0, "1")]
    [InlineData("INITIAL x$gen_time,26 ; comment", 1, "26")]
    [InlineData("  GENERATE (Exponential(1,0,10)),,0,1", 0, "(Exponential(1,0,10))")]
    [InlineData("  GENERATE (Exponential(1,0,10)),,0,1", 3, "1")]
    [InlineData("TEST NE P1, 2,Next", 1, "2")]
    [InlineData("TEST E,P1,5,Next", 1, "5")]
    [InlineData("UNIT MATRIX ,2,3", 2, "3")]
    [InlineData("* comment line", 0, null)]
    [InlineData("TERMINATE", 0, null)]
    public void Read_FindsOperandsByPosition(string line, int index, string? expected) =>
        Assert.Equal(expected, OperandEditor.Read(line, index));

    [Theory]
    [InlineData("Berth1 EQU 1 ;berths", 0, "4", "Berth1 EQU 4 ;berths")]
    [InlineData("\tINITIAL\tx$gen_time,26", 1, "30", "\tINITIAL\tx$gen_time,30")]
    [InlineData("Again TEST NE P1, 2,Next", 1, "7", "Again TEST NE P1, 7,Next")]
    [InlineData("GENERATE 10", 3, "5", "GENERATE 10,,,5")]
    [InlineData("TERMINATE ;end", 0, "1", "TERMINATE 1 ;end")]
    [InlineData("QUEUE \"A;B\",2", 1, "3", "QUEUE \"A;B\",3")]
    public void Replace_KeepsTheRestOfTheLine(string line, int index, string value, string expected) =>
        Assert.Equal(expected, OperandEditor.Replace(line, index, value));

    [Fact]
    public void ReplaceInText_UsesOneBasedLinesAndOperandLetters()
    {
        var text = "Desk STORAGE 1\r\nINITIAL X$Mean,8\r\n";

        Assert.Equal("Desk STORAGE 1\r\nINITIAL X$Mean,4\r\n", OperandEditor.ReplaceInText(text, 2, "B", "4"));
        Assert.Throws<ArgumentException>(() => OperandEditor.ReplaceInText(text, 9, "A", "1"));
        Assert.Throws<ArgumentException>(() => OperandEditor.ReplaceInText(text, 1, "AB", "1"));
    }

    [Fact]
    public void Monitors_SampleIndicatorsOnAModelTimeGrid()
    {
        const string model = """
            GENERATE 10
            QUEUE Line
            ADVANCE 25
            DEPART Line
            TERMINATE 1
            """;
        var (session, _) = SimulationSession.Create(model, "Динамика", monitors: [new SimulationMonitor("Q$Line", "Очередь"), new SimulationMonitor("AC1")], monitorInterval: 5);
        var result = session!.Execute("START 4");

        var queue = result.Report!.Charts.TimeSeries.Single(series => series.Kind == "monitor" && series.Name == "Очередь");
        var clock = result.Report.Charts.TimeSeries.Single(series => series.Kind == "monitor" && series.Name == "AC1");
        Assert.Equal([0, 5, 10, 15, 20, 25, 30, 35], queue.Points.Take(8).Select(point => point[0]));
        Assert.Equal(15, clock.Points.Single(point => point[0] == 15)[1]);

        // Arrivals at 10, 20, 30 ... stay 25 units; a grid point sees the state after all events of that instant.
        Assert.Equal(3, queue.Points.Single(point => point[0] == 30)[1]);
        Assert.Equal(2, queue.Points.Single(point => point[0] == 25)[1]);
    }

    [Fact]
    public void Evaluate_ReturnsNullForUnknownExpressions()
    {
        var (session, _) = SimulationSession.Create("Desk STORAGE 3\nGENERATE 5\nENTER Desk\nTERMINATE 1\nSTART 2", "Оценка");

        Assert.Equal([4.0, 2.0, null], session!.Evaluate(["S$Desk-R$Desk+3", "N1", "Q$("]));
    }

    [Fact]
    public void OperandFactor_ChangesTheStatementOperand()
    {
        var result = ExperimentRunner.Run(new ExperimentRequest
        {
            ModelText = "GENERATE 10\nADVANCE 3\nTERMINATE 1",
            Factors = [new ExperimentFactor { Name = "Интервал", Kind = FactorKind.Operand, Line = 1, Operand = "A", Levels = [5, 20] }],
            Indicators = [new ExperimentIndicator { Expression = "AC1" }],
            StartCount = 4,
        });

        Assert.Equal([23.0, 83.0], result.Points.Select(point => point.Indicators[0]!.Mean));
        Assert.Throws<ArgumentException>(() => ExperimentRunner.Run(new ExperimentRequest
        {
            ModelText = "GENERATE 10\nTERMINATE 1",
            Factors = [new ExperimentFactor { Name = "X", Kind = FactorKind.Operand, Levels = [1] }],
            Indicators = [new ExperimentIndicator { Expression = "AC1" }],
        }));
    }
}
