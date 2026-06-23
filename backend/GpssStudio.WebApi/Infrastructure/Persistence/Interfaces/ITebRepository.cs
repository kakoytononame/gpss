using System.Text.Json;
using GpssStudio.WebApi.Application.Tebs;
using GpssStudio.WebApi.Contracts.Requests;

namespace GpssStudio.WebApi.Infrastructure.Persistence.Interfaces;

/// <summary>
/// Persistence contract for TEB editor data.
/// </summary>
public interface ITebRepository
{
    Task<TebClassAggregate?> GetClassAsync(string libraryId, Guid classId, CancellationToken cancellationToken);
    Task<TebInstanceAggregate?> GetInstanceAsync(string libraryId, Guid classId, Guid instanceId, CancellationToken cancellationToken);
    Task<TebClassAggregate> AddParameterAsync(string libraryId, Guid classId, TebParameterUpsertRequest request, CancellationToken cancellationToken);
    Task DeleteParameterAsync(string libraryId, Guid classId, string parameterId, CancellationToken cancellationToken);
    Task<TebClassAggregate> UpdateParameterAsync(string libraryId, Guid classId, string parameterId, TebParameterUpsertRequest request, CancellationToken cancellationToken);
    Task<TebClassAggregate> MoveParameterAsync(string libraryId, Guid classId, string parameterId, string direction, CancellationToken cancellationToken);
    Task SetParameterValueAsync(string libraryId, Guid classId, Guid instanceId, string parameterId, JsonElement value, CancellationToken cancellationToken);
    Task<TebClassAggregate> PatchPropertyAsync(string libraryId, Guid classId, string path, JsonElement value, CancellationToken cancellationToken);
    Task<TebClassAggregate> UpdateGpssModelAsync(string libraryId, Guid classId, string text, CancellationToken cancellationToken);
    Task<WorkspaceSnapshotEntity?> GetWorkspaceSnapshotAsync(string snapshotId, CancellationToken cancellationToken);
    Task<WorkspaceSnapshotEntity> SaveWorkspaceSnapshotAsync(string snapshotId, JsonElement snapshot, CancellationToken cancellationToken);
}
