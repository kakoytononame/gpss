using GpssStudio.Simulation.Experiments;

namespace GpssStudio.Simulation.Tests;

public sealed class ExperimentTests
{
    private const string Model = """
        Servers EQU 1
        Desk   STORAGE 1
               INITIAL X$Mean,8
               GENERATE (Exponential(1,0,10))
               QUEUE  Line
               ENTER  Desk
               DEPART Line
               ADVANCE (Exponential(2,0,X$Mean))
               LEAVE  Desk
               TERMINATE 1
        """;

    private static ExperimentRequest Request(IReadOnlyList<ExperimentFactor> factors, int replications = 3) => new()
    {
        ModelText = Model,
        Factors = factors,
        Indicators = [new ExperimentIndicator { Expression = "QT$Line", Label = "Ожидание" }, new ExperimentIndicator { Expression = "SR$Desk" }],
        Replications = replications,
        StartCount = 300,
        ObjectiveIndicator = 0,
    };

    [Fact]
    public void Series_RunsTheFullFactorialPlanWithReplications()
    {
        var result = ExperimentRunner.Run(Request([
            new ExperimentFactor { Name = "Mean", Kind = FactorKind.Savevalue, Levels = [4, 8] },
            new ExperimentFactor { Name = "Desk", Kind = FactorKind.Storage, Levels = [1, 2] },
        ]));

        Assert.Equal(4, result.Points.Count);
        Assert.Equal(12, result.Runs.Count);
        Assert.All(result.Runs, run => Assert.Null(run.Error));
        Assert.Equal(["Ожидание", "SR$Desk"], result.IndicatorNames);

        // Faster service and two channels give the shortest waiting time.
        Assert.Equal(1, result.BestPoint is { } best ? (int)result.Points[best].Factors[1] / 2 : -1);
        Assert.Equal(4, result.Points[result.BestPoint!.Value].Factors[0]);
        var slow = result.Points.Single(point => point.Factors.SequenceEqual([8.0, 1.0]));
        Assert.True(slow.Indicators[0]!.Mean > result.Points[result.BestPoint.Value].Indicators[0]!.Mean);
        Assert.True(slow.Indicators[0]!.ConfidenceHalfWidth > 0);
    }

    [Fact]
    public void Replications_UseDifferentRandomNumbers()
    {
        var result = ExperimentRunner.Run(Request([], replications: 3));

        Assert.Single(result.Points);
        Assert.Equal(3, result.Runs.Select(run => run.Indicators[0]).Distinct().Count());
    }

    [Fact]
    public void EquFactor_ChangesTheModelText()
    {
        var request = new ExperimentRequest
        {
            ModelText = "Batch EQU 1\n GENERATE 1\n TERMINATE Batch\n",
            Factors = [new ExperimentFactor { Name = "Batch", Kind = FactorKind.Equ, Levels = [1, 5] }],
            Indicators = [new ExperimentIndicator { Expression = "AC1" }],
            StartCount = 10,
        };

        var result = ExperimentRunner.Run(request);

        Assert.Equal([10.0, 2.0], result.Points.Select(point => point.Indicators[0]!.Mean));
    }

    [Theory]
    [InlineData("")]
    [InlineData("bad(")]
    public void InvalidRequests_AreRejected(string indicator)
    {
        var request = new ExperimentRequest { ModelText = Model, Indicators = indicator.Length == 0 ? [] : [new ExperimentIndicator { Expression = indicator }] };

        Assert.Throws<ArgumentException>(() => ExperimentRunner.Run(request));
    }

    [Fact]
    public void Statistics_ComputeConfidenceInterval()
    {
        var summary = ExperimentRunner.Statistics([10, 12, 14]);

        Assert.Equal(12, summary.Mean, 6);
        Assert.Equal(2, summary.StandardDeviation, 6);
        Assert.Equal(4.303 * 2 / Math.Sqrt(3), summary.ConfidenceHalfWidth, 3);
    }
}
