using System.Collections.Concurrent;
using GpssStudio.Simulation;

namespace GpssStudio.WebApi.Application.Simulation;

/// <summary>
/// Keeps interactive simulation sessions in memory. Idle sessions expire; the number of live
/// sessions is capped so a misbehaving client cannot exhaust the server.
/// </summary>
public sealed class SimulationSessionStore
{
    private static readonly TimeSpan IdleTimeout = TimeSpan.FromHours(2);
    private const int MaxSessions = 64;
    private readonly ConcurrentDictionary<string, SimulationSession> _sessions = new();

    public SimulationResult Create(string text, string modelName, IReadOnlyCollection<int>? breakpointLines = null)
    {
        EvictExpired();
        var (session, result) = SimulationSession.Create(text, modelName, breakpointLines: breakpointLines);

        if (session is not null)
        {
            if (_sessions.Count >= MaxSessions)
            {
                var oldest = _sessions.Values.OrderBy(item => item.LastAccess).First();
                _sessions.TryRemove(oldest.Id, out _);
            }

            _sessions[session.Id] = session;
        }

        return result;
    }

    public SimulationSession? Find(string id)
    {
        EvictExpired();
        return _sessions.GetValueOrDefault(id);
    }

    public bool Remove(string id) => _sessions.TryRemove(id, out _);

    private void EvictExpired()
    {
        var threshold = DateTimeOffset.UtcNow - IdleTimeout;
        foreach (var session in _sessions.Values.Where(item => item.LastAccess < threshold))
        {
            _sessions.TryRemove(session.Id, out _);
        }
    }
}
