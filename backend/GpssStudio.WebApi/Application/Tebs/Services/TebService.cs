using GpssStudio.WebApi.Application.Tebs.Interfaces;
using GpssStudio.WebApi.Contracts.Requests;
using GpssStudio.WebApi.Contracts.Responses;
using GpssStudio.WebApi.Infrastructure.Persistence.Interfaces;

namespace GpssStudio.WebApi.Application.Tebs.Services;

/// <summary>
/// Application service that orchestrates repository work and response mapping.
/// </summary>
public sealed class TebService : ITebService
{
    private readonly ITebRepository _repository;

    public TebService(ITebRepository repository)
    {
        _repository = repository;
    }

    public async Task<TebClassResponse?> GetClassAsync(string libraryId, Guid classId, CancellationToken cancellationToken)
    {
        var aggregate = await _repository.GetClassAsync(libraryId, classId, cancellationToken);
        return aggregate?.ToClassResponse();
    }

    public async Task<TebInstanceResponse?> GetInstanceAsync(string libraryId, Guid classId, Guid instanceId, CancellationToken cancellationToken)
    {
        var aggregate = await _repository.GetInstanceAsync(libraryId, classId, instanceId, cancellationToken);
        return aggregate?.ToInstanceResponse();
    }

    public async Task<TebClassResponse> AddParameterAsync(string libraryId, Guid classId, TebParameterUpsertRequest request, CancellationToken cancellationToken)
    {
        var aggregate = await _repository.AddParameterAsync(libraryId, classId, request, cancellationToken);
        return aggregate.ToClassResponse();
    }

    public Task DeleteParameterAsync(string libraryId, Guid classId, string parameterId, CancellationToken cancellationToken)
    {
        return _repository.DeleteParameterAsync(libraryId, classId, parameterId, cancellationToken);
    }

    public async Task<TebClassResponse> UpdateParameterAsync(string libraryId, Guid classId, string parameterId, TebParameterUpsertRequest request, CancellationToken cancellationToken)
    {
        var aggregate = await _repository.UpdateParameterAsync(libraryId, classId, parameterId, request, cancellationToken);
        return aggregate.ToClassResponse();
    }

    public async Task<TebClassResponse> MoveParameterAsync(string libraryId, Guid classId, string parameterId, MoveParameterRequest request, CancellationToken cancellationToken)
    {
        var aggregate = await _repository.MoveParameterAsync(libraryId, classId, parameterId, request.Direction == "up" ? "up" : "down", cancellationToken);
        return aggregate.ToClassResponse();
    }

    public Task SetParameterValueAsync(string libraryId, Guid classId, Guid instanceId, string parameterId, ParameterValueUpdateRequest request, CancellationToken cancellationToken)
    {
        return _repository.SetParameterValueAsync(libraryId, classId, instanceId, parameterId, request.Value, cancellationToken);
    }

    public async Task<TebClassResponse> PatchPropertyAsync(string libraryId, Guid classId, PropertyPatchRequest request, CancellationToken cancellationToken)
    {
        var aggregate = await _repository.PatchPropertyAsync(libraryId, classId, request.Path, request.Value, cancellationToken);
        return aggregate.ToClassResponse();
    }

    public async Task<TebClassResponse> UpdateGpssModelAsync(string libraryId, Guid classId, GpssModelUpdateRequest request, CancellationToken cancellationToken)
    {
        var aggregate = await _repository.UpdateGpssModelAsync(libraryId, classId, request.Text, cancellationToken);
        return aggregate.ToClassResponse();
    }
}
