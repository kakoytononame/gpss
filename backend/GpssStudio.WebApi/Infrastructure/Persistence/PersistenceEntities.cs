namespace GpssStudio.WebApi.Infrastructure.Persistence;

/// <summary>
/// EF Core entity for the <c>teb_classes</c> table.
/// </summary>
public sealed class TebClassEntity
{
    public Guid Id { get; set; }
    public string LibraryId { get; set; } = string.Empty;
    public string ClassType { get; set; } = string.Empty;
    public string NameInModel { get; set; } = string.Empty;
    public string Header { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ImageName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string GpssModelText { get; set; } = string.Empty;
    public string GpssModelMetadata { get; set; } = "{}";
    public List<TebGpssEntityEntity> GpssEntities { get; set; } = [];
    public List<TebPortEntity> Ports { get; set; } = [];
    public List<TebParameterEntity> Parameters { get; set; } = [];
    public List<TebStateEntity> States { get; set; } = [];
    public List<TebInstanceEntity> Instances { get; set; } = [];
}

public sealed class TebGpssEntityEntity
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public int SortOrder { get; set; }
    public string Type { get; set; } = string.Empty;
    public string NameInModel { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TebClassEntity Class { get; set; } = null!;
}

public sealed class TebPortEntity
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public string Direction { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string NameInModel { get; set; } = string.Empty;
    public string Header { get; set; } = string.Empty;
    public string ConnectedBlock { get; set; } = string.Empty;
    public string ConnectionsLimit { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TebClassEntity Class { get; set; } = null!;
}

public sealed class TebParameterEntity
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public int SortOrder { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Header { get; set; } = string.Empty;
    public string NameInModel { get; set; } = string.Empty;
    public string DefaultValue { get; set; } = string.Empty;
    public bool AllowEmptyValues { get; set; }
    public string CurrentValue { get; set; } = string.Empty;
    public TebClassEntity Class { get; set; } = null!;
    public List<TebInstanceParameterValueEntity> InstanceValues { get; set; } = [];
}

public sealed class TebStateEntity
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public int SortOrder { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Expression { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TebClassEntity Class { get; set; } = null!;
}

public sealed class TebInstanceEntity
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public string NameInModel { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public TebClassEntity Class { get; set; } = null!;
    public List<TebInstanceParameterValueEntity> ParameterValues { get; set; } = [];
}

public sealed class TebInstanceParameterValueEntity
{
    public Guid InstanceId { get; set; }
    public Guid ParameterId { get; set; }
    public string Value { get; set; } = string.Empty;
    public TebInstanceEntity Instance { get; set; } = null!;
    public TebParameterEntity Parameter { get; set; } = null!;
}

/// <summary>
/// EF Core entity for serialized frontend workspace state.
/// </summary>
public sealed class WorkspaceSnapshotEntity
{
    public string Id { get; set; } = string.Empty;
    public string SnapshotJson { get; set; } = "{}";
    public DateTimeOffset UpdatedAt { get; set; }
}
