namespace GpssStudio.WebApi.Contracts.Responses;

/// <summary>Entry of the project list.</summary>
public sealed record ProjectSummaryResponse(string Id, string Name, string? Description, int ModelCount, DateTimeOffset UpdatedAt);

/// <summary>Entry of the result tree (without the payload).</summary>
public sealed record SimulationResultSummary(string Id, string? ProjectId, string Kind, string Name, DateTimeOffset CreatedAt);

public sealed record SimulationResultResponse(string Id, string? ProjectId, string Kind, string Name, DateTimeOffset CreatedAt, System.Text.Json.JsonElement Payload);
