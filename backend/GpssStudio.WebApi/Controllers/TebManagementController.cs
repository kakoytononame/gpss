using GpssStudio.WebApi.Application.Tebs.Interfaces;
using GpssStudio.WebApi.Contracts.Requests;
using Microsoft.AspNetCore.Mvc;

namespace GpssStudio.WebApi.Controllers;

/// <summary>
/// HTTP endpoints for the TEB editor.
/// </summary>
[ApiController]
[Route("api/alina-gpss/studio/tebs")]
public sealed class TebManagementController : ControllerBase
{
    private readonly ITebService _tebService;

    public TebManagementController(ITebService tebService)
    {
        _tebService = tebService;
    }

    /// <summary>
    /// Returns a TEB class with all editable collections.
    /// </summary>
    [HttpGet("libraries/{libraryId}/classes/{classId:guid}")]
    public async Task<IActionResult> GetClass([FromRoute] string libraryId, [FromRoute] Guid classId, CancellationToken cancellationToken)
    {
        var result = await _tebService.GetClassAsync(libraryId, classId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Returns a TEB instance together with class metadata.
    /// </summary>
    [HttpGet("libraries/{libraryId}/classes/{classId:guid}/instances/{instanceId:guid}")]
    public async Task<IActionResult> GetInstance([FromRoute] string libraryId, [FromRoute] Guid classId, [FromRoute] Guid instanceId, CancellationToken cancellationToken)
    {
        var result = await _tebService.GetInstanceAsync(libraryId, classId, instanceId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Adds a new parameter definition.
    /// </summary>
    [HttpPost("libraries/{libraryId}/classes/{classId:guid}/parameters")]
    public async Task<IActionResult> AddParameter([FromRoute] string libraryId, [FromRoute] Guid classId, [FromBody] TebParameterUpsertRequest request, CancellationToken cancellationToken)
    {
        var result = await _tebService.AddParameterAsync(libraryId, classId, request, cancellationToken);
        return CreatedAtAction(nameof(GetClass), new { libraryId, classId }, result);
    }

    /// <summary>
    /// Removes a parameter definition.
    /// </summary>
    [HttpDelete("libraries/{libraryId}/classes/{classId:guid}/parameters/{parameterId}")]
    public async Task<IActionResult> DeleteParameter([FromRoute] string libraryId, [FromRoute] Guid classId, [FromRoute] string parameterId, CancellationToken cancellationToken)
    {
        await _tebService.DeleteParameterAsync(libraryId, classId, parameterId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Updates a parameter definition.
    /// </summary>
    [HttpPatch("libraries/{libraryId}/classes/{classId:guid}/parameters/{parameterId}")]
    public async Task<IActionResult> UpdateParameter([FromRoute] string libraryId, [FromRoute] Guid classId, [FromRoute] string parameterId, [FromBody] TebParameterUpsertRequest request, CancellationToken cancellationToken)
    {
        var result = await _tebService.UpdateParameterAsync(libraryId, classId, parameterId, request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Reorders a parameter definition.
    /// </summary>
    [HttpPost("libraries/{libraryId}/classes/{classId:guid}/parameters/{parameterId}/move")]
    public async Task<IActionResult> MoveParameter([FromRoute] string libraryId, [FromRoute] Guid classId, [FromRoute] string parameterId, [FromBody] MoveParameterRequest request, CancellationToken cancellationToken)
    {
        var result = await _tebService.MoveParameterAsync(libraryId, classId, parameterId, request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Stores the runtime value of a parameter for a concrete instance.
    /// </summary>
    [HttpPut("libraries/{libraryId}/classes/{classId:guid}/instances/{instanceId:guid}/parameters/{parameterId}/value")]
    public async Task<IActionResult> SetParameterValue([FromRoute] string libraryId, [FromRoute] Guid classId, [FromRoute] Guid instanceId, [FromRoute] string parameterId, [FromBody] ParameterValueUpdateRequest request, CancellationToken cancellationToken)
    {
        await _tebService.SetParameterValueAsync(libraryId, classId, instanceId, parameterId, request, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Applies a generic property patch.
    /// </summary>
    [HttpPatch("libraries/{libraryId}/classes/{classId:guid}/properties")]
    public async Task<IActionResult> PatchProperty([FromRoute] string libraryId, [FromRoute] Guid classId, [FromBody] PropertyPatchRequest request, CancellationToken cancellationToken)
    {
        var result = await _tebService.PatchPropertyAsync(libraryId, classId, request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Updates GPSS model text.
    /// </summary>
    [HttpPut("libraries/{libraryId}/classes/{classId:guid}/gpss-model")]
    public async Task<IActionResult> UpdateGpssModel([FromRoute] string libraryId, [FromRoute] Guid classId, [FromBody] GpssModelUpdateRequest request, CancellationToken cancellationToken)
    {
        var result = await _tebService.UpdateGpssModelAsync(libraryId, classId, request, cancellationToken);
        return Ok(result);
    }
}
