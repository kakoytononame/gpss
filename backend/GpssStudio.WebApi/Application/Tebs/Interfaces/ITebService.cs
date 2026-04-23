using GpssStudio.WebApi.Contracts.Requests;
using GpssStudio.WebApi.Contracts.Responses;

namespace GpssStudio.WebApi.Application.Tebs.Interfaces;

/// <summary>
/// Application service contract for TEB editor operations.
/// </summary>
public interface ITebService
{
    Task<TebClassResponse?> GetClassAsync(string libraryId, Guid classId, CancellationToken cancellationToken);
    Task<TebInstanceResponse?> GetInstanceAsync(string libraryId, Guid classId, Guid instanceId, CancellationToken cancellationToken);
    Task<TebClassResponse> AddParameterAsync(string libraryId, Guid classId, TebParameterUpsertRequest request, CancellationToken cancellationToken);
    Task DeleteParameterAsync(string libraryId, Guid classId, string parameterId, CancellationToken cancellationToken);
    Task<TebClassResponse> UpdateParameterAsync(string libraryId, Guid classId, string parameterId, TebParameterUpsertRequest request, CancellationToken cancellationToken);
    Task<TebClassResponse> MoveParameterAsync(string libraryId, Guid classId, string parameterId, MoveParameterRequest request, CancellationToken cancellationToken);
    Task SetParameterValueAsync(string libraryId, Guid classId, Guid instanceId, string parameterId, ParameterValueUpdateRequest request, CancellationToken cancellationToken);
    Task<TebClassResponse> PatchPropertyAsync(string libraryId, Guid classId, PropertyPatchRequest request, CancellationToken cancellationToken);
    Task<TebClassResponse> UpdateGpssModelAsync(string libraryId, Guid classId, GpssModelUpdateRequest request, CancellationToken cancellationToken);
}
