using GpssStudio.Simulation.Experiments;
using Microsoft.AspNetCore.Mvc;

namespace GpssStudio.WebApi.Controllers;

/// <summary>
/// Experiments with a model: series over the full factorial plan of factor levels with replications,
/// indicator statistics (95 % confidence intervals) and the best plan point for an objective.
/// </summary>
[ApiController]
[Route("api/alina-gpss/studio/experiments")]
[Produces("application/json")]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
public sealed class ExperimentsController : ControllerBase
{
    private const int MaxModelLength = 1_000_000;

    [HttpPost]
    public ActionResult<ExperimentResult> Run([FromBody] ExperimentRequest request, CancellationToken cancellationToken)
    {
        if (request.ModelText.Length > MaxModelLength)
        {
            throw new ArgumentException("Текст модели слишком большой.");
        }

        return Ok(ExperimentRunner.Run(request, cancellationToken));
    }
}
