using GpssStudio.Simulation.Queueing;

namespace GpssStudio.Simulation.Tests;

/// <summary>Analytical formulas against textbook values, and the validation and generation of descriptions.</summary>
public sealed class QueueingAnalyticsTests
{
    private static QueueingModel Single(Distribution arrival, QueueingNode node, BatchSize? batch = null) => new()
    {
        Classes = [new CustomerClass { Id = "c", Arrival = arrival, Batch = batch, Entry = node.Id }],
        Nodes = [node],
    };

    private static NodeAnalysis Node(QueueingModel model) => QueueingAnalytics.Analyze(model).Nodes[0];

    [Fact]
    public void ErlangFormulas_MatchTables()
    {
        Assert.Equal(0.125 / 1.625, QueueingFormulas.ErlangB(2, 0.5), 12); // a²/2 / (1 + a + a²/2)
        Assert.Equal(0.7022, QueueingFormulas.ErlangC(3, 2.5), 4);
        Assert.Equal(0.8, QueueingFormulas.ErlangC(1, 0.8), 12);
    }

    [Fact]
    public void MM1_AndMMc_AreExact()
    {
        var mm1 = Node(Single(Distribution.Exponential(10), new QueueingNode { Id = "n", Service = Distribution.Exponential(8) }));
        Assert.Equal(AnalysisQuality.Exact, mm1.Quality);
        Assert.Equal(4, mm1.Metrics.L!.Value, 9);
        Assert.Equal(32, mm1.Metrics.Wq!.Value, 9);
        Assert.Equal("M/M/1", mm1.Kendall);

        var mmc = Node(Single(Distribution.Exponential(4), new QueueingNode { Id = "n", Servers = 3, Service = Distribution.Exponential(10) }));
        Assert.Equal(0.7022 * 10 / 0.5 / 1, mmc.Metrics.Wq!.Value, 2);
    }

    [Fact]
    public void FiniteCapacity_MatchesTheClosedFormOfMM1K()
    {
        // ρ = 0.5, K = 3: P0 = (1−ρ)/(1−ρ⁴), PK = ρ³·P0.
        var node = Node(Single(Distribution.Exponential(2), new QueueingNode { Id = "n", Capacity = 3, Service = Distribution.Exponential(1) }));
        var p0 = 0.5 / (1 - Math.Pow(0.5, 4));
        Assert.Equal(Math.Pow(0.5, 3) * p0, node.Metrics.LossProbability!.Value, 10);
        Assert.Equal(1 - p0, node.Metrics.Utilization!.Value, 10);
    }

    [Fact]
    public void MG1K_WithExponentialServiceEqualsTheBirthDeathSolution()
    {
        // The embedded chain (used for general service) must agree with M/M/1/K.
        var arrivals = new Func<int, double>(k => 1 / 1.8 * Math.Pow(0.8 / 1.8, k));
        var p = QueueingFormulas.MG1K(4, 0.8, arrivals);
        var bd = QueueingFormulas.BirthDeath(_ => 0.8, _ => 1, 4)!;
        for (var n = 0; n <= 4; n++)
        {
            Assert.Equal(bd[n], p[n], 10);
        }
    }

    [Theory]
    [InlineData(DistributionKind.Deterministic, 16)] // M/D/1: Wq = ρ/(2μ(1−ρ))
    [InlineData(DistributionKind.Exponential, 32)]
    public void PollaczekKhinchine(DistributionKind kind, double waiting)
    {
        var node = Node(Single(Distribution.Exponential(10), new QueueingNode { Id = "n", Service = new Distribution { Kind = kind, Mean = 8 } }));
        Assert.Equal(waiting, node.Metrics.Wq!.Value, 9);
    }

    [Fact]
    public void Priorities_SatisfyTheConservationLaw()
    {
        // Σ ρk Wq,k = ρ W0 / (1 − ρ) for non-preemptive work-conserving disciplines.
        var model = new QueueingModel
        {
            Classes =
            [
                new CustomerClass { Id = "a", Arrival = Distribution.Exponential(25), Priority = 2, Entry = "n" },
                new CustomerClass { Id = "b", Arrival = Distribution.Exponential(12), Priority = 1, Entry = "n" },
            ],
            Nodes = [new QueueingNode { Id = "n", Discipline = QueueDiscipline.Priority, Service = Distribution.Erlang(5, 2) }],
        };
        var analysis = QueueingAnalytics.Analyze(model);
        var wa = analysis.Classes[0].ResponseTime!.Value - 5;
        var wb = analysis.Classes[1].ResponseTime!.Value - 5;
        double ra = 5 / 25.0, rb = 5 / 12.0, rho = ra + rb;
        var w0 = (1 / 25.0 + 1 / 12.0) * 25 * 1.5 / 2;
        Assert.Equal(rho * w0 / (1 - rho), ra * wa + rb * wb, 9);
        Assert.True(wa < wb);
    }

    [Fact]
    public void PreemptivePriority_HighClassSeesItsOwnMM1()
    {
        var model = new QueueingModel
        {
            Classes =
            [
                new CustomerClass { Id = "a", Arrival = Distribution.Exponential(20), Priority = 5, Entry = "n" },
                new CustomerClass { Id = "b", Arrival = Distribution.Exponential(10), Priority = 1, Entry = "n" },
            ],
            Nodes = [new QueueingNode { Id = "n", Discipline = QueueDiscipline.PreemptivePriority, Service = Distribution.Exponential(5) }],
        };
        var analysis = QueueingAnalytics.Analyze(model);
        Assert.Equal(1 / (0.2 - 0.05), analysis.Classes[0].ResponseTime!.Value, 9);
        Assert.Equal(3, analysis.Nodes[0].Metrics.L!.Value, 9); // total L equals M/M/1 with ρ = 0.75
    }

    [Fact]
    public void FiniteSource_MvaAgreesWithTheBirthDeathSolution()
    {
        CustomerClass Machines() => new() { Id = "m", Kind = CustomerClassKind.Closed, Population = 6, Think = Distribution.Exponential(60), Entry = "n" };
        var mva = QueueingAnalytics.Analyze(new QueueingModel { Classes = [Machines()], Nodes = [new QueueingNode { Id = "n", Servers = 2, Service = Distribution.Exponential(15) }] });

        // A capacity equal to the population changes nothing but forces the birth–death solution.
        var bd = QueueingAnalytics.Analyze(new QueueingModel { Classes = [Machines()], Nodes = [new QueueingNode { Id = "n", Servers = 2, Capacity = 6, Service = Distribution.Exponential(15) }] });
        Assert.Equal(bd.Nodes[0].Metrics.L!.Value, mva.Nodes[0].Metrics.L!.Value, 9);
        Assert.Equal(bd.Classes[0].Throughput!.Value, mva.Classes[0].Throughput!.Value, 9);
        Assert.Equal(AnalysisQuality.Exact, mva.Nodes[0].Quality);
    }

    [Fact]
    public void DiscouragedArrivals_FollowTheClosedForm()
    {
        // Joins with probability 1/(w+1), w = queue length: pn = p0 ρⁿ/(n−1)!, p0 = 1/(1 + ρe^ρ), L = p0 ρ e^ρ (ρ + 1).
        var node = Node(Single(Distribution.Exponential(5), new QueueingNode { Id = "n", Service = Distribution.Exponential(6), Balking = BalkingKind.Discouraged }));
        var rho = 1.2;
        var p0 = 1 / (1 + rho * Math.Exp(rho));
        Assert.Equal(p0 * rho * Math.Exp(rho) * (rho + 1), node.Metrics.L!.Value, 9);
        Assert.Equal(1 - p0, node.Metrics.Utilization!.Value, 9);
    }

    [Fact]
    public void JacksonNetwork_SolvesTheTrafficEquations()
    {
        var model = QueueingPresets.Find("jackson")!.Model;
        var analysis = QueueingAnalytics.Analyze(model);
        // λ1 = γ + 0.1 λ2, λ2 = λ1 + λ3, λ3 = 0.2 λ2  →  λ2 = γ / 0.7.
        Assert.Equal(0.1 / 0.7, analysis.Nodes[1].Metrics.ArrivalRate!.Value, 9);
        Assert.All(analysis.Nodes, node => Assert.Equal(AnalysisQuality.Exact, node.Quality));
        Assert.Contains("Джексона", analysis.Network);
    }

    [Fact]
    public void UnstableSystem_IsReported()
    {
        var node = Node(Single(Distribution.Exponential(5), new QueueingNode { Id = "n", Service = Distribution.Exponential(6) }));
        Assert.Equal(AnalysisQuality.Unavailable, node.Quality);
        Assert.Contains(node.Notes, note => note.Contains("ρ"));
    }

    [Fact]
    public void Validation_ReportsInconsistentDescriptions()
    {
        var model = new QueueingModel
        {
            Classes = [new CustomerClass { Id = "c", Arrival = Distribution.Exponential(-1), Entry = "x" }],
            Nodes =
            [
                new QueueingNode { Id = "n", Servers = 2, Discipline = QueueDiscipline.PreemptivePriority, Service = Distribution.Exponential(1), Routes = [new QueueingRoute { Target = "n", Probability = 1 }] },
            ],
        };

        var errors = QueueingGenerator.Validate(model);
        Assert.Contains(errors, error => error.Contains("интервал поступления"));
        Assert.Contains(errors, error => error.Contains("не задан узел"));
        Assert.Contains(errors, error => error.Contains("прерыванием"));
        Assert.Throws<ArgumentException>(() => QueueingGenerator.Generate(model));
    }

    [Fact]
    public void Validation_DetectsNodesWithoutExit()
    {
        var model = new QueueingModel
        {
            Classes = [new CustomerClass { Id = "c", Arrival = Distribution.Exponential(5), Entry = "a" }],
            Nodes =
            [
                new QueueingNode { Id = "a", Service = Distribution.Exponential(1), Routes = [new QueueingRoute { Target = "b", Probability = 1 }] },
                new QueueingNode { Id = "b", Service = Distribution.Exponential(1), Routes = [new QueueingRoute { Target = "a", Probability = 1 }] },
            ],
        };

        Assert.Contains(QueueingGenerator.Validate(model), error => error.Contains("не могут покинуть"));
    }

    [Fact]
    public void Routing_UsesConditionalProbabilities()
    {
        var model = new QueueingModel
        {
            Classes = [new CustomerClass { Id = "c", Arrival = Distribution.Exponential(5), Entry = "a" }],
            Nodes =
            [
                new QueueingNode { Id = "a", Service = Distribution.Exponential(1), Routes = [new QueueingRoute { Target = "b", Probability = 0.5 }, new QueueingRoute { Target = "c", Probability = 0.5 }] },
                new QueueingNode { Id = "b", Service = Distribution.Exponential(1) },
                new QueueingNode { Id = "c", Service = Distribution.Exponential(1) },
            ],
        };

        var text = QueueingGenerator.Generate(model).Text;
        Assert.Contains("TRANSFER  0.5,,Node2_IN", text);
        Assert.Contains("TRANSFER  ,Node3_IN", text);
    }

    [Theory]
    [InlineData(DistributionKind.HyperExponential)]
    [InlineData(DistributionKind.Normal)]
    [InlineData(DistributionKind.LogNormal)]
    [InlineData(DistributionKind.Gamma)]
    [InlineData(DistributionKind.Weibull)]
    [InlineData(DistributionKind.Triangular)]
    public void DistributionMoments_AgreeWithSampling(DistributionKind kind)
    {
        var distribution = kind switch
        {
            DistributionKind.Weibull => Distribution.Weibull(5, 1.7),
            DistributionKind.Triangular => Distribution.Triangular(1, 2, 7),
            DistributionKind.Normal => Distribution.Normal(5, 0.6),
            _ => new Distribution { Kind = kind, Mean = 5, Cv = kind == DistributionKind.HyperExponential ? 1.8 : 0.6 },
        };

        var random = new Random(7);
        var samples = Enumerable.Range(0, 400_000).Select(_ => DistributionMath.Sample(distribution, random)).ToList();
        Assert.Equal(DistributionMath.Mean(distribution), samples.Average(), 1);
        Assert.InRange(samples.Average(x => x * x) / DistributionMath.SecondMoment(distribution), 0.97, 1.03);

        // The transform at s → 0 has slope −E[X].
        var slope = (1 - DistributionMath.Lst(distribution, 1e-4)) / 1e-4;
        Assert.InRange(slope / DistributionMath.Mean(distribution), 0.995, 1.005);
    }
}
