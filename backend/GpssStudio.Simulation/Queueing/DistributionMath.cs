using System.Globalization;

namespace GpssStudio.Simulation.Queueing;

/// <summary>Moments, Laplace–Stieltjes transforms, sampling and GPSS World expressions of the interval distributions.</summary>
public static class DistributionMath
{
    public static string Format(double value) => value.ToString("0.########", CultureInfo.InvariantCulture);

    /// <summary>Validation message for an invalid distribution, or null.</summary>
    public static string? Validate(Distribution d, bool allowZero = false)
    {
        bool Positive(double value) => value > 0 && double.IsFinite(value);
        return d.Kind switch
        {
            DistributionKind.Exponential => Positive(d.Mean) ? null : "среднее должно быть положительным",
            DistributionKind.Deterministic => d.Mean > 0 || (allowZero && d.Mean == 0) ? null : "значение должно быть положительным",
            DistributionKind.Erlang => !Positive(d.Mean) ? "среднее должно быть положительным"
                : d.Shape < 1 || d.Shape > 100 || d.Shape != Math.Floor(d.Shape) ? "число фаз Эрланга — целое от 1 до 100" : null,
            DistributionKind.HyperExponential => !Positive(d.Mean) ? "среднее должно быть положительным"
                : d.Cv < 1 || d.Cv > 20 ? "коэффициент вариации гиперэкспоненциального распределения — от 1 до 20" : null,
            DistributionKind.Uniform => d.Min < 0 || !(d.Max > d.Min) ? "нужно 0 ≤ минимум < максимум" : null,
            DistributionKind.Normal or DistributionKind.LogNormal or DistributionKind.Gamma => !Positive(d.Mean) ? "среднее должно быть положительным"
                : !Positive(d.Cv) || d.Cv > 10 ? "коэффициент вариации — положительное число не больше 10" : null,
            DistributionKind.Triangular => d.Min < 0 || d.Mode < d.Min || d.Max < d.Mode || !(d.Max > d.Min) ? "нужно 0 ≤ минимум ≤ мода ≤ максимум, минимум < максимум" : null,
            DistributionKind.Weibull => !Positive(d.Mean) ? "среднее должно быть положительным"
                : d.Shape < 0.2 || d.Shape > 50 ? "параметр формы Вейбулла — от 0,2 до 50" : null,
            _ => "неизвестный вид распределения",
        };
    }

    /// <summary>Kendall code: M, D, Ek, H2, U, N, LN, T, Γ, W.</summary>
    public static string Code(Distribution d) => d.Kind switch
    {
        DistributionKind.Exponential => "M",
        DistributionKind.Deterministic => "D",
        DistributionKind.Erlang => $"E{(int)d.Shape}",
        DistributionKind.HyperExponential => "H2",
        DistributionKind.Uniform => "U",
        DistributionKind.Normal => "N",
        DistributionKind.LogNormal => "LN",
        DistributionKind.Triangular => "T",
        DistributionKind.Gamma => "Γ",
        DistributionKind.Weibull => "W",
        _ => "G",
    };

    /// <summary>Short description such as "экспоненциальное, среднее 10".</summary>
    public static string Describe(Distribution d) => d.Kind switch
    {
        DistributionKind.Exponential => $"экспоненциальное, среднее {Format(d.Mean)}",
        DistributionKind.Deterministic => $"постоянное {Format(d.Mean)}",
        DistributionKind.Erlang => $"Эрланга {Format(d.Shape)}-го порядка, среднее {Format(d.Mean)}",
        DistributionKind.HyperExponential => $"гиперэкспоненциальное, среднее {Format(d.Mean)}, коэфф. вариации {Format(d.Cv)}",
        DistributionKind.Uniform => $"равномерное [{Format(d.Min)}; {Format(d.Max)}]",
        DistributionKind.Normal => $"нормальное (усечённое в 0), среднее {Format(d.Mean)}, коэфф. вариации {Format(d.Cv)}",
        DistributionKind.LogNormal => $"логнормальное, среднее {Format(d.Mean)}, коэфф. вариации {Format(d.Cv)}",
        DistributionKind.Triangular => $"треугольное [{Format(d.Min)}; {Format(d.Mode)}; {Format(d.Max)}]",
        DistributionKind.Gamma => $"гамма, среднее {Format(d.Mean)}, коэфф. вариации {Format(d.Cv)}",
        DistributionKind.Weibull => $"Вейбулла, среднее {Format(d.Mean)}, форма {Format(d.Shape)}",
        _ => "?",
    };

    public static bool IsExponential(Distribution d) => d.Kind == DistributionKind.Exponential;

    // ------------------------------------------------------------------ moments

    public static double Mean(Distribution d) => d.Kind switch
    {
        DistributionKind.Uniform => (d.Min + d.Max) / 2,
        DistributionKind.Triangular => (d.Min + d.Mode + d.Max) / 3,
        DistributionKind.Normal => TruncatedNormal(d).Mean,
        _ => d.Mean,
    };

    /// <summary>E[X²].</summary>
    public static double SecondMoment(Distribution d)
    {
        var m = d.Mean;
        switch (d.Kind)
        {
            case DistributionKind.Exponential:
                return 2 * m * m;
            case DistributionKind.Deterministic:
                return m * m;
            case DistributionKind.Erlang:
                return m * m * (1 + 1 / d.Shape);
            case DistributionKind.HyperExponential:
            case DistributionKind.LogNormal:
            case DistributionKind.Gamma:
                return m * m * (1 + d.Cv * d.Cv);
            case DistributionKind.Uniform:
                return (d.Min * d.Min + d.Min * d.Max + d.Max * d.Max) / 3;
            case DistributionKind.Triangular:
            {
                double a = d.Min, b = d.Max, c = d.Mode;
                var variance = (a * a + b * b + c * c - a * b - a * c - b * c) / 18;
                var mean = (a + b + c) / 3;
                return variance + mean * mean;
            }
            case DistributionKind.Normal:
                return TruncatedNormal(d).SecondMoment;
            case DistributionKind.Weibull:
            {
                var scale = WeibullScale(d);
                return scale * scale * Gamma(1 + 2 / d.Shape);
            }
            default:
                throw new ArgumentOutOfRangeException(nameof(d));
        }
    }

    /// <summary>Squared coefficient of variation Var/mean².</summary>
    public static double Scv(Distribution d)
    {
        var mean = Mean(d);
        return mean > 0 ? Math.Max(0, SecondMoment(d) / (mean * mean) - 1) : 0;
    }

    /// <summary>Branch probability and means of the balanced-means two-phase hyperexponential distribution.</summary>
    public static (double P1, double Mean1, double Mean2) HyperExponentialPhases(Distribution d)
    {
        var c2 = d.Cv * d.Cv;
        var p1 = 0.5 * (1 + Math.Sqrt((c2 - 1) / (c2 + 1)));
        var p2 = 1 - p1;
        return (p1, d.Mean / (2 * p1), p2 > 0 ? d.Mean / (2 * p2) : d.Mean);
    }

    public static (double Mu, double Sigma) LogNormalParameters(Distribution d)
    {
        var sigma2 = Math.Log(1 + d.Cv * d.Cv);
        return (Math.Log(d.Mean) - sigma2 / 2, Math.Sqrt(sigma2));
    }

    public static double WeibullScale(Distribution d) => d.Mean / Gamma(1 + 1 / d.Shape);

    /// <summary>Moments of max(0, X), X ~ N(mean, (cv·mean)²) — the GPSS expression clamps negative samples to 0.</summary>
    public static (double Mean, double SecondMoment) TruncatedNormal(Distribution d)
    {
        var mu = d.Mean;
        var sigma = d.Cv * d.Mean;
        var z = mu / sigma;
        var phi = Math.Exp(-z * z / 2) / Math.Sqrt(2 * Math.PI);
        var cdf = NormalCdf(z);
        return (mu * cdf + sigma * phi, (mu * mu + sigma * sigma) * cdf + mu * sigma * phi);
    }

    // ------------------------------------------------------------------ transforms

    /// <summary>Laplace–Stieltjes transform E[e^(−sX)].</summary>
    public static double Lst(Distribution d, double s)
    {
        if (s == 0)
        {
            return 1;
        }

        switch (d.Kind)
        {
            case DistributionKind.Exponential:
                return 1 / (1 + s * d.Mean);
            case DistributionKind.Deterministic:
                return Math.Exp(-s * d.Mean);
            case DistributionKind.Erlang:
                return Math.Pow(1 + s * d.Mean / d.Shape, -d.Shape);
            case DistributionKind.HyperExponential:
            {
                var (p1, m1, m2) = HyperExponentialPhases(d);
                return p1 / (1 + s * m1) + (1 - p1) / (1 + s * m2);
            }
            case DistributionKind.Uniform:
                return (Math.Exp(-s * d.Min) - Math.Exp(-s * d.Max)) / (s * (d.Max - d.Min));
            case DistributionKind.Gamma:
            {
                var shape = 1 / (d.Cv * d.Cv);
                return Math.Pow(1 + s * d.Mean / shape, -shape);
            }
            default:
                return NumericLst(d, s);
        }
    }

    /// <summary>E[e^(−sX)] by Simpson's rule over the density (Normal, LogNormal, Triangular, Weibull).</summary>
    private static double NumericLst(Distribution d, double s)
    {
        var mean = Mean(d);
        var sd = Math.Sqrt(Math.Max(0, SecondMoment(d) - mean * mean));
        var upper = d.Kind == DistributionKind.Triangular ? d.Max : mean + 40 * sd + 10 * mean;
        var lower = d.Kind == DistributionKind.Triangular ? d.Min : 0;
        const int steps = 20_000;
        var h = (upper - lower) / steps;
        double sum = 0, mass = 0;
        for (var i = 0; i <= steps; i++)
        {
            var x = lower + i * h;
            var weight = i == 0 || i == steps ? 1 : i % 2 == 1 ? 4 : 2;
            var density = Density(d, x);
            sum += weight * density * Math.Exp(-s * x);
            mass += weight * density;
        }

        // Normalising by the integrated mass cancels most of the quadrature error.
        var atom = d.Kind == DistributionKind.Normal ? NormalCdf(-d.Mean / (d.Cv * d.Mean)) : 0;
        return atom + (1 - atom) * sum / mass;
    }

    private static double Density(Distribution d, double x)
    {
        switch (d.Kind)
        {
            case DistributionKind.Normal:
            {
                var sigma = d.Cv * d.Mean;
                var z = (x - d.Mean) / sigma;
                return x < 0 ? 0 : Math.Exp(-z * z / 2) / (sigma * Math.Sqrt(2 * Math.PI));
            }
            case DistributionKind.LogNormal:
            {
                if (x <= 0)
                {
                    return 0;
                }

                var (mu, sigma) = LogNormalParameters(d);
                var z = (Math.Log(x) - mu) / sigma;
                return Math.Exp(-z * z / 2) / (x * sigma * Math.Sqrt(2 * Math.PI));
            }
            case DistributionKind.Triangular:
            {
                double a = d.Min, b = d.Max, c = d.Mode;
                if (x < a || x > b)
                {
                    return 0;
                }

                return x < c ? 2 * (x - a) / ((b - a) * (c - a)) : x > c || c == b ? 2 * (b - x) / ((b - a) * (b - c)) : 2 / (b - a);
            }
            case DistributionKind.Weibull:
            {
                if (x <= 0)
                {
                    return 0;
                }

                var scale = WeibullScale(d);
                var k = d.Shape;
                return k / scale * Math.Pow(x / scale, k - 1) * Math.Exp(-Math.Pow(x / scale, k));
            }
            default:
                throw new ArgumentOutOfRangeException(nameof(d));
        }
    }

    // ------------------------------------------------------------------ sampling (numerical analytics)

    public static double Sample(Distribution d, Random random)
    {
        double U() => 1 - random.NextDouble();
        double Z() => Math.Sqrt(-2 * Math.Log(U())) * Math.Cos(2 * Math.PI * random.NextDouble());

        switch (d.Kind)
        {
            case DistributionKind.Exponential:
                return -d.Mean * Math.Log(U());
            case DistributionKind.Deterministic:
                return d.Mean;
            case DistributionKind.Erlang:
            {
                var product = 1.0;
                for (var i = 0; i < (int)d.Shape; i++)
                {
                    product *= U();
                }

                return -d.Mean / d.Shape * Math.Log(product);
            }
            case DistributionKind.HyperExponential:
            {
                var (p1, m1, m2) = HyperExponentialPhases(d);
                return -(random.NextDouble() < p1 ? m1 : m2) * Math.Log(U());
            }
            case DistributionKind.Uniform:
                return d.Min + (d.Max - d.Min) * random.NextDouble();
            case DistributionKind.Normal:
                return Math.Max(0, d.Mean + d.Cv * d.Mean * Z());
            case DistributionKind.LogNormal:
            {
                var (mu, sigma) = LogNormalParameters(d);
                return Math.Exp(mu + sigma * Z());
            }
            case DistributionKind.Triangular:
            {
                double a = d.Min, b = d.Max, c = d.Mode, u = random.NextDouble();
                var split = (c - a) / (b - a);
                return u < split ? a + Math.Sqrt(u * (b - a) * (c - a)) : b - Math.Sqrt((1 - u) * (b - a) * (b - c));
            }
            case DistributionKind.Gamma:
            {
                var shape = 1 / (d.Cv * d.Cv);
                return d.Mean / shape * StandardGamma(shape, random, U, Z);
            }
            case DistributionKind.Weibull:
                return WeibullScale(d) * Math.Pow(-Math.Log(U()), 1 / d.Shape);
            default:
                throw new ArgumentOutOfRangeException(nameof(d));
        }
    }

    private static double StandardGamma(double shape, Random random, Func<double> u, Func<double> z)
    {
        if (shape < 1)
        {
            return StandardGamma(shape + 1, random, u, z) * Math.Pow(u(), 1 / shape);
        }

        var d = shape - 1.0 / 3;
        var c = 1 / Math.Sqrt(9 * d);
        while (true)
        {
            double x, v;
            do
            {
                x = z();
                v = 1 + c * x;
            }
            while (v <= 0);

            v = v * v * v;
            if (Math.Log(u()) < 0.5 * x * x + d - d * v + d * Math.Log(v))
            {
                return d * v;
            }
        }
    }

    // ------------------------------------------------------------------ GPSS

    /// <summary>GPSS World operand drawing a value from the distribution with random number stream <paramref name="stream"/>.</summary>
    public static string GpssOperand(Distribution d, int stream)
    {
        var s = stream.ToString(CultureInfo.InvariantCulture);
        switch (d.Kind)
        {
            case DistributionKind.Exponential:
                return $"(Exponential({s},0,{Format(d.Mean)}))";
            case DistributionKind.Deterministic:
                return Format(d.Mean);
            case DistributionKind.Erlang:
                return $"(Gamma({s},0,{Format(d.Mean / d.Shape)},{Format(d.Shape)}))";
            case DistributionKind.HyperExponential:
            {
                var (p1, m1, m2) = HyperExponentialPhases(d);
                return $"(Exponential({s},0,1)#({Format(m1)}+{Format(m2 - m1)}#(Uniform({s},0,1)>={Format(p1)})))";
            }
            case DistributionKind.Uniform:
                return $"(Uniform({s},{Format(d.Min)},{Format(d.Max)}))";
            case DistributionKind.Normal:
                return $"(MAX(0,Normal({s},{Format(d.Mean)},{Format(d.Cv * d.Mean)})))";
            case DistributionKind.LogNormal:
            {
                var (mu, sigma) = LogNormalParameters(d);
                return $"(Lognormal({s},0,{Format(mu)},{Format(sigma)}))";
            }
            case DistributionKind.Triangular:
                return $"(Triangular({s},{Format(d.Min)},{Format(d.Max)},{Format(d.Mode)}))";
            case DistributionKind.Gamma:
            {
                var shape = 1 / (d.Cv * d.Cv);
                return $"(Gamma({s},0,{Format(d.Mean / shape)},{Format(shape)}))";
            }
            case DistributionKind.Weibull:
                return $"(Weibull({s},0,{Format(WeibullScale(d))},{Format(d.Shape)}))";
            default:
                throw new ArgumentOutOfRangeException(nameof(d));
        }
    }

    // ------------------------------------------------------------------ batches

    public static string? Validate(BatchSize batch) => batch.Kind switch
    {
        BatchKind.Fixed => batch.Size >= 1 && batch.Size <= 1000 && batch.Size == Math.Floor(batch.Size) ? null : "размер группы — целое от 1 до 1000",
        BatchKind.Uniform => batch.Min >= 1 && batch.Max >= batch.Min && batch.Max <= 1000 ? null : "нужно 1 ≤ минимум ≤ максимум ≤ 1000",
        BatchKind.Geometric => batch.Size >= 1 && batch.Size <= 1000 ? null : "средний размер группы — от 1 до 1000",
        _ => "неизвестный вид размера группы",
    };

    public static (double Mean, double SecondMoment) Moments(BatchSize batch)
    {
        switch (batch.Kind)
        {
            case BatchKind.Fixed:
                return (batch.Size, batch.Size * batch.Size);
            case BatchKind.Uniform:
            {
                double a = batch.Min, b = batch.Max;
                var n = b - a + 1;
                var mean = (a + b) / 2;
                return (mean, (n * n - 1) / 12 + mean * mean);
            }
            default:
            {
                var m = batch.Size;
                return (m, m * (2 * m - 1));
            }
        }
    }

    /// <summary>Number of additional customers (SPLIT count) of a batch.</summary>
    public static string GpssSplitCount(BatchSize batch, int stream)
    {
        var s = stream.ToString(CultureInfo.InvariantCulture);
        return batch.Kind switch
        {
            BatchKind.Fixed => Format(batch.Size - 1),
            BatchKind.Uniform => $"(Duniform({s},{batch.Min - 1},{batch.Max - 1}))",
            _ => batch.Size <= 1 ? "0" : $"(INT(LOG(1-Uniform({s},0,1))/LOG({Format(1 - 1 / batch.Size)})))",
        };
    }

    public static string Describe(BatchSize batch) => batch.Kind switch
    {
        BatchKind.Fixed => $"группы по {Format(batch.Size)}",
        BatchKind.Uniform => $"группы от {batch.Min} до {batch.Max}",
        _ => $"группы геометрического размера, в среднем {Format(batch.Size)}",
    };

    // ------------------------------------------------------------------ special functions

    /// <summary>Γ(x) by the Lanczos approximation.</summary>
    public static double Gamma(double x)
    {
        if (x < 0.5)
        {
            return Math.PI / (Math.Sin(Math.PI * x) * Gamma(1 - x));
        }

        double[] g =
        [
            0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
            12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
        ];
        x -= 1;
        var a = g[0];
        var t = x + 7.5;
        for (var i = 1; i < 9; i++)
        {
            a += g[i] / (x + i);
        }

        return Math.Sqrt(2 * Math.PI) * Math.Pow(t, x + 0.5) * Math.Exp(-t) * a;
    }

    /// <summary>Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| &lt; 1.5e-7).</summary>
    public static double NormalCdf(double z)
    {
        var x = Math.Abs(z) / Math.Sqrt(2);
        var t = 1 / (1 + 0.3275911 * x);
        var erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.Exp(-x * x);
        return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
    }
}
