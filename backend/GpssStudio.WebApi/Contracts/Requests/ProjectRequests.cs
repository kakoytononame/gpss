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

public sealed class ApplyFormRequest
{
    /// <summary>Model text of the form (input lines refer to it).</summary>
    public string ModelText { get; init; } = string.Empty;
    public IReadOnlyList<FormInput> Inputs { get; init; } = [];
}

public sealed record ApplyFormResponse(string Text, IReadOnlyList<string> Messages);
