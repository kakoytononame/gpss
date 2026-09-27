namespace GpssStudio.WebApi.Contracts.Requests;

public sealed class SimulationModelRequest
{
    public string Text { get; init; } = string.Empty;
    public string? ModelName { get; init; }
}

public sealed class SimulationCommandRequest
{
    public string Command { get; init; } = string.Empty;
}
