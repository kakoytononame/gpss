using GpssStudio.Simulation;
using GpssStudio.WebApi.Application.Common;
using GpssStudio.WebApi.Application.Simulation;
using GpssStudio.WebApi.Contracts.Requests;
using Microsoft.AspNetCore.Mvc;

namespace GpssStudio.WebApi.Controllers;

/// <summary>
/// GPSS simulation: translation, interactive sessions (START, STEP, HALT, CONTINUE, RESET, CLEAR, SHOW)
/// and the standard report.
/// </summary>
[ApiController]
[Route("api/alina-gpss/studio/simulation")]
[Produces("application/json")]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
public sealed class SimulationController : ControllerBase
{
    private const int MaxModelLength = 1_000_000;
    private const int MaxEvaluatedExpressions = 500;
    private readonly SimulationSessionStore _sessions;

    public SimulationController(SimulationSessionStore sessions)
    {
        _sessions = sessions;
    }

    /// <summary>Checks the model text without running it.</summary>
    [HttpPost("translate")]
    public ActionResult<SimulationResult> Translate([FromBody] SimulationModelRequest request)
    {
        ValidateModel(request);
        var model = SimulationSession.Translate(request.Text);
        return Ok(new SimulationResult
        {
            Success = model.Succeeded,
            State = model.Succeeded ? "idle" : "error",
            Errors = model.Errors,
            Journal = model.Succeeded ? [$"Трансляция завершена. Блоков: {model.Blocks.Count}."] : model.Errors.Select(error => $"Ошибка трансляции. {error}").ToList(),
        });
    }

    /// <summary>Translates the model and executes its control statements (like "Create Simulation").</summary>
    [HttpPost("sessions")]
    public ActionResult<SimulationResult> CreateSession([FromBody] SimulationModelRequest request)
    {
        ValidateModel(request);
        if (request.Monitors is { Count: > SimulationSession.MaxMonitors })
        {
            throw new BadRequestException($"Допускается не более {SimulationSession.MaxMonitors} показателей динамики.");
        }

        if (request.MonitorInterval is { } interval && !(interval > 0 && double.IsFinite(interval)))
        {
            throw new BadRequestException("Интервал сбора динамики должен быть положительным числом.");
        }

        return Ok(_sessions.Create(
            request.Text,
            string.IsNullOrWhiteSpace(request.ModelName) ? "Модель" : request.ModelName.Trim(),
            request.BreakpointLines,
            request.Monitors,
            request.MonitorInterval ?? 1));
    }

    /// <summary>Current state and report of a session.</summary>
    [HttpGet("sessions/{sessionId}")]
    public ActionResult<SimulationResult> GetSession([FromRoute] string sessionId)
    {
        var session = RequireSession(sessionId);
        lock (session.SyncRoot)
        {
            return Ok(session.Snapshot());
        }
    }

    /// <summary>Executes a GPSS command in the session.</summary>
    [HttpPost("sessions/{sessionId}/commands")]
    public ActionResult<SimulationResult> Execute([FromRoute] string sessionId, [FromBody] SimulationCommandRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Command))
        {
            throw new BadRequestException("Команда не задана.");
        }

        var session = RequireSession(sessionId);
        lock (session.SyncRoot)
        {
            return Ok(session.Execute(request.Command));
        }
    }

    /// <summary>Values of SNA expressions in the current state (indicators of the dynamic form); null where not computable.</summary>
    [HttpPost("sessions/{sessionId}/evaluate")]
    public ActionResult<IReadOnlyList<double?>> Evaluate([FromRoute] string sessionId, [FromBody] SimulationEvaluateRequest request)
    {
        if (request.Expressions.Count > MaxEvaluatedExpressions)
        {
            throw new BadRequestException($"Допускается не более {MaxEvaluatedExpressions} выражений.");
        }

        var session = RequireSession(sessionId);
        lock (session.SyncRoot)
        {
            return Ok(session.Evaluate(request.Expressions));
        }
    }

    /// <summary>Example models (e.g. the canteen model used as the default project model).</summary>
    [HttpGet("examples")]
    public ActionResult<IReadOnlyList<ExampleModel>> GetExamples() => Ok(ExampleModels.All);

    [HttpGet("examples/{exampleId}")]
    public ActionResult<ExampleModel> GetExample([FromRoute] string exampleId) =>
        Ok(ExampleModels.Find(exampleId) ?? throw new NotFoundException($"Пример {exampleId} не найден."));

    [HttpDelete("sessions/{sessionId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public IActionResult DeleteSession([FromRoute] string sessionId) =>
        _sessions.Remove(sessionId) ? NoContent() : throw new NotFoundException($"Сеанс моделирования {sessionId} не найден.");

    private SimulationSession RequireSession(string sessionId) =>
        _sessions.Find(sessionId) ?? throw new NotFoundException($"Сеанс моделирования {sessionId} не найден или истёк. Запустите моделирование заново.");

    private static void ValidateModel(SimulationModelRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            throw new BadRequestException("Текст модели пуст.");
        }

        if (request.Text.Length > MaxModelLength)
        {
            throw new BadRequestException("Текст модели слишком большой.");
        }
    }
}
