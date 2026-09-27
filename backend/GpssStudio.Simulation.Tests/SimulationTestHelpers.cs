using System.Globalization;
using GpssStudio.Simulation.Reporting;

namespace GpssStudio.Simulation.Tests;

internal static class SimulationTestHelpers
{
    public static (SimulationSession Session, SimulationResult Result) Run(string model)
    {
        var (session, result) = SimulationSession.Create(model, "Тест");
        Assert.True(session is not null, string.Join("\n", result.Journal));
        return (session!, result);
    }

    public static IReadOnlyList<string> Row(SimulationReport report, string sectionId, string name) =>
        report.Sections.Single(section => section.Id == sectionId).Rows.Single(row => row[0] == name);

    public static double Number(string value) => double.Parse(value, CultureInfo.InvariantCulture);
}
