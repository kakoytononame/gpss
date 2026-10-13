namespace GpssStudio.WebApi.Contracts.Responses;

/// <summary>Entry of the project list.</summary>
public sealed record ProjectSummaryResponse(string Id, string Name, string? Description, int ModelCount, DateTimeOffset UpdatedAt);
