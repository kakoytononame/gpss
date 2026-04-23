using System.Text.Json;

namespace GpssStudio.WebApi.Contracts.Responses;

/// <summary>
/// Serialized TEB class response returned to the frontend.
/// </summary>
public sealed class TebClassResponse
{
    public Guid ClassId { get; init; }
    public string LibraryId { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string NameInModel { get; init; } = string.Empty;
    public string Header { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string ImageName { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public GpssModelResponse GpssModel { get; init; } = new();
    public IReadOnlyList<GpssEntityResponse> GpssEntities { get; init; } = [];
    public IReadOnlyList<TebPortResponse> Inputs { get; init; } = [];
    public IReadOnlyList<TebPortResponse> Outputs { get; init; } = [];
    public IReadOnlyList<TebParameterResponse> Parameters { get; init; } = [];
    public IReadOnlyList<TebStateResponse> States { get; init; } = [];
}

public sealed class GpssModelResponse
{
    public JsonElement Metadata { get; init; }
    public string Text { get; init; } = string.Empty;
}

public sealed class GpssEntityResponse
{
    public Guid Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string NameInModel { get; init; } = string.Empty;
    public string Value { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
}

public sealed class TebPortResponse
{
    public Guid Id { get; init; }
    public string NameInModel { get; init; } = string.Empty;
    public string Header { get; init; } = string.Empty;
    public string ConnectedBlock { get; init; } = string.Empty;
    public string ConnectionsLimit { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
}

public sealed class TebParameterResponse
{
    public Guid Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Header { get; init; } = string.Empty;
    public string NameInModel { get; init; } = string.Empty;
    public string DefaultValue { get; init; } = string.Empty;
    public bool AllowEmptyValues { get; init; }
}

public sealed class TebStateResponse
{
    public Guid Id { get; init; }
    public string Header { get; init; } = string.Empty;
    public string NameInModel { get; init; } = string.Empty;
    public string Expression { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
}

/// <summary>
/// Serialized TEB instance response returned to the frontend.
/// </summary>
public sealed class TebInstanceResponse
{
    public Guid Id { get; init; }
    public string NameInModel { get; init; } = string.Empty;
    public string Text { get; init; } = string.Empty;
    public IReadOnlyList<TebParameterValueResponse> ParameterValues { get; init; } = [];
    public TebClassResponse Class { get; init; } = new();
}

public sealed class TebParameterValueResponse
{
    public string NameInModel { get; init; } = string.Empty;
    public string Value { get; init; } = string.Empty;
}
