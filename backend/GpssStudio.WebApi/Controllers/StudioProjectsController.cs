using GpssStudio.Projects.Generation;
using GpssStudio.Projects.Model;
using GpssStudio.WebApi.Application.Common;
using GpssStudio.WebApi.Application.Projects;
using GpssStudio.WebApi.Contracts.Requests;
using GpssStudio.WebApi.Contracts.Responses;
using Microsoft.AspNetCore.Mvc;

namespace GpssStudio.WebApi.Controllers;

/// <summary>
/// Simulation projects in the GPSS Studio format: import of project archives, project documents
/// (models, structural schemes, TEB libraries) and model generation from schemes.
/// </summary>
[ApiController]
[Route("api/alina-gpss/studio/projects")]
[Produces("application/json")]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
public sealed class StudioProjectsController : ControllerBase
{
    /// <summary>Upload limit for project archives (matches the reverse proxy limit).</summary>
    public const long MaxUploadBytes = 25L * 1024 * 1024;

    private readonly StudioProjectService _projects;

    public StudioProjectsController(StudioProjectService projects)
    {
        _projects = projects;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProjectSummaryResponse>>> List(CancellationToken cancellationToken) =>
        Ok(await _projects.ListAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<StudioProject>> Create([FromBody] CreateProjectRequest request, CancellationToken cancellationToken)
    {
        var project = await _projects.CreateAsync(request.Name, request.Description, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = project.Id }, project);
    }

    /// <summary>Imports a GPSS Studio project: a ZIP archive of the project folder, or a .gps / .txt model file.</summary>
    [HttpPost("import")]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<StudioProject>> Import(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            throw new BadRequestException("Файл проекта не передан.");
        }

        await using var stream = file.OpenReadStream();
        var project = await _projects.ImportAsync(stream, file.FileName, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = project.Id }, project);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StudioProject>> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Ok(await _projects.GetAsync(id, cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<StudioProject>> Save([FromRoute] Guid id, [FromBody] StudioProject project, CancellationToken cancellationToken) =>
        Ok(await _projects.SaveAsync(id, project, cancellationToken));

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        await _projects.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    /// <summary>Generates the GPSS model text from the structural scheme of a stored model.</summary>
    [HttpPost("{id:guid}/models/{modelIndex:int}/generate")]
    public async Task<ActionResult<GenerationResult>> GenerateForModel([FromRoute] Guid id, [FromRoute] int modelIndex, CancellationToken cancellationToken) =>
        Ok(await _projects.GenerateAsync(id, modelIndex, cancellationToken));

    /// <summary>Generates the GPSS model text from a scheme sent in the request (unsaved editor state).</summary>
    [HttpPost("generate")]
    public ActionResult<GenerationResult> Generate([FromBody] GenerateModelRequest request)
    {
        if (request.Scheme is null)
        {
            throw new BadRequestException("Структурная схема не передана.");
        }

        return Ok(StudioProjectService.Generate(request.Scheme, string.IsNullOrWhiteSpace(request.ModelName) ? "Модель" : request.ModelName.Trim()));
    }
}
