using GpssStudio.Simulation.Blocks;
using GpssStudio.Simulation.Parsing;

namespace GpssStudio.Simulation.Translation;

/// <summary>Result of translating a GPSS World model.</summary>
public sealed class GpssModel
{
    public List<Block> Blocks { get; } = [];
    public Dictionary<string, int> Labels { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, double> Constants { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, StorageDefinition> Storages { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, TableDefinition> Tables { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, VariableDefinition> Variables { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, FunctionDefinition> Functions { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, MatrixDefinition> Matrices { get; } = new(StringComparer.OrdinalIgnoreCase);
    public List<ControlStatement> ControlStatements { get; } = [];

    /// <summary>Entity names in order of first appearance; they are numbered from 10000 like in GPSS World.</summary>
    public List<string> EntityNames { get; } = [];

    public List<TranslationError> Errors { get; } = [];

    public bool Succeeded => Errors.Count == 0;
}
