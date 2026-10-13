using GpssStudio.WebApi.Application.Results;
using GpssStudio.WebApi.Contracts.Requests;
using GpssStudio.WebApi.Contracts.Responses;
using Microsoft.AspNetCore.Mvc;

namespace GpssStudio.WebApi.Controllers;

/// <summary>Simulation results of a project: single experiments and series ("дерево результатов").</summary>
[ApiController]
[Route("api/alina-gpss/studio/results")]
[Produces("application/json")]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
public sealed class ResultsController : ControllerBase
{
    private readonly SimulationResultService _results;

    public ResultsController(SimulationResultService results)
    {
        _results = results;
    }

    /// <summary>Results of a project (or results saved without a project when no id is given).</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SimulationResultSummary>>> List([FromQuery] Guid? projectId, CancellationToken cancellationToken) =>
        Ok(await _results.ListAsync(projectId, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SimulationResultResponse>> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Ok(await _results.GetAsync(id, cancellationToken));

    [HttpPost]
    [RequestSizeLimit(SimulationResultService.MaxPayloadLength + 64 * 1024)]
    public async Task<ActionResult<SimulationResultResponse>> Create([FromBody] CreateSimulationResultRequest request, CancellationToken cancellationToken)
    {
        var result = await _results.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<SimulationResultSummary>> Rename([FromRoute] Guid id, [FromBody] RenameSimulationResultRequest request, CancellationToken cancellationToken) =>
        Ok(await _results.RenameAsync(id, request.Name, cancellationToken));

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        await _results.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
