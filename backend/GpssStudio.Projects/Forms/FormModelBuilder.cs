using GpssStudio.Projects.Model;
using GpssStudio.Simulation.Parsing;

namespace GpssStudio.Projects.Forms;

/// <summary>Writes the values of a form's input data into its model text ("Сформировать модель").</summary>
public static class FormModelBuilder
{
    /// <summary>The model text with every changed operand replaced; lines that cannot be edited are reported.</summary>
    public static (string Text, IReadOnlyList<string> Messages) Apply(string modelText, IEnumerable<FormInput> inputs)
    {
        var newline = modelText.Contains("\r\n") ? "\r\n" : "\n";
        var lines = modelText.Replace("\r\n", "\n").Split('\n');
        var messages = new List<string>();
        foreach (var input in inputs)
        {
            foreach (var operand in input.Operands.Where(operand => operand.Value.Trim().Length > 0))
            {
                if (input.Line < 1 || input.Line > lines.Length)
                {
                    messages.Add($"«{input.Name}»: строка {input.Line} отсутствует в тексте модели.");
                    continue;
                }

                try
                {
                    var index = OperandEditor.IndexOf(operand.Operand);
                    var line = lines[input.Line - 1];
                    if (OperandEditor.Read(line, index) != operand.Value.Trim())
                    {
                        lines[input.Line - 1] = OperandEditor.Replace(line, index, operand.Value.Trim());
                    }
                }
                catch (ArgumentException exception)
                {
                    messages.Add($"«{input.Name}», операнд {operand.Operand}: {exception.Message}");
                }
            }
        }

        return (string.Join(newline, lines), messages);
    }
}
