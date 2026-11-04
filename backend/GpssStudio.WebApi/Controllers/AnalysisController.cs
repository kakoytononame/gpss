using GpssStudio.WebApi.Application.Analysis;
using Microsoft.AspNetCore.Mvc;

namespace GpssStudio.WebApi.Controllers;

/// <summary>Analysis of simulation results: deterministic findings and an optional language-model explanation.</summary>
[ApiController]
[Route("api/alina-gpss/studio/analysis")]
[Produces("application/json")]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
public sealed class AnalysisController(ResultAnalysisService service) : ControllerBase
{
    /// <summary>Whether a language model is configured (provider and model name).</summary>
    [HttpGet("status")]
    public ActionResult<AnalysisStatus> Status() => Ok(service.Status());

    /// <summary>Findings and recommendations for a queueing system, with the last simulation if there is one.</summary>
    [HttpPost("queueing")]
    public async Task<ActionResult<QueueingAnalysisResponse>> Queueing([FromBody] QueueingAnalysisRequest request, CancellationToken cancellationToken) =>
        Ok(await service.AnalyzeAsync(request, cancellationToken));
}
