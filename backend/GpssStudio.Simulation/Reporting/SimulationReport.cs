namespace GpssStudio.Simulation.Reporting;

/// <summary>One table of the standard report (columns follow GPSS World's report layout).</summary>
public sealed class ReportSection
{
    public required string Id { get; init; }
    public required string Label { get; init; }
    public required IReadOnlyList<string> Columns { get; init; }
    public required IReadOnlyList<IReadOnlyList<string>> Rows { get; init; }
}

public sealed record ChartBar(string Name, double Value);

public sealed record ChartSeries(string Kind, string Name, IReadOnlyList<double[]> Points);

public sealed record HistogramBin(string Label, double Frequency);

public sealed record TableHistogram(string Name, double Mean, double StandardDeviation, double Count, IReadOnlyList<HistogramBin> Bins);

/// <summary>Data for the result charts.</summary>
public sealed class SimulationCharts
{
    public IReadOnlyList<ChartSeries> TimeSeries { get; init; } = [];
    public IReadOnlyList<ChartBar> FacilityUtilization { get; init; } = [];
    public IReadOnlyList<ChartBar> QueueAverageContent { get; init; } = [];
    public IReadOnlyList<ChartBar> QueueAverageTime { get; init; } = [];
    public IReadOnlyList<ChartBar> StorageUtilization { get; init; } = [];
    public IReadOnlyList<ChartBar> BlockEntries { get; init; } = [];
    public IReadOnlyList<TableHistogram> Tables { get; init; } = [];
}

public sealed class SimulationReport
{
    public required string ModelName { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public required double StartTime { get; init; }
    public required double EndTime { get; init; }
    public required IReadOnlyList<ReportSection> Sections { get; init; }
    public required SimulationCharts Charts { get; init; }
}
