using System.Text.Json;
using GpssStudio.WebApi.Application.Tebs;
using GpssStudio.WebApi.Contracts.Requests;
using GpssStudio.WebApi.Infrastructure.Persistence.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GpssStudio.WebApi.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for TEB classes, instances and editor mutations.
/// </summary>
public sealed class TebRepository : ITebRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly GpssStudioDbContext _dbContext;

    public TebRepository(GpssStudioDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TebClassAggregate?> GetClassAsync(string libraryId, Guid classId, CancellationToken cancellationToken)
    {
        return await BuildAggregateAsync(libraryId, classId, cancellationToken);
    }

    public async Task<TebInstanceAggregate?> GetInstanceAsync(string libraryId, Guid classId, Guid instanceId, CancellationToken cancellationToken)
    {
        var tebClass = await BuildAggregateAsync(libraryId, classId, cancellationToken);
        if (tebClass is null)
        {
            return null;
        }

        var instance = await _dbContext.TebInstances
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == instanceId && item.ClassId == classId, cancellationToken);

        if (instance is null)
        {
            return null;
        }

        var values = await _dbContext.TebParameters
            .AsNoTracking()
            .Where(item => item.ClassId == classId)
            .OrderBy(item => item.SortOrder)
            .Select(item => new TebParameterValueRecord
            {
                NameInModel = item.NameInModel,
                Value = item.InstanceValues
                    .Where(value => value.InstanceId == instanceId)
                    .Select(value => value.Value)
                    .FirstOrDefault() ?? string.Empty,
            })
            .ToArrayAsync(cancellationToken);

        return new TebInstanceAggregate
        {
            Instance = new TebInstanceRecord
            {
                Id = instance.Id,
                ClassId = instance.ClassId,
                NameInModel = instance.NameInModel,
                Text = instance.Text,
            },
            TebClass = tebClass,
            ParameterValues = values,
        };
    }

    public async Task<TebClassAggregate> AddParameterAsync(string libraryId, Guid classId, TebParameterUpsertRequest request, CancellationToken cancellationToken)
    {
        await EnsureClassExistsAsync(libraryId, classId, cancellationToken);

        var nextOrder = await _dbContext.TebParameters
            .Where(item => item.ClassId == classId)
            .Select(item => (int?)item.SortOrder)
            .MaxAsync(cancellationToken) ?? -1;

        _dbContext.TebParameters.Add(new TebParameterEntity
        {
            Id = ParseGuidOrNew(request.Id),
            ClassId = classId,
            SortOrder = nextOrder + 1,
            Type = request.Type ?? "NumberParameterType",
            Header = request.Header ?? string.Empty,
            NameInModel = request.NameInModel ?? string.Empty,
            DefaultValue = ReadScalar(request.DefaultValue),
            AllowEmptyValues = request.AllowEmptyValues,
            CurrentValue = ReadScalarOrFallback(request.CurrentValue, request.DefaultValue),
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return await RequireAggregateAsync(libraryId, classId, cancellationToken);
    }

    public async Task DeleteParameterAsync(string libraryId, Guid classId, string parameterId, CancellationToken cancellationToken)
    {
        await EnsureClassExistsAsync(libraryId, classId, cancellationToken);
        var parameter = await RequireParameterAsync(classId, parameterId, cancellationToken);

        var instanceValues = await _dbContext.TebInstanceParameterValues
            .Where(item => item.ParameterId == parameter.Id)
            .ToListAsync(cancellationToken);

        _dbContext.TebInstanceParameterValues.RemoveRange(instanceValues);
        _dbContext.TebParameters.Remove(parameter);

        var parametersToShift = await _dbContext.TebParameters
            .Where(item => item.ClassId == classId && item.SortOrder > parameter.SortOrder)
            .ToListAsync(cancellationToken);

        foreach (var item in parametersToShift)
        {
            item.SortOrder -= 1;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<TebClassAggregate> UpdateParameterAsync(string libraryId, Guid classId, string parameterId, TebParameterUpsertRequest request, CancellationToken cancellationToken)
    {
        await EnsureClassExistsAsync(libraryId, classId, cancellationToken);
        var parameter = await RequireParameterAsync(classId, parameterId, cancellationToken);

        parameter.Type = request.Type ?? parameter.Type;
        parameter.Header = request.Header ?? parameter.Header;
        parameter.NameInModel = request.NameInModel ?? parameter.NameInModel;
        parameter.DefaultValue = ReadScalarOrFallback(request.DefaultValue, parameter.DefaultValue);
        parameter.AllowEmptyValues = request.AllowEmptyValues;
        parameter.CurrentValue = ReadScalarOrFallback(request.CurrentValue, parameter.CurrentValue);

        await _dbContext.SaveChangesAsync(cancellationToken);
        return await RequireAggregateAsync(libraryId, classId, cancellationToken);
    }

    public async Task<TebClassAggregate> MoveParameterAsync(string libraryId, Guid classId, string parameterId, string direction, CancellationToken cancellationToken)
    {
        await EnsureClassExistsAsync(libraryId, classId, cancellationToken);
        var parameter = await RequireParameterAsync(classId, parameterId, cancellationToken);

        var neighbor = await _dbContext.TebParameters
            .Where(item => item.ClassId == classId && (direction == "up" ? item.SortOrder < parameter.SortOrder : item.SortOrder > parameter.SortOrder))
            .OrderBy(item => direction == "up" ? -item.SortOrder : item.SortOrder)
            .FirstOrDefaultAsync(cancellationToken);

        if (neighbor is not null)
        {
            (parameter.SortOrder, neighbor.SortOrder) = (neighbor.SortOrder, parameter.SortOrder);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return await RequireAggregateAsync(libraryId, classId, cancellationToken);
    }

    public async Task SetParameterValueAsync(string libraryId, Guid classId, Guid instanceId, string parameterId, JsonElement value, CancellationToken cancellationToken)
    {
        await EnsureClassExistsAsync(libraryId, classId, cancellationToken);
        await EnsureInstanceExistsAsync(classId, instanceId, cancellationToken);
        var parameter = await RequireParameterAsync(classId, parameterId, cancellationToken);

        var entity = await _dbContext.TebInstanceParameterValues
            .SingleOrDefaultAsync(item => item.InstanceId == instanceId && item.ParameterId == parameter.Id, cancellationToken);

        if (entity is null)
        {
            _dbContext.TebInstanceParameterValues.Add(new TebInstanceParameterValueEntity
            {
                InstanceId = instanceId,
                ParameterId = parameter.Id,
                Value = ReadScalar(value),
            });
        }
        else
        {
            entity.Value = ReadScalar(value);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<TebClassAggregate> PatchPropertyAsync(string libraryId, Guid classId, string path, JsonElement value, CancellationToken cancellationToken)
    {
        var tebClass = await RequireClassAsync(libraryId, classId, cancellationToken);

        if (TryApplyCoreField(tebClass, path, value))
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
            return await RequireAggregateAsync(libraryId, classId, cancellationToken);
        }

        if (path == "image")
        {
            var image = JsonSerializer.Deserialize<ImagePatchItem>(value.GetRawText(), JsonOptions) ?? new ImagePatchItem();
            tebClass.ImageName = image.ImageName ?? string.Empty;
            tebClass.ImageUrl = image.ImageUrl;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return await RequireAggregateAsync(libraryId, classId, cancellationToken);
        }

        if (path == "gpssEntities")
        {
            var items = JsonSerializer.Deserialize<List<GpssEntityPatchItem>>(value.GetRawText(), JsonOptions) ?? [];
            await ReplaceGpssEntitiesAsync(classId, items, cancellationToken);
            return await RequireAggregateAsync(libraryId, classId, cancellationToken);
        }

        if (path == "inputs")
        {
            var items = JsonSerializer.Deserialize<List<TebPortPatchItem>>(value.GetRawText(), JsonOptions) ?? [];
            await ReplacePortsAsync(classId, "input", items, cancellationToken);
            return await RequireAggregateAsync(libraryId, classId, cancellationToken);
        }

        if (path == "outputs")
        {
            var items = JsonSerializer.Deserialize<List<TebPortPatchItem>>(value.GetRawText(), JsonOptions) ?? [];
            await ReplacePortsAsync(classId, "output", items, cancellationToken);
            return await RequireAggregateAsync(libraryId, classId, cancellationToken);
        }

        if (path == "states")
        {
            var items = JsonSerializer.Deserialize<List<TebStatePatchItem>>(value.GetRawText(), JsonOptions) ?? [];
            await ReplaceStatesAsync(classId, items, cancellationToken);
            return await RequireAggregateAsync(libraryId, classId, cancellationToken);
        }

        await PatchIndexedCollectionAsync(classId, path, value, cancellationToken);
        return await RequireAggregateAsync(libraryId, classId, cancellationToken);
    }

    public async Task<TebClassAggregate> UpdateGpssModelAsync(string libraryId, Guid classId, string text, CancellationToken cancellationToken)
    {
        var tebClass = await RequireClassAsync(libraryId, classId, cancellationToken);
        tebClass.GpssModelText = text;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return await RequireAggregateAsync(libraryId, classId, cancellationToken);
    }

    private async Task PatchIndexedCollectionAsync(Guid classId, string path, JsonElement value, CancellationToken cancellationToken)
    {
        var match = System.Text.RegularExpressions.Regex.Match(path, @"^(gpssEntities|inputs|outputs|states)\[(\d+)\]$");
        if (!match.Success)
        {
            throw new InvalidOperationException($"Unsupported property path: {path}");
        }

        var collection = match.Groups[1].Value;
        var index = int.Parse(match.Groups[2].Value);

        if (collection == "gpssEntities")
        {
            var items = (await _dbContext.TebGpssEntities.AsNoTracking().Where(item => item.ClassId == classId).OrderBy(item => item.SortOrder).ToListAsync(cancellationToken))
                .Select(ToPatchItem)
                .ToList();
            items[index] = JsonSerializer.Deserialize<GpssEntityPatchItem>(value.GetRawText(), JsonOptions) ?? items[index];
            await ReplaceGpssEntitiesAsync(classId, items, cancellationToken);
            return;
        }

        if (collection == "states")
        {
            var items = (await _dbContext.TebStates.AsNoTracking().Where(item => item.ClassId == classId).OrderBy(item => item.SortOrder).ToListAsync(cancellationToken))
                .Select(ToPatchItem)
                .ToList();
            items[index] = JsonSerializer.Deserialize<TebStatePatchItem>(value.GetRawText(), JsonOptions) ?? items[index];
            await ReplaceStatesAsync(classId, items, cancellationToken);
            return;
        }

        var direction = collection == "inputs" ? "input" : "output";
        var ports = (await _dbContext.TebPorts.AsNoTracking().Where(item => item.ClassId == classId && item.Direction == direction).OrderBy(item => item.SortOrder).ToListAsync(cancellationToken))
            .Select(ToPatchItem)
            .ToList();
        ports[index] = JsonSerializer.Deserialize<TebPortPatchItem>(value.GetRawText(), JsonOptions) ?? ports[index];
        await ReplacePortsAsync(classId, direction, ports, cancellationToken);
    }

    private async Task ReplaceGpssEntitiesAsync(Guid classId, IReadOnlyList<GpssEntityPatchItem> items, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.TebGpssEntities.Where(item => item.ClassId == classId).ToListAsync(cancellationToken);
        _dbContext.TebGpssEntities.RemoveRange(existing);

        _dbContext.TebGpssEntities.AddRange(items.Select((item, index) => new TebGpssEntityEntity
        {
            Id = ParseGuidOrNew(item.Id),
            ClassId = classId,
            SortOrder = index,
            Type = item.Type ?? "Savevalue",
            NameInModel = item.NameInModel ?? string.Empty,
            Value = ReadScalar(item.Value),
            Description = item.Description ?? string.Empty,
        }));

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task ReplacePortsAsync(Guid classId, string direction, IReadOnlyList<TebPortPatchItem> items, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.TebPorts.Where(item => item.ClassId == classId && item.Direction == direction).ToListAsync(cancellationToken);
        _dbContext.TebPorts.RemoveRange(existing);

        _dbContext.TebPorts.AddRange(items.Select((item, index) => new TebPortEntity
        {
            Id = ParseGuidOrNew(item.Id),
            ClassId = classId,
            Direction = direction,
            SortOrder = index,
            NameInModel = item.NameInModel ?? string.Empty,
            Header = item.Header ?? string.Empty,
            ConnectedBlock = item.ConnectedBlock ?? string.Empty,
            ConnectionsLimit = ReadScalar(item.ConnectionsLimit),
            Description = item.Description ?? string.Empty,
        }));

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task ReplaceStatesAsync(Guid classId, IReadOnlyList<TebStatePatchItem> items, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.TebStates.Where(item => item.ClassId == classId).ToListAsync(cancellationToken);
        _dbContext.TebStates.RemoveRange(existing);

        _dbContext.TebStates.AddRange(items.Select((item, index) => new TebStateEntity
        {
            Id = ParseGuidOrNew(item.Id),
            ClassId = classId,
            SortOrder = index,
            Name = item.Name ?? string.Empty,
            Expression = item.Expression ?? string.Empty,
            Description = item.Description ?? string.Empty,
        }));

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<TebClassAggregate?> BuildAggregateAsync(string libraryId, Guid classId, CancellationToken cancellationToken)
    {
        var tebClass = await _dbContext.TebClasses
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.LibraryId == libraryId && item.Id == classId, cancellationToken);

        if (tebClass is null)
        {
            return null;
        }

        var gpssEntities = await _dbContext.TebGpssEntities
            .AsNoTracking()
            .Where(item => item.ClassId == classId)
            .OrderBy(item => item.SortOrder)
            .Select(item => new GpssEntityRecord
            {
                Id = item.Id,
                SortOrder = item.SortOrder,
                Type = item.Type,
                NameInModel = item.NameInModel,
                Value = item.Value,
                Description = item.Description,
            })
            .ToArrayAsync(cancellationToken);

        var inputs = await LoadPortsAsync(classId, "input", cancellationToken);
        var outputs = await LoadPortsAsync(classId, "output", cancellationToken);

        var parameters = await _dbContext.TebParameters
            .AsNoTracking()
            .Where(item => item.ClassId == classId)
            .OrderBy(item => item.SortOrder)
            .Select(item => new TebParameterRecord
            {
                Id = item.Id,
                SortOrder = item.SortOrder,
                Type = item.Type,
                Header = item.Header,
                NameInModel = item.NameInModel,
                DefaultValue = item.DefaultValue,
                AllowEmptyValues = item.AllowEmptyValues,
                CurrentValue = item.CurrentValue,
            })
            .ToArrayAsync(cancellationToken);

        var states = await _dbContext.TebStates
            .AsNoTracking()
            .Where(item => item.ClassId == classId)
            .OrderBy(item => item.SortOrder)
            .Select(item => new TebStateRecord
            {
                Id = item.Id,
                SortOrder = item.SortOrder,
                Name = item.Name,
                Expression = item.Expression,
                Description = item.Description,
            })
            .ToArrayAsync(cancellationToken);

        return new TebClassAggregate
        {
            Class = new TebClassRecord
            {
                Id = tebClass.Id,
                LibraryId = tebClass.LibraryId,
                Type = tebClass.ClassType,
                NameInModel = tebClass.NameInModel,
                Header = tebClass.Header,
                Description = tebClass.Description,
                ImageName = tebClass.ImageName,
                ImageUrl = tebClass.ImageUrl,
                GpssModelText = tebClass.GpssModelText,
                GpssModelMetadataJson = tebClass.GpssModelMetadata,
            },
            GpssEntities = gpssEntities,
            Inputs = inputs,
            Outputs = outputs,
            Parameters = parameters,
            States = states,
        };
    }

    private async Task<IReadOnlyList<TebPortRecord>> LoadPortsAsync(Guid classId, string direction, CancellationToken cancellationToken)
    {
        return await _dbContext.TebPorts
            .AsNoTracking()
            .Where(item => item.ClassId == classId && item.Direction == direction)
            .OrderBy(item => item.SortOrder)
            .Select(item => new TebPortRecord
            {
                Id = item.Id,
                SortOrder = item.SortOrder,
                Direction = item.Direction,
                NameInModel = item.NameInModel,
                Header = item.Header,
                ConnectedBlock = item.ConnectedBlock,
                ConnectionsLimit = item.ConnectionsLimit,
                Description = item.Description,
            })
            .ToArrayAsync(cancellationToken);
    }

    private async Task<TebClassAggregate> RequireAggregateAsync(string libraryId, Guid classId, CancellationToken cancellationToken)
    {
        return await BuildAggregateAsync(libraryId, classId, cancellationToken)
               ?? throw new InvalidOperationException("TEB class not found.");
    }

    private async Task EnsureClassExistsAsync(string libraryId, Guid classId, CancellationToken cancellationToken)
    {
        var exists = await _dbContext.TebClasses.AnyAsync(item => item.LibraryId == libraryId && item.Id == classId, cancellationToken);
        if (!exists)
        {
            throw new InvalidOperationException("TEB class not found.");
        }
    }

    private async Task<TebClassEntity> RequireClassAsync(string libraryId, Guid classId, CancellationToken cancellationToken)
    {
        return await _dbContext.TebClasses.SingleOrDefaultAsync(item => item.LibraryId == libraryId && item.Id == classId, cancellationToken)
               ?? throw new InvalidOperationException("TEB class not found.");
    }

    private async Task EnsureInstanceExistsAsync(Guid classId, Guid instanceId, CancellationToken cancellationToken)
    {
        var exists = await _dbContext.TebInstances.AnyAsync(item => item.Id == instanceId && item.ClassId == classId, cancellationToken);
        if (!exists)
        {
            throw new InvalidOperationException("TEB instance not found.");
        }
    }

    private async Task<TebParameterEntity> RequireParameterAsync(Guid classId, string parameterId, CancellationToken cancellationToken)
    {
        if (int.TryParse(parameterId, out var index))
        {
            return await _dbContext.TebParameters
                       .Where(item => item.ClassId == classId)
                       .OrderBy(item => item.SortOrder)
                       .Skip(index)
                       .FirstOrDefaultAsync(cancellationToken)
                   ?? throw new InvalidOperationException("Parameter not found.");
        }

        var guid = Guid.Parse(parameterId);
        return await _dbContext.TebParameters.SingleOrDefaultAsync(item => item.Id == guid && item.ClassId == classId, cancellationToken)
               ?? throw new InvalidOperationException("Parameter not found.");
    }

    private static bool TryApplyCoreField(TebClassEntity entity, string path, JsonElement value)
    {
        var scalar = ReadScalar(value);
        switch (path)
        {
            case "nameInModel":
                entity.NameInModel = scalar;
                return true;
            case "header":
                entity.Header = scalar;
                return true;
            case "description":
                entity.Description = scalar;
                return true;
            case "type":
                entity.ClassType = scalar;
                return true;
            case "imageName":
                entity.ImageName = scalar;
                return true;
            case "imageUrl":
                entity.ImageUrl = scalar;
                return true;
            default:
                return false;
        }
    }

    private static Guid ParseGuidOrNew(string? value)
    {
        return Guid.TryParse(value, out var guid) ? guid : Guid.NewGuid();
    }

    private static string ReadScalar(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString() ?? string.Empty,
            JsonValueKind.Number => element.ToString(),
            JsonValueKind.True => bool.TrueString.ToLowerInvariant(),
            JsonValueKind.False => bool.FalseString.ToLowerInvariant(),
            JsonValueKind.Null or JsonValueKind.Undefined => string.Empty,
            _ => element.ToString(),
        };
    }

    private static string ReadScalarOrFallback(JsonElement element, JsonElement fallback)
    {
        var value = ReadScalar(element);
        return string.IsNullOrWhiteSpace(value) ? ReadScalar(fallback) : value;
    }

    private static string ReadScalarOrFallback(JsonElement element, string fallback)
    {
        var value = ReadScalar(element);
        return string.IsNullOrWhiteSpace(value) ? fallback : value;
    }

    private static GpssEntityPatchItem ToPatchItem(TebGpssEntityEntity entity)
    {
        return new GpssEntityPatchItem
        {
            Id = entity.Id.ToString(),
            Type = entity.Type,
            NameInModel = entity.NameInModel,
            Value = JsonSerializer.SerializeToElement(entity.Value),
            Description = entity.Description,
        };
    }

    private static TebPortPatchItem ToPatchItem(TebPortEntity entity)
    {
        return new TebPortPatchItem
        {
            Id = entity.Id.ToString(),
            NameInModel = entity.NameInModel,
            Header = entity.Header,
            ConnectedBlock = entity.ConnectedBlock,
            ConnectionsLimit = JsonSerializer.SerializeToElement(entity.ConnectionsLimit),
            Description = entity.Description,
        };
    }

    private static TebStatePatchItem ToPatchItem(TebStateEntity entity)
    {
        return new TebStatePatchItem
        {
            Id = entity.Id.ToString(),
            Name = entity.Name,
            Expression = entity.Expression,
            Description = entity.Description,
        };
    }
}
