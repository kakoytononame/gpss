using System.Text;

namespace GpssStudio.Projects.Formats;

/// <summary>
/// Decodes a two-dimensional string array stored in the .NET binary serialization format (MS-NRBF), as
/// used for matrix values in data TEBs. Only the records that occur in such a payload are supported;
/// no types are instantiated, the stream is read as plain data.
/// </summary>
public static class BinaryStringMatrix
{
    private const byte SerializedStreamHeader = 0;
    private const byte BinaryObjectString = 6;
    private const byte BinaryArray = 7;
    private const byte MemberReference = 9;
    private const byte ObjectNull = 10;
    private const byte MessageEnd = 11;
    private const byte ObjectNullMultiple256 = 13;
    private const byte ObjectNullMultiple = 14;

    public static string[][] Decode(byte[] data)
    {
        using var reader = new BinaryReader(new MemoryStream(data), Encoding.UTF8);
        if (reader.ReadByte() != SerializedStreamHeader)
        {
            throw new FormatException("Неизвестный формат значений матрицы.");
        }

        reader.ReadBytes(16);
        if (reader.ReadByte() != BinaryArray)
        {
            throw new FormatException("Значения матрицы не являются массивом.");
        }

        reader.ReadInt32(); // object id
        reader.ReadByte(); // array type (rectangular)
        var rank = reader.ReadInt32();
        var lengths = Enumerable.Range(0, rank).Select(_ => reader.ReadInt32()).ToArray();
        var elementType = reader.ReadByte();
        if (elementType is 0 or 7)
        {
            reader.ReadByte(); // primitive type code
        }
        else if (elementType is 3 or 4)
        {
            throw new FormatException("Неподдерживаемый тип элементов матрицы.");
        }

        var total = lengths.Aggregate(1, (product, length) => product * length);
        var values = new string?[total];
        var strings = new Dictionary<int, string>();
        var index = 0;
        while (index < total)
        {
            var record = reader.ReadByte();
            switch (record)
            {
                case BinaryObjectString:
                {
                    var id = reader.ReadInt32();
                    var value = reader.ReadString();
                    strings[id] = value;
                    values[index++] = value;
                    break;
                }
                case MemberReference:
                    values[index++] = strings.GetValueOrDefault(reader.ReadInt32());
                    break;
                case ObjectNull:
                    index++;
                    break;
                case ObjectNullMultiple256:
                    index += reader.ReadByte();
                    break;
                case ObjectNullMultiple:
                    index += reader.ReadInt32();
                    break;
                case MessageEnd:
                    index = total;
                    break;
                default:
                    throw new FormatException($"Неподдерживаемая запись {record} в значениях матрицы.");
            }
        }

        var rows = lengths.Length > 0 ? lengths[0] : 0;
        var columns = total / Math.Max(1, rows);
        return Enumerable.Range(0, rows)
            .Select(row => Enumerable.Range(0, columns).Select(column => values[row * columns + column] ?? string.Empty).ToArray())
            .ToArray();
    }
}
