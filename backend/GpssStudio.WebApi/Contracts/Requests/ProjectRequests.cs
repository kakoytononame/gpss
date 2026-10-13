using GpssStudio.Projects.Model;

namespace GpssStudio.WebApi.Contracts.Requests;

public sealed class CreateProjectRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
}

public sealed class GenerateModelRequest
{
    public string? ModelName { get; init; }
    public TebScheme? Scheme { get; init; }
}
