using GpssStudio.Simulation.Queueing;
using Microsoft.AspNetCore.Mvc;

namespace GpssStudio.WebApi.Controllers;

/// <summary>
/// Queueing systems constructor: a catalogue of classical systems, generation of the GPSS model from a description
/// of customer classes and nodes, queueing theory results and simulation replications compared with them.
/// </summary>
[ApiController]
[Route("api/alina-gpss/studio/queueing")]
[Produces("application/json")]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
public sealed class QueueingController : ControllerBase
{
    public sealed record GeneratedModelResponse(string Text, IReadOnlyList<string> Warnings, IReadOnlyList<GeneratedNode> Nodes, IReadOnlyList<GeneratedClass> Classes);

    /// <summary>Ready-made systems (M/M/1, Erlang B/C, priorities, retrials, networks, ...).</summary>
    [HttpGet("presets")]
    public ActionResult<IReadOnlyList<QueueingPreset>> Presets() => Ok(QueueingPresets.All);

    /// <summary>Problems of a description (an empty list when the model can be generated).</summary>
    [HttpPost("validate")]
    public ActionResult<IReadOnlyList<string>> Validate([FromBody] QueueingModel model) => Ok(QueueingGenerator.Validate(model));

    /// <summary>GPSS World model text of the system.</summary>
    [HttpPost("generate")]
    public ActionResult<GeneratedModelResponse> Generate([FromBody] QueueingModel model)
    {
        var generated = QueueingGenerator.Generate(model);
        return Ok(new GeneratedModelResponse(generated.Text, generated.Warnings, generated.Nodes, generated.Classes));
    }

    /// <summary>Queueing theory: exact results where they exist, approximations otherwise.</summary>
    [HttpPost("analyze")]
    public ActionResult<QueueingAnalysis> Analyze([FromBody] QueueingModel model) => Ok(QueueingAnalytics.Analyze(model));

    /// <summary>Model text, theory and simulation replications (95 % confidence intervals) side by side.</summary>
    [HttpPost("simulate")]
    public ActionResult<QueueingRunResult> Simulate([FromBody] QueueingModel model, CancellationToken cancellationToken) =>
        Ok(QueueingRunner.Run(model, cancellationToken));
}
