using System.Globalization;
using GpssStudio.Simulation.Queueing;
using Xunit.Abstractions;

namespace GpssStudio.Simulation.Tests;

/// <summary>Every catalogue system is generated, simulated and compared with queueing theory.</summary>
public sealed class QueueingPresetTests(ITestOutputHelper output)
{
    public static TheoryData<string> PresetIds()
    {
        var data = new TheoryData<string>();
        foreach (var preset in QueueingPresets.All)
        {
            data.Add(preset.Id);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(PresetIds))]
    public void Preset_SimulationAgreesWithTheory(string id)
    {
        var preset = QueueingPresets.Find(id)!;
        var result = QueueingRunner.Run(preset.Model);
        var failures = new List<string>();
        foreach (var node in result.Nodes)
        {
            output.WriteLine($"{node.Name}: {node.Analysis.Kendall} [{node.Analysis.Quality}] {node.Analysis.Method}");
            foreach (var note in node.Analysis.Notes)
            {
                output.WriteLine($"   note: {note}");
            }

            foreach (var metric in node.Metrics)
            {
                output.WriteLine(Describe(metric));
                if (node.Analysis.Quality == AnalysisQuality.Exact && metric.Agrees == false && !Tolerated(metric))
                {
                    failures.Add($"{node.Name}.{metric.Key}: {Describe(metric)}");
                }
            }
        }

        foreach (var customerClass in result.Classes)
        {
            output.WriteLine($"class {customerClass.Name} [{customerClass.Quality}]");
            foreach (var metric in customerClass.Metrics)
            {
                output.WriteLine(Describe(metric));
                if (customerClass.Quality == AnalysisQuality.Exact && metric.Agrees == false && !Tolerated(metric))
                {
                    failures.Add($"class {customerClass.Name}.{metric.Key}: {Describe(metric)}");
                }
            }
        }

        output.WriteLine($"{result.ElapsedSeconds:F1} s, {result.Replications} replications. {result.Analysis.Network}");
        Assert.True(failures.Count == 0, string.Join("\n", failures));
    }

    /// <summary>Exact results must lie within 3 confidence half-widths or 4 %.</summary>
    private static bool Tolerated(MetricComparison metric) =>
        metric.Analytic is { } analytic && metric.Mean is { } mean
        && Math.Abs(mean - analytic) <= 3 * (metric.HalfWidth ?? 0) + 0.04 * Math.Abs(analytic) + 1e-4;

    private static string Describe(MetricComparison metric) => string.Create(CultureInfo.InvariantCulture,
        $"   {metric.Key,-18} theory {metric.Analytic,12:F5} sim {metric.Mean,12:F5} ± {metric.HalfWidth,9:F5} dev {metric.Deviation,8:P2} {(metric.Agrees == false ? "!!" : "")}");
}
