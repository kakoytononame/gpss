using System.Text.Json;

namespace GpssStudio.WebApi.Contracts.Requests;

/// <summary>
/// Generic property patch used by the frontend for forms and table collections.
/// </summary>
public sealed class PropertyPatchRequest
{
    public string Path { get; init; } = string.Empty;
    public JsonElement Value { get; init; }
}

/// <summary>
/// GPSS model update payload.
/// </summary>
public sealed class GpssModelUpdateRequest
{
    public string Text { get; init; } = string.Empty;
}

/// <summary>
/// Parameter order change payload.
/// </summary>
public sealed class MoveParameterRequest
{
    public string Direction { get; init; } = "down";
}

/// <summary>
/// Parameter create/update payload.
/// </summary>
public sealed class TebParameterUpsertRequest
{
    public string? Id { get; init; }
    public string? Type { get; init; }
    public string? Header { get; init; }
    public string? NameInModel { get; init; }
    public JsonElement DefaultValue { get; init; }
    public bool AllowEmptyValues { get; init; }
    public JsonElement CurrentValue { get; init; }
}

/// <summary>
/// Runtime parameter value update payload.
/// </summary>
public sealed class ParameterValueUpdateRequest
{
    public JsonElement Value { get; init; }
}

public sealed class ImagePatchItem
{
    public string? ImageName { get; init; }
    public string? ImageUrl { get; init; }
}

public sealed class GpssEntityPatchItem
{
    public string? Id { get; init; }
    public string? Type { get; init; }
    public string? NameInModel { get; init; }
    public JsonElement Value { get; init; }
    public string? Description { get; init; }
}

public sealed class TebPortPatchItem
{
    public string? Id { get; init; }
    public string? NameInModel { get; init; }
    public string? Header { get; init; }
    public string? ConnectedBlock { get; init; }
    public JsonElement ConnectionsLimit { get; init; }
    public string? Description { get; init; }
}

public sealed class TebStatePatchItem
{
    public string? Id { get; init; }
    public string? Name { get; init; }
    public string? Expression { get; init; }
    public string? Description { get; init; }
}
