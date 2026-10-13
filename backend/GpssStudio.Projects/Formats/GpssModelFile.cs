using System.Text;

namespace GpssStudio.Projects.Formats;

/// <summary>
/// GPSS World model file (<c>.gps</c>): a binary header followed by the model text in RTF.
/// Plain-text files are accepted as well.
/// </summary>
public static class GpssModelFile
{
    static GpssModelFile()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    public static string ReadText(byte[] content)
    {
        var rtfStart = IndexOf(content, "{\\rtf"u8);
        if (rtfStart >= 0)
        {
            var end = Array.IndexOf(content, (byte)0, rtfStart);
            var rtf = Encoding.Latin1.GetString(content, rtfStart, (end < 0 ? content.Length : end) - rtfStart);
            return Normalize(RtfText.ToPlainText(rtf));
        }

        var text = DecodePlain(content);
        return Normalize(RtfText.LooksLikeRtf(text) ? RtfText.ToPlainText(text) : text);
    }

    private static string DecodePlain(byte[] content)
    {
        if (content.Length >= 3 && content[0] == 0xEF && content[1] == 0xBB && content[2] == 0xBF)
        {
            return Encoding.UTF8.GetString(content, 3, content.Length - 3);
        }

        try
        {
            return new UTF8Encoding(false, true).GetString(content);
        }
        catch (DecoderFallbackException)
        {
            return Encoding.GetEncoding(1251).GetString(content);
        }
    }

    /// <summary>Unix line ends, no NUL padding, no trailing whitespace at the end of the text.</summary>
    private static string Normalize(string text) => text.Replace("\r\n", "\n").Replace('\r', '\n').Replace("\0", string.Empty).TrimEnd() + "\n";

    private static int IndexOf(byte[] data, ReadOnlySpan<byte> pattern) => data.AsSpan().IndexOf(pattern);
}
