using System.Text.Json;
using GpssStudio.WebApi.Application.Common;
using GpssStudio.WebApi.Contracts.Requests;
using GpssStudio.WebApi.Contracts.Responses;
using GpssStudio.WebApi.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GpssStudio.WebApi.Application.Results;

/// <summary>
/// Database of simulation results (GPSS Studio "Результаты"): single experiments and series of
/// experiments, kept per project. The payload (report, input data, dynamics, series table) is stored
/// as JSON produced by the client.
/// </summary>
public sealed class SimulationResultService
{
    public const int MaxPayloadLength = 16 * 1024 * 1024;
    private static readonly HashSet<string> Kinds = ["single", "series"];
    private readonly GpssStudioDbContext _db;

    public SimulationResultService(GpssStudioDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<SimulationResultSummary>> ListAsync(Guid? projectId, CancellationToken cancellationToken)
    {
        var query = _db.SimulationResults.AsNoTracking();
        query = projectId is { } id ? query.Where(item => item.ProjectId == id) : query.Where(item => item.ProjectId == null);
        return await query
            .OrderBy(item => item.CreatedAt)
            .Select(item => new SimulationResultSummary(item.Id.ToString(), item.ProjectId.HasValue ? item.ProjectId.Value.ToString() : null, item.Kind, item.Name, item.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<SimulationResultResponse> GetAsync(Guid id, CancellationToken cancellationToken) => ToResponse(await RequireAsync(id, cancellationToken));

    public async Task<SimulationResultResponse> CreateAsync(CreateSimulationResultRequest request, CancellationToken cancellationToken)
    {
        if (!Kinds.Contains(request.Kind))
        {
            throw new BadRequestException("Вид результата должен быть single или series.");
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BadRequestException("Имя результата не задано.");
        }

        if (request.Payload.ValueKind != JsonValueKind.Object)
        {
            throw new BadRequestException("Содержимое результата должно быть объектом JSON.");
        }

        var payload = request.Payload.GetRawText();
        if (payload.Length > MaxPayloadLength)
        {
            throw new BadRequestException("Результат слишком большой.");
        }

        Guid? projectId = null;
        if (!string.IsNullOrWhiteSpace(request.ProjectId))
        {
            projectId = Guid.TryParse(request.ProjectId, out var parsed) && await _db.StudioProjects.AnyAsync(project => project.Id == parsed, cancellationToken)
                ? parsed
                : throw new NotFoundException($"Проект {request.ProjectId} не найден.");
        }

        var entity = new SimulationResultEntity
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            Kind = request.Kind,
            Name = request.Name.Trim(),
            Payload = payload,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.SimulationResults.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return ToResponse(entity);
    }

    public async Task<SimulationResultSummary> RenameAsync(Guid id, string name, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new BadRequestException("Имя результата не задано.");
        }

        var entity = await RequireAsync(id, cancellationToken);
        entity.Name = name.Trim();
        await _db.SaveChangesAsync(cancellationToken);
        return new SimulationResultSummary(entity.Id.ToString(), entity.ProjectId?.ToString(), entity.Kind, entity.Name, entity.CreatedAt);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        _db.SimulationResults.Remove(await RequireAsync(id, cancellationToken));
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<SimulationResultEntity> RequireAsync(Guid id, CancellationToken cancellationToken) =>
        await _db.SimulationResults.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
        ?? throw new NotFoundException($"Результат {id} не найден.");

    private static SimulationResultResponse ToResponse(SimulationResultEntity entity)
    {
        using var document = JsonDocument.Parse(entity.Payload);
        return new SimulationResultResponse(entity.Id.ToString(), entity.ProjectId?.ToString(), entity.Kind, entity.Name, entity.CreatedAt, document.RootElement.Clone());
    }
}
