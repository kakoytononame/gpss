using GpssStudio.Simulation.Queueing;

namespace GpssStudio.Simulation.Tests;

public sealed class QueueingInsightsTests
{
    private static QueueingModel Single(double interarrival, QueueingNode node) => new()
    {
        Classes = [new CustomerClass { Id = "c", Name = "Заявки", Arrival = Distribution.Exponential(interarrival), Entry = node.Id }],
        Nodes = [node],
    };

    private static IReadOnlyList<QueueingInsight> Insights(QueueingModel model) => QueueingInsights.Analyze(model, QueueingAnalytics.Analyze(model), null);

    [Fact]
    public void Bottleneck_IsReportedWithTheServersNeeded()
    {
        var insights = Insights(Single(10, new QueueingNode { Id = "n", Name = "Касса", Service = Distribution.Exponential(9.2) }));
        var bottleneck = Assert.Single(insights, insight => insight.Title.Contains("узкое место"));
        Assert.Equal(InsightSeverity.Warning, bottleneck.Severity);
        Assert.Contains("нужно каналов: 2", bottleneck.Text);
    }

    [Fact]
    public void UnstableSystem_IsCritical()
    {
        var insights = Insights(Single(5, new QueueingNode { Id = "n", Name = "Касса", Servers = 2, Service = Distribution.Exponential(12) }));
        var unstable = insights.First();
        Assert.Equal(InsightSeverity.Critical, unstable.Severity);
        Assert.Contains("неустойчива", unstable.Title);
        Assert.Contains("нужно каналов: 3", unstable.Text);
    }

    [Fact]
    public void Losses_AreReported()
    {
        var insights = Insights(Single(2, new QueueingNode { Id = "n", Name = "Линии", Servers = 4, Capacity = 4, Service = Distribution.Exponential(5) }));
        Assert.Contains(insights, insight => insight.Title.Contains("отказы") && insight.Severity >= InsightSeverity.Warning);
    }

    [Fact]
    public void LightlyLoadedSystem_HasReserve()
    {
        var insights = Insights(Single(10, new QueueingNode { Id = "n", Service = Distribution.Exponential(3) }));
        Assert.Equal("Система работает с запасом", insights[0].Title);
    }

    [Fact]
    public void ImpreciseRun_SuggestsALongerRun()
    {
        var model = QueueingPresets.Find("mm1")!.Model with { Duration = 3_000, WarmUp = 200, Replications = 3 };
        var run = QueueingRunner.Run(model);
        var insights = QueueingInsights.Analyze(model, run.Analysis, run);
        Assert.Contains(insights, insight => insight.Title.Contains("неточна") && insight.Text.Contains("раз"));

        var prompt = QueueingInsights.Prompt(model, run.Analysis, run, insights);
        Assert.Contains("Узел «Касса» M/M/1", prompt);
        Assert.Contains("моделирование", prompt);
        Assert.Contains("Найденные факты", prompt);
    }
}
