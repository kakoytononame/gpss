using System.Text;
using GpssStudio.Projects.Formats;

namespace GpssStudio.Projects.Tests;

public sealed class FormatTests
{
    [Fact]
    public void Rtf_DecodesCodePagesUnicodeAndParagraphs()
    {
        const string rtf = "{\\rtf1\\ansi\\ansicpg1251\\deff0{\\fonttbl{\\f0\\fnil\\fcharset204 Sans;}{\\f1\\fnil\\fcharset0 Sans;}}\r\n"
                           + "\\viewkind4\\uc1\\pard\\f0 * \\'d2\\'dd\\'c1 \\f1\\'ab\\'bb\\f0\\par\r\n"
                           + "* \\'c2\\'fb\\'f5\\'ee\\'e4 \\u8470?1\\par\r\nGENERATE 10\\tab ;x\\par\r\n}";

        var text = RtfText.ToPlainText(rtf);

        Assert.Equal("* ТЭБ «»\n* Выход №1\nGENERATE 10\t;x\n", text);
    }

    [Fact]
    public void Rtf_RoundTripsPlainText()
    {
        const string text = "* Модель «Касса» №1\n  GENERATE 10,{2}\\x\n";

        Assert.Equal(text, RtfText.ToPlainText(RtfText.FromPlainText(text)).TrimEnd('\n') + "\n");
    }

    [Fact]
    public void GpssModelFile_SkipsBinaryHeaderAndPadding()
    {
        var header = new byte[64];
        BitConverter.GetBytes(2003).CopyTo(header, 0);
        var rtf = Encoding.Latin1.GetBytes(RtfText.FromPlainText(" GENERATE 5\n TERMINATE 1"));
        var content = header.Concat(rtf).Concat(new byte[] { 0, 0 }).ToArray();

        Assert.Equal(" GENERATE 5\n TERMINATE 1\n", GpssModelFile.ReadText(content));
    }

    [Fact]
    public void GpssModelFile_AcceptsPlainTextInUtf8AndCp1251()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        Assert.Equal("* Очередь\n", GpssModelFile.ReadText(Encoding.UTF8.GetBytes("* Очередь\r\n")));
        Assert.Equal("* Очередь\n", GpssModelFile.ReadText(Encoding.GetEncoding(1251).GetBytes("* Очередь")));
    }

    [Fact]
    public void BinaryStringMatrix_DecodesRectangularStringArray()
    {
        // string[2,3] of "0", as stored for a new matrix in a data TEB.
        var data = Convert.FromBase64String("AAEAAAD/////AQAAAAAAAAAHAQAAAAICAAAAAgAAAAMAAAACBgIAAAABMAYDAAAAATAGBAAAAAEwBgUAAAABMAYGAAAAATAGBwAAAAEwCw==");

        var cells = BinaryStringMatrix.Decode(data);

        Assert.Equal(2, cells.Length);
        Assert.All(cells, row => Assert.Equal(["0", "0", "0"], row));
    }

    [Fact]
    public void DataContractDocument_ResolvesReferences()
    {
        const string xml = """
            <Root xmlns:z="http://schemas.microsoft.com/2003/10/Serialization/" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
              <A z:Id="i1"><Name>shared</Name></A>
              <B z:Ref="i1"/>
              <C i:nil="true"/>
              <List><Items><X i:type="b:Kind"><V>1</V></X><X z:Ref="i1"/></Items></List>
            </Root>
            """;

        var root = DataContractDocument.Parse(xml).Root;

        Assert.Equal("shared", root.Text("B", "Name"));
        Assert.Null(root.Child("C"));
        var items = root.Child("List")!.Value.Items().ToList();
        Assert.Equal("Kind", items[0].TypeName);
        Assert.Equal("shared", items[1].Text("Name"));
    }
}
