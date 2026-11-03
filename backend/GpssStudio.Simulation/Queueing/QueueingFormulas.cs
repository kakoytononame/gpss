namespace GpssStudio.Simulation.Queueing;

/// <summary>Classical results of queueing theory used by <see cref="QueueingAnalytics"/>.</summary>
public static class QueueingFormulas
{
    /// <summary>Erlang B blocking probability B(c, a) by the stable recurrence.</summary>
    public static double ErlangB(int servers, double load)
    {
        var b = 1.0;
        for (var k = 1; k <= servers; k++)
        {
            b = load * b / (k + load * b);
        }

        return b;
    }

    /// <summary>Erlang C probability of waiting C(c, a), a &lt; c.</summary>
    public static double ErlangC(int servers, double load)
    {
        var b = ErlangB(servers, load);
        return servers * b / (servers - load * (1 - b));
    }

    /// <summary>Mean waiting time of M/M/c: C(c,a)/(cμ − λ).</summary>
    public static double MmcWaiting(int servers, double lambda, double meanService)
    {
        var load = lambda * meanService;
        return ErlangC(servers, load) * meanService / (servers - load);
    }

    /// <summary>Allen–Cunneen approximation of G/G/c (Kingman for one server; exact for M/M/c and M/G/1).</summary>
    public static double AllenCunneen(int servers, double lambda, double meanService, double arrivalScv, double serviceScv) =>
        MmcWaiting(servers, lambda, meanService) * (arrivalScv + serviceScv) / 2;

    /// <summary>Pollaczek–Khinchine mean waiting time of M/G/1.</summary>
    public static double PollaczekKhinchine(double lambda, double meanService, double secondMoment) =>
        lambda * secondMoment / (2 * (1 - lambda * meanService));

    /// <summary>Root σ of σ = A*(μ(1 − σ)) for GI/M/1; null when the iteration does not converge.</summary>
    public static double? GiM1Sigma(Func<double, double> interarrivalLst, double serviceRate)
    {
        var sigma = 0.5;
        for (var iteration = 0; iteration < 100_000; iteration++)
        {
            var next = interarrivalLst(serviceRate * (1 - sigma));
            if (Math.Abs(next - sigma) < 1e-13)
            {
                return next;
            }

            sigma = next;
        }

        return null;
    }

    /// <summary>
    /// Stationary distribution of a birth–death process with rates λ_n (n → n+1) and μ_n (n → n−1), truncated at
    /// <paramref name="maxState"/> or where the probabilities become negligible. Null when it does not converge.
    /// </summary>
    public static double[]? BirthDeath(Func<int, double> birth, Func<int, double> death, int? maxState, int limit = 200_000)
    {
        var weights = new List<double> { 1 };
        var term = 1.0;
        var total = 1.0;
        for (var n = 1; maxState is null ? n <= limit : n <= maxState; n++)
        {
            var mu = death(n);
            var lambda = birth(n - 1);
            if (lambda <= 0)
            {
                break;
            }

            term *= lambda / mu;
            if (double.IsInfinity(term) || double.IsNaN(term))
            {
                return null;
            }

            weights.Add(term);
            total += term;
            if (maxState is null && n > 50 && term / total < 1e-16)
            {
                break;
            }

            if (maxState is null && n == limit)
            {
                return null;
            }
        }

        return weights.Select(weight => weight / total).ToArray();
    }

    /// <summary>
    /// Time-average queue length distribution of M/G/1/K from the embedded chain at departures; <paramref name="arrivals"/>
    /// gives a_k = P(k arrivals during a service).
    /// </summary>
    public static double[] MG1K(int capacity, double rho, Func<int, double> arrivals)
    {
        if (capacity == 1)
        {
            return [1 / (1 + rho), rho / (1 + rho)];
        }

        var size = capacity;
        var a = Enumerable.Range(0, size + 1).Select(arrivals).ToArray();
        var matrix = new double[size, size];
        for (var i = 0; i < size; i++)
        {
            var start = Math.Max(0, i - 1);
            var sum = 0.0;
            for (var j = start; j < size - 1; j++)
            {
                var k = j - start;
                matrix[i, j] = a[k];
                sum += a[k];
            }

            matrix[i, size - 1] = Math.Max(0, 1 - sum);
        }

        // π = πP, Σπ = 1: solve (Pᵀ − I) with the last equation replaced by the normalisation.
        var system = new double[size, size + 1];
        for (var row = 0; row < size; row++)
        {
            for (var column = 0; column < size; column++)
            {
                system[row, column] = matrix[column, row] - (row == column ? 1 : 0);
            }
        }

        for (var column = 0; column < size; column++)
        {
            system[size - 1, column] = 1;
        }

        system[size - 1, size] = 1;
        var pi = Solve(system, size);
        var denominator = pi[0] + rho;
        var result = new double[capacity + 1];
        for (var n = 0; n < capacity; n++)
        {
            result[n] = pi[n] / denominator;
        }

        result[capacity] = Math.Max(0, 1 - 1 / denominator);
        return result;
    }

    /// <summary>Gaussian elimination with partial pivoting of an n × (n + 1) augmented matrix.</summary>
    public static double[] Solve(double[,] system, int n)
    {
        for (var column = 0; column < n; column++)
        {
            var pivot = column;
            for (var row = column + 1; row < n; row++)
            {
                if (Math.Abs(system[row, column]) > Math.Abs(system[pivot, column]))
                {
                    pivot = row;
                }
            }

            if (Math.Abs(system[pivot, column]) < 1e-14)
            {
                throw new InvalidOperationException("Система уравнений вырождена.");
            }

            if (pivot != column)
            {
                for (var k = column; k <= n; k++)
                {
                    (system[column, k], system[pivot, k]) = (system[pivot, k], system[column, k]);
                }
            }

            for (var row = 0; row < n; row++)
            {
                if (row == column || system[row, column] == 0)
                {
                    continue;
                }

                var factor = system[row, column] / system[column, column];
                for (var k = column; k <= n; k++)
                {
                    system[row, k] -= factor * system[column, k];
                }
            }
        }

        var result = new double[n];
        for (var row = 0; row < n; row++)
        {
            result[row] = system[row, n] / system[row, row];
        }

        return result;
    }

    /// <summary>Poisson probability e^(−m) m^k / k!.</summary>
    public static double PoissonProbability(double mean, int k)
    {
        if (mean <= 0)
        {
            return k == 0 ? 1 : 0;
        }

        var log = -mean + k * Math.Log(mean);
        for (var i = 2; i <= k; i++)
        {
            log -= Math.Log(i);
        }

        return Math.Exp(log);
    }
}
