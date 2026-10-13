using GpssStudio.Projects.Generation;
using GpssStudio.Projects.Import;
using GpssStudio.Simulation;

namespace GpssStudio.Projects.Tests;

/// <summary>
/// Checks against the sample projects shipped with GPSS Studio. They are not part of this repository
/// (see <c>scripts/fetch-gpss-studio-samples.sh</c>); set GPSS_STUDIO_SAMPLES to the folder with the
/// unpacked projects to run these tests, otherwise they pass without checking anything.
/// </summary>
public sealed class SampleProjectTests
{
    private static readonly string? SamplesDirectory = Environment.GetEnvironmentVariable("GPSS_STUDIO_SAMPLES");

    public static TheoryData<string> Projects()
    {
        var data = new TheoryData<string>();
        if (SamplesDirectory is not null && Directory.Exists(SamplesDirectory))
        {
            foreach (var directory in Directory.GetDirectories(SamplesDirectory).Order())
            {
                data.Add(Path.GetFileName(directory));
            }
        }
        else
        {
            data.Add(string.Empty);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Projects))]
    public void SampleProject_ImportsAndRunsLikeTheSavedModelText(string name)
    {
        if (name.Length == 0)
        {
            return;
        }

        var project = StudioProjectReader.ReadDirectory(Path.Combine(SamplesDirectory!, name));
        Assert.NotEmpty(project.Models);

        foreach (var model in project.Models)
        {
            var saved = model.ModelText is null ? null : Run(model.ModelText);
            if (saved is not null)
            {
                Assert.True(saved.Success, $"{name}: сохранённый текст: {saved.RuntimeError}");
            }

            if (model.Scheme is null)
            {
                continue;
            }

            var generated = ModelGenerator.Generate(model.Scheme, model.Name);
            Assert.True(generated.Success, $"{name}: {string.Join("\n", generated.Messages)}");
            var run = Run(generated.Text);
            Assert.True(run.Success, $"{name}: {run.RuntimeError}");

            // The generated model behaves exactly like the text GPSS Studio saved for the same scheme.
            if (saved is not null)
            {
                Assert.Equal(saved.Clock, run.Clock, 6);
            }
        }
    }

    private static SimulationResult Run(string text)
    {
        var (session, result) = SimulationSession.Create(text, "sample");
        return session is not null && result.State == "idle" ? session.Execute("START 1") : result;
    }
}
