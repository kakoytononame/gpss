using System.Text.Json;
using GpssStudio.WebApi.Contracts.Responses;

namespace GpssStudio.WebApi.Application.Tebs;

/// <summary>
/// Converts internal aggregates into API response DTOs.
/// </summary>
public static class TebResponseMapper
{
    public static TebClassResponse ToClassResponse(this TebClassAggregate aggregate)
    {
        return new TebClassResponse
        {
            ClassId = aggregate.Class.Id,
            LibraryId = aggregate.Class.LibraryId,
            Type = aggregate.Class.Type,
            NameInModel = aggregate.Class.NameInModel,
            Header = aggregate.Class.Header,
            Description = aggregate.Class.Description,
            ImageName = aggregate.Class.ImageName,
            ImageUrl = aggregate.Class.ImageUrl,
            GpssModel = new GpssModelResponse
            {
                Metadata = ParseJson(aggregate.Class.GpssModelMetadataJson),
                Text = aggregate.Class.GpssModelText,
            },
            GpssEntities = aggregate.GpssEntities.Select(entity => new GpssEntityResponse
            {
                Id = entity.Id,
                Type = entity.Type,
                NameInModel = entity.NameInModel,
                Value = entity.Value,
                Description = entity.Description,
            }).ToArray(),
            Inputs = aggregate.Inputs.Select(port => new TebPortResponse
            {
                Id = port.Id,
                NameInModel = port.NameInModel,
                Header = port.Header,
                ConnectedBlock = port.ConnectedBlock,
                ConnectionsLimit = port.ConnectionsLimit,
                Description = port.Description,
            }).ToArray(),
            Outputs = aggregate.Outputs.Select(port => new TebPortResponse
            {
                Id = port.Id,
                NameInModel = port.NameInModel,
                Header = port.Header,
                ConnectedBlock = port.ConnectedBlock,
                ConnectionsLimit = port.ConnectionsLimit,
                Description = port.Description,
            }).ToArray(),
            Parameters = aggregate.Parameters.Select(parameter => new TebParameterResponse
            {
                Id = parameter.Id,
                Type = parameter.Type,
                Header = parameter.Header,
                NameInModel = parameter.NameInModel,
                DefaultValue = parameter.DefaultValue,
                AllowEmptyValues = parameter.AllowEmptyValues,
            }).ToArray(),
            States = aggregate.States.Select(state => new TebStateResponse
            {
                Id = state.Id,
                Header = state.Name,
                NameInModel = state.Name,
                Expression = state.Expression,
                Description = state.Description,
            }).ToArray(),
        };
    }

    public static TebInstanceResponse ToInstanceResponse(this TebInstanceAggregate aggregate)
    {
        return new TebInstanceResponse
        {
            Id = aggregate.Instance.Id,
            NameInModel = aggregate.Instance.NameInModel,
            Text = aggregate.Instance.Text,
            ParameterValues = aggregate.ParameterValues.Select(value => new TebParameterValueResponse
            {
                NameInModel = value.NameInModel,
                Value = value.Value,
            }).ToArray(),
            Class = aggregate.TebClass.ToClassResponse(),
        };
    }

    private static JsonElement ParseJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return JsonSerializer.SerializeToElement(new { });
        }

        return JsonSerializer.Deserialize<JsonElement>(json);
    }
}
