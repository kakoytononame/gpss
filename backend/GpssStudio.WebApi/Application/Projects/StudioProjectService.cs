using System.Text.Json;
using GpssStudio.Projects.Generation;
using GpssStudio.Projects.Import;
using GpssStudio.Projects.Model;
using GpssStudio.WebApi.Application.Common;
using GpssStudio.WebApi.Contracts.Responses;
using GpssStudio.WebApi.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GpssStudio.WebApi.Application.Projects;

/// <summary>
/// Simulation projects: import of GPSS Studio project archives, storage of the project document and
/// generation of model texts from structural schemes.
/// </summary>
public sealed class StudioProjectService
{
    private static readonly JsonSerializerOptions DocumentOptions = new() { PropertyNamingPolicy = null };
    private readonly GpssStudioDbContext _db;

    public StudioProjectService(GpssStudioDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<ProjectSummaryResponse>> ListAsync(CancellationToken cancellationToken)
    {
        var entities = await _db.StudioProjects.AsNoTracking().OrderByDescending(project => project.UpdatedAt).ToListAsync(cancellationToken);
        return entities.Select(entity => new ProjectSummaryResponse(entity.Id.ToString(), entity.Name, entity.Description, Deserialize(entity).Models.Count, entity.UpdatedAt)).ToList();
    }

    public async Task<StudioProject> GetAsync(Guid id, CancellationToken cancellationToken) => Deserialize(await RequireAsync(id, cancellationToken));

    public async Task<StudioProject> CreateAsync(string name, string? description, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new BadRequestException("Имя проекта не задано.");
        }

        var project = new StudioProject
        {
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
            Models = [new StudioModel { Name = "Модель 1", IsCurrent = true, Scheme = new TebScheme() }],
        };
        return await InsertAsync(project, cancellationToken);
    }

    /// <summary>Imports a ZIP archive of a GPSS Studio project folder (or a single model text file).</summary>
    public async Task<StudioProject> ImportAsync(Stream content, string fileName, CancellationToken cancellationToken)
    {
        // The upload is buffered: ZIP reading seeks, which request streams do not fully support.
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;

        StudioProject project;
        try
        {
            if (fileName.EndsWith(".gps", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".txt", StringComparison.OrdinalIgnoreCase))
            {
                var modelName = Path.GetFileNameWithoutExtension(fileName);
                project = new StudioProject
                {
                    Name = modelName,
                    Models = [new StudioModel { Name = modelName, IsCurrent = true, ModelText = GpssStudio.Projects.Formats.GpssModelFile.ReadText(buffer.ToArray()) }],
                };
            }
            else
            {
                project = StudioProjectReader.ReadZip(buffer);
            }
        }
        catch (Exception exception) when (exception is InvalidDataException or System.Xml.XmlException or FormatException)
        {
            throw new BadRequestException($"Не удалось прочитать проект: {exception.Message}");
        }

        project.Id = Guid.NewGuid().ToString();
        project.CreatedAt ??= DateTimeOffset.UtcNow;
        return await InsertAsync(project, cancellationToken);
    }

    public async Task<StudioProject> SaveAsync(Guid id, StudioProject project, CancellationToken cancellationToken)
    {
        var entity = await RequireAsync(id, cancellationToken);
        if (string.IsNullOrWhiteSpace(project.Name))
        {
            throw new BadRequestException("Имя проекта не задано.");
        }

        project.Id = id.ToString();
        entity.Name = project.Name;
        entity.Description = project.Description;
        entity.Document = JsonSerializer.Serialize(project, DocumentOptions);
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return project;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        _db.StudioProjects.Remove(await RequireAsync(id, cancellationToken));
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<GenerationResult> GenerateAsync(Guid id, int modelIndex, CancellationToken cancellationToken)
    {
        var project = await GetAsync(id, cancellationToken);
        if (modelIndex < 0 || modelIndex >= project.Models.Count)
        {
            throw new NotFoundException($"Модель {modelIndex} в проекте не найдена.");
        }

        var model = project.Models[modelIndex];
        if (model.Scheme is null)
        {
            throw new BadRequestException($"У модели «{model.Name}» нет структурной схемы.");
        }

        return ModelGenerator.Generate(model.Scheme, model.Name);
    }

    public static GenerationResult Generate(TebScheme scheme, string modelName) => ModelGenerator.Generate(scheme, modelName);

    private async Task<StudioProject> InsertAsync(StudioProject project, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var id = Guid.TryParse(project.Id, out var parsed) ? parsed : Guid.NewGuid();
        if (await _db.StudioProjects.AnyAsync(item => item.Id == id, cancellationToken))
        {
            id = Guid.NewGuid();
        }

        project.Id = id.ToString();
        _db.StudioProjects.Add(new StudioProjectEntity
        {
            Id = id,
            Name = project.Name,
            Description = project.Description,
            Document = JsonSerializer.Serialize(project, DocumentOptions),
            CreatedAt = now,
            UpdatedAt = now,
        });
        await _db.SaveChangesAsync(cancellationToken);
        return project;
    }

    private async Task<StudioProjectEntity> RequireAsync(Guid id, CancellationToken cancellationToken) =>
        await _db.StudioProjects.FirstOrDefaultAsync(project => project.Id == id, cancellationToken)
        ?? throw new NotFoundException($"Проект {id} не найден.");

    private static StudioProject Deserialize(StudioProjectEntity entity) =>
        JsonSerializer.Deserialize<StudioProject>(entity.Document, DocumentOptions) ?? new StudioProject { Id = entity.Id.ToString(), Name = entity.Name };
}
