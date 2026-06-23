namespace GpssStudio.WebApi.Application.Tebs;

/// <summary>
/// Internal class aggregate loaded from PostgreSQL.
/// </summary>
public sealed class TebClassAggregate
{
    public required TebClassRecord Class { get; init; }
    public IReadOnlyList<GpssEntityRecord> GpssEntities { get; init; } = [];
    public IReadOnlyList<TebPortRecord> Inputs { get; init; } = [];
    public IReadOnlyList<TebPortRecord> Outputs { get; init; } = [];
    public IReadOnlyList<TebParameterRecord> Parameters { get; init; } = [];
    public IReadOnlyList<TebStateRecord> States { get; init; } = [];
}

public sealed class TebClassRecord
{
    public Guid Id { get; init; }
    public string LibraryId { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string NameInModel { get; init; } = string.Empty;
    public string Header { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string ImageName { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public string GpssModelText { get; init; } = string.Empty;
    public string GpssModelMetadataJson { get; init; } = "{}";
}

public sealed class GpssEntityRecord
{
    public Guid Id { get; init; }
    public int SortOrder { get; init; }
    public string Type { get; init; } = string.Empty;
    public string NameInModel { get; init; } = string.Empty;
    public string Value { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
}

public sealed class TebPortRecord
{
    public Guid Id { get; init; }
    public int SortOrder { get; init; }
    public string Direction { get; init; } = string.Empty;
    public string NameInModel { get; init; } = string.Empty;
    public string Header { get; init; } = string.Empty;
    public string ConnectedBlock { get; init; } = string.Empty;
    public string ConnectionsLimit { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
}

public sealed class TebParameterRecord
{
    public Guid Id { get; init; }
    public int SortOrder { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Header { get; init; } = string.Empty;
    public string NameInModel { get; init; } = string.Empty;
    public string DefaultValue { get; init; } = string.Empty;
    public bool AllowEmptyValues { get; init; }
    public string CurrentValue { get; init; } = string.Empty;
}

public sealed class TebStateRecord
{
    public Guid Id { get; init; }
    public int SortOrder { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Expression { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
}

public sealed class TebInstanceAggregate
{
    public required TebInstanceRecord Instance { get; init; }
    public required TebClassAggregate TebClass { get; init; }
    public IReadOnlyList<TebParameterValueRecord> ParameterValues { get; init; } = [];
}

public sealed class TebInstanceRecord
{
    public Guid Id { get; init; }
    public Guid ClassId { get; init; }
    public string NameInModel { get; init; } = string.Empty;
    public string Text { get; init; } = string.Empty;
}

public sealed class TebParameterValueRecord
{
    public string NameInModel { get; init; } = string.Empty;
    public string Value { get; init; } = string.Empty;
}
