using Xunit.Abstractions;
using GpssStudio.Simulation.Queueing;

namespace GpssStudio.Simulation.Tests;

public sealed class QueueingSmokeTests(ITestOutputHelper output)
{
    [Fact]
    public void AllFeatures_TranslateAndRun()
    {
        var model = new QueueingModel
        {
            Duration = 2000,
            WarmUp = 100,
            Classes =
            [
                new CustomerClass { Id = "a", Name = "A", Arrival = Distribution.Exponential(10), Batch = new BatchSize { Kind = BatchKind.Geometric, Size = 1.5 }, Entry = "n1", Priority = 2 },
                new CustomerClass { Id = "b", Name = "B", Kind = CustomerClassKind.Closed, Population = 3, Think = Distribution.Exponential(50), Entry = "n2",
                    Services = [new ServiceOverride { Node = "n2", Service = Distribution.Erlang(3, 2) }] },
            ],
            Nodes =
            [
                new QueueingNode { Id = "n1", Name = "Касса", Servers = 2, Capacity = 6, Discipline = QueueDiscipline.Lifo, Service = Distribution.HyperExponential(8, 2),
                    Patience = Distribution.Exponential(20), Balking = BalkingKind.Discouraged,
                    Routes = [new QueueingRoute { Target = "n2", Probability = 0.3 }, new QueueingRoute { Target = "n3", Probability = 0.2 }] },
                new QueueingNode { Id = "n2", Servers = 1, Discipline = QueueDiscipline.PreemptivePriority, Service = Distribution.Uniform(1, 5), Vacation = Distribution.Deterministic(2) },
                new QueueingNode { Id = "n3", Servers = 1, Capacity = 1, WhenFull = FullPolicy.Retry, Retrial = Distribution.Exponential(5), Service = Distribution.LogNormal(3, 0.5),
                    TimeToFailure = Distribution.Weibull(200, 1.5), Repair = Distribution.Triangular(1, 2, 6), Routes = [new QueueingRoute { Target = "n4", Probability = 1 }] },
                new QueueingNode { Id = "n4", Servers = 0, Service = Distribution.GammaDistribution(4, 0.5), Routes = [new QueueingRoute { Target = "n5", Probability = 0.5 }] },
                new QueueingNode { Id = "n5", Servers = 2, Discipline = QueueDiscipline.RoundRobin, Quantum = 0.5, Service = Distribution.Normal(3, 0.3) },
                new QueueingNode { Id = "n6", Servers = 1, Discipline = QueueDiscipline.ShortestJob, Service = Distribution.Exponential(1) },
                new QueueingNode { Id = "n7", Servers = 1, Discipline = QueueDiscipline.Random, Balking = BalkingKind.Linear, BalkingThreshold = 4, Service = Distribution.Exponential(1) },
            ],
        };

        var generated = QueueingGenerator.Generate(model);
        output.WriteLine(generated.Text);
        var (session, result) = SimulationSession.Create(generated.Text, "smoke");
        Assert.True(session is not null && result.Success, string.Join("\n", result.Journal.Concat(result.Errors.Select(e => e.ToString()))) + result.RuntimeError);
        Assert.Equal(2100, session!.Engine.AbsoluteClock, 3);
    }
}
