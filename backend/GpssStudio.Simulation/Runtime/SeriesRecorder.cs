namespace GpssStudio.Simulation.Runtime;

public sealed record SeriesPoint(double Time, double Value);

/// <summary>
/// Records step-wise time series (queue content, storage occupancy, facility state) for charts.
/// Memory is bounded: when a series grows too long every other point is dropped.
/// </summary>
public sealed class SeriesRecorder
{
    private const int MaxPointsPerSeries = 4000;
    private readonly Dictionary<string, List<SeriesPoint>> _series = new(StringComparer.OrdinalIgnoreCase);

    public IReadOnlyDictionary<string, List<SeriesPoint>> Series => _series;

    public void Record(string key, double time, double value)
    {
        if (!_series.TryGetValue(key, out var points))
        {
            // Entities start empty: anchor the step line at the start of the run.
            points = time > 0 ? [new SeriesPoint(0, 0)] : [];
            _series[key] = points;
        }

        if (points.Count > 0 && points[^1].Time == time)
        {
            points[^1] = new SeriesPoint(time, value);
        }
        else
        {
            points.Add(new SeriesPoint(time, value));
        }

        if (points.Count > MaxPointsPerSeries)
        {
            var thinned = points.Where((_, index) => index % 2 == 0 || index == points.Count - 1).ToList();
            points.Clear();
            points.AddRange(thinned);
        }
    }

    public void Clear() => _series.Clear();
}
