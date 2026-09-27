namespace GpssStudio.Simulation.Runtime;

/// <summary>
/// Independent Lehmer (Park–Miller) generators, one per RN stream, reproducible from the seeds
/// so the same model always gives the same report (as in GPSS World).
/// </summary>
public sealed class RandomStreams
{
    private const long Modulus = 2147483647;
    private const long Multiplier = 48271;
    private readonly Dictionary<int, long> _states = [];
    private readonly Dictionary<int, long> _seeds = [];

    public void Seed(int stream, long seed)
    {
        var normalized = Math.Abs(seed) % Modulus;
        _seeds[stream] = normalized == 0 ? 1 : normalized;
        _states[stream] = _seeds[stream];
    }

    public void Reset()
    {
        _states.Clear();
        foreach (var (stream, seed) in _seeds)
        {
            _states[stream] = seed;
        }
    }

    public double Next(int stream)
    {
        if (!_states.TryGetValue(stream, out var state))
        {
            state = DefaultSeed(stream);
            _seeds.TryAdd(stream, state);
        }

        state = state * Multiplier % Modulus;
        _states[stream] = state;
        return (state - 1) / (double)(Modulus - 1);
    }

    private static long DefaultSeed(int stream) => 37 + 1_000_003L * stream;
}
