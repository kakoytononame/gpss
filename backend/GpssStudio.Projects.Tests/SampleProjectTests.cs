using GpssStudio.Projects.Forms;
using GpssStudio.Projects.Generation;
using GpssStudio.Projects.Import;
using GpssStudio.Simulation.Expressions;
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

    [Theory]
    [MemberData(nameof(Projects))]
    public void SampleForms_BindToTheirModelText(string name)
    {
        if (name.Length == 0)
        {
            return;
        }

        var project = StudioProjectReader.ReadDirectory(Path.Combine(SamplesDirectory!, name));
        foreach (var form in project.Models.SelectMany(model => model.UserForms))
        {
            Assert.NotNull(form.ModelText);
            var lines = form.ModelText!.Replace("\r\n", "\n").Split('\n');
            foreach (var input in form.Inputs)
            {
                Assert.Contains(input.Operator, lines[input.Line - 1], StringComparison.OrdinalIgnoreCase);
            }

            // Input values written back give a model that translates.
            var (text, messages) = FormModelBuilder.Apply(form.ModelText, form.Inputs);
            Assert.Empty(messages);
            var translated = SimulationSession.Translate(text);
            Assert.True(translated.Succeeded, $"{name}/{form.Name}: {string.Join("; ", translated.Errors)}");
            var (session, created) = SimulationSession.Create(text, form.Name);
            var run = created.State == "idle" ? session!.Execute($"START {form.Run.StartCount}") : created;
            // The form of "Строительство" ends with TERMINATE without a count: the run stops when no events are left.
            Assert.True(run.Success || run.RuntimeError!.Contains("Цепь будущих событий пуста"), $"{name}/{form.Name}: {run.RuntimeError}");

            var inputNumbers = form.Inputs.Select(input => input.Number).ToHashSet();
            var indicators = form.Indicators.ToDictionary(indicator => indicator.Id);
            foreach (var layout in new[] { form.EntryForm, form.DynamicForm }.OfType<Projects.Model.FormControl>())
            {
                var controls = FormReader.Flatten(layout).ToList();
                Assert.All(controls.Where(control => control.Input is not null), control => Assert.Contains(control.Input!.Value, inputNumbers));
                Assert.All(controls.Where(control => control.Indicator is not null), control => Assert.True(indicators.ContainsKey(control.Indicator!.Value), $"{form.Name}: SNA {control.Indicator}"));
                Assert.All(controls.Where(control => control.Image is not null), control => Assert.True(form.Images.ContainsKey(control.Image!), control.Image));
            }

            foreach (var indicator in form.Indicators.Where(indicator => indicator.Expression is not null))
            {
                ExpressionParser.Parse(indicator.Expression!);
            }

            if (form.Plan is { } plan)
            {
                Assert.All(plan.Factors, factor => Assert.NotNull(Simulation.Parsing.OperandEditor.Read(lines[factor.Line - 1], Simulation.Parsing.OperandEditor.IndexOf(factor.Operand))));
                Assert.All(plan.Targets, target => ExpressionParser.Parse(target.Expression));
            }
        }
    }

    private static SimulationResult Run(string text)
    {
        var (session, result) = SimulationSession.Create(text, "sample");
        return session is not null && result.State == "idle" ? session.Execute("START 1") : result;
    }
}
