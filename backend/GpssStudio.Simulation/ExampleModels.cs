namespace GpssStudio.Simulation;

public sealed record ExampleModel(string Id, string Name, string Text);

/// <summary>Example GPSS models shipped with the simulator (embedded resources).</summary>
public static class ExampleModels
{
    private static readonly (string Id, string Name)[] Catalog =
    [
        ("canteen", "Столовая"),
    ];

    public static IReadOnlyList<ExampleModel> All => Catalog.Select(item => Find(item.Id)!).ToList();

    public static ExampleModel? Find(string id)
    {
        var entry = Catalog.FirstOrDefault(item => item.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
        if (entry.Id is null)
        {
            return null;
        }

        using var stream = typeof(ExampleModels).Assembly.GetManifestResourceStream($"GpssStudio.Simulation.Examples.{entry.Id}.gpss");
        if (stream is null)
        {
            return null;
        }

        using var reader = new StreamReader(stream);
        return new ExampleModel(entry.Id, entry.Name, reader.ReadToEnd());
    }
}
