namespace GpssStudio.WebApi.Contracts.Requests;

public sealed class SimulationModelRequest
{
    public string Text { get; init; } = string.Empty;
    public string? ModelName { get; init; }

    /// <summary>Source lines with breakpoints (stop conditions for any transaction).</summary>
    public IReadOnlyList<int>? BreakpointLines { get; init; }

    /// <summary>Indicators collected over model time (report series of kind "monitor").</summary>
    public IReadOnlyList<GpssStudio.Simulation.SimulationMonitor>? Monitors { get; init; }

    /// <summary>Sampling interval of <see cref="Monitors"/> in model time units.</summary>
    public double? MonitorInterval { get; init; }
}

public sealed class SimulationEvaluateRequest
{
    /// <summary>GPSS expressions (SNA) evaluated in the current state of the session.</summary>
    public IReadOnlyList<string> Expressions { get; init; } = [];
}

public sealed class SimulationCommandRequest
{
    public string Command { get; init; } = string.Empty;
}
