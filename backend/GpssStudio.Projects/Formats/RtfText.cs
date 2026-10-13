using System.Globalization;
using System.Text;

namespace GpssStudio.Projects.Formats;

/// <summary>
/// Minimal RTF to plain text converter for model texts: paragraphs, tabs, hex escapes in the code page of
/// the current font (<c>\fcharset</c>), Unicode escapes (<c>\uN</c> with fallback skipping) and ignorable
/// destinations (font table, colour table, <c>\*</c> groups).
/// </summary>
public static class RtfText
{
    private static readonly HashSet<string> SkippedDestinations = new(StringComparer.Ordinal)
    {
        "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "header", "footer", "listtable", "listoverridetable", "generator",
    };

    static RtfText()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    public static bool LooksLikeRtf(string text) => text.TrimStart().StartsWith("{\\rtf", StringComparison.Ordinal);

    public static string ToPlainText(string rtf)
    {
        var fontCodePages = ReadFontCodePages(rtf);
        var defaultCodePage = ReadControlArgument(rtf, "ansicpg") ?? 1252;
        var output = new StringBuilder(rtf.Length / 2);
        var pendingBytes = new List<byte>();
        var stack = new Stack<(int SkipDepth, int CodePage, int UnicodeSkip)>();
        var codePage = defaultCodePage;
        var unicodeSkip = 1;
        var skipDepth = -1;
        var depth = 0;
        var fallbackToSkip = 0;

        void FlushBytes()
        {
            if (pendingBytes.Count == 0)
            {
                return;
            }

            output.Append(Encoding.GetEncoding(codePage).GetString(pendingBytes.ToArray()));
            pendingBytes.Clear();
        }

        void Emit(string text)
        {
            if (skipDepth >= 0)
            {
                return;
            }

            FlushBytes();
            output.Append(text);
        }

        for (var i = 0; i < rtf.Length; i++)
        {
            var ch = rtf[i];
            switch (ch)
            {
                case '{':
                    FlushBytes();
                    stack.Push((skipDepth, codePage, unicodeSkip));
                    depth++;
                    continue;
                case '}':
                    FlushBytes();
                    depth--;
                    if (stack.Count > 0)
                    {
                        (skipDepth, codePage, unicodeSkip) = stack.Pop();
                    }

                    continue;
                case '\r':
                case '\n':
                    continue;
                case '\\':
                    break;
                default:
                    if (fallbackToSkip > 0)
                    {
                        fallbackToSkip--;
                        continue;
                    }

                    Emit(ch.ToString());
                    continue;
            }

            if (i + 1 >= rtf.Length)
            {
                break;
            }

            var next = rtf[i + 1];
            if (next == '\'' && i + 3 < rtf.Length)
            {
                if (byte.TryParse(rtf.AsSpan(i + 2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var value))
                {
                    if (fallbackToSkip > 0)
                    {
                        fallbackToSkip--;
                    }
                    else if (skipDepth < 0)
                    {
                        pendingBytes.Add(value);
                    }
                }

                i += 3;
                continue;
            }

            if (next == '*')
            {
                if (skipDepth < 0)
                {
                    skipDepth = depth;
                }

                i++;
                continue;
            }

            if (!char.IsAsciiLetter(next))
            {
                // Escaped symbol: \\ \{ \} or control symbols such as \~ (non-breaking space).
                Emit(next switch { '~' => " ", '-' or '_' => string.Empty, _ => next.ToString() });
                i++;
                continue;
            }

            var start = i + 1;
            var end = start;
            while (end < rtf.Length && char.IsAsciiLetter(rtf[end]))
            {
                end++;
            }

            var word = rtf[start..end];
            var argumentStart = end;
            if (end < rtf.Length && (rtf[end] == '-' || char.IsAsciiDigit(rtf[end])))
            {
                end++;
                while (end < rtf.Length && char.IsAsciiDigit(rtf[end]))
                {
                    end++;
                }
            }

            int? argument = end > argumentStart ? int.Parse(rtf.AsSpan(argumentStart, end - argumentStart), CultureInfo.InvariantCulture) : null;
            if (end < rtf.Length && rtf[end] == ' ')
            {
                end++;
            }

            i = end - 1;

            if (SkippedDestinations.Contains(word))
            {
                if (skipDepth < 0)
                {
                    skipDepth = depth;
                }

                continue;
            }

            switch (word)
            {
                case "par":
                case "line":
                    Emit("\n");
                    break;
                case "tab":
                    Emit("\t");
                    break;
                case "f" when argument is { } font:
                    FlushBytes();
                    codePage = fontCodePages.GetValueOrDefault(font, defaultCodePage);
                    break;
                case "uc" when argument is { } count:
                    unicodeSkip = count;
                    break;
                case "u" when argument is { } code:
                    Emit(((char)(code < 0 ? code + 65536 : code)).ToString());
                    fallbackToSkip = unicodeSkip;
                    break;
            }
        }

        FlushBytes();
        return output.ToString();
    }

    /// <summary>Converts plain text to RTF (cp1251 hex escapes) for model files.</summary>
    public static string FromPlainText(string text)
    {
        var encoding = Encoding.GetEncoding(1251);
        var builder = new StringBuilder("{\\rtf1\\ansi\\ansicpg1251\\deff0\\deflang1049{\\fonttbl{\\f0\\fnil\\fcharset204 Microsoft Sans Serif;}}\r\n\\viewkind4\\uc1\\pard\\f0\\fs16 ");
        foreach (var ch in text.Replace("\r\n", "\n"))
        {
            switch (ch)
            {
                case '\n':
                    builder.Append("\\par\r\n");
                    break;
                case '\\' or '{' or '}':
                    builder.Append('\\').Append(ch);
                    break;
                case '\t':
                    builder.Append("\\tab ");
                    break;
                default:
                    if (ch < 128)
                    {
                        builder.Append(ch);
                    }
                    else if (encoding.GetBytes(ch.ToString()) is [var single] && encoding.GetString([single]) == ch.ToString())
                    {
                        builder.Append("\\'").Append(single.ToString("x2", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        builder.Append("\\u").Append(((short)ch).ToString(CultureInfo.InvariantCulture)).Append('?');
                    }

                    break;
            }
        }

        return builder.Append("\\par\r\n}\r\n").ToString();
    }

    private static Dictionary<int, int> ReadFontCodePages(string rtf)
    {
        var result = new Dictionary<int, int>();
        var table = rtf.IndexOf("{\\fonttbl", StringComparison.Ordinal);
        if (table < 0)
        {
            return result;
        }

        // Each font is a nested group "{\fN...\fcharsetM name;}" inside the font table group.
        var depth = 0;
        var entryStart = -1;
        for (var i = table; i < rtf.Length; i++)
        {
            if (rtf[i] == '\\')
            {
                i++;
                continue;
            }

            if (rtf[i] == '{')
            {
                depth++;
                if (depth == 2)
                {
                    entryStart = i;
                }
            }
            else if (rtf[i] == '}')
            {
                if (depth == 2 && entryStart >= 0)
                {
                    var entry = rtf[entryStart..i];
                    if (ReadControlArgument(entry, "f") is { } font)
                    {
                        result[font] = ReadControlArgument(entry, "fcharset") switch
                        {
                            204 => 1251, 238 => 1250, 161 => 1253, 162 => 1254, 186 => 1257, _ => 1252,
                        };
                    }
                }

                depth--;
                if (depth == 0)
                {
                    break;
                }
            }
        }

        return result;
    }

    private static int? ReadControlArgument(string text, string word)
    {
        var token = "\\" + word;
        var index = 0;
        while ((index = text.IndexOf(token, index, StringComparison.Ordinal)) >= 0)
        {
            var start = index + token.Length;
            var end = start;
            while (end < text.Length && (char.IsAsciiDigit(text[end]) || (end == start && text[end] == '-')))
            {
                end++;
            }

            if (end > start && int.TryParse(text.AsSpan(start, end - start), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value))
            {
                return value;
            }

            index = start;
        }

        return null;
    }
}
