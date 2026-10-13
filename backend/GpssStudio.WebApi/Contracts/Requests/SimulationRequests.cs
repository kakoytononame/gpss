namespace GpssStudio.WebApi.Contracts.Requests;

public sealed class SimulationModelRequest
{
    public string Text { get; init; } = string.Empty;
    public string? ModelName { get; init; }

    /// <summary>Source lines with breakpoints (stop conditions for any transaction).</summary>
    public IReadOnlyList<int>? BreakpointLines { get; init; }
}

public sealed class SimulationCommandRequest
{
    public string Command { get; init; } = string.Empty;
}
