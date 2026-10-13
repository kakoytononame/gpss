using System.Globalization;
using System.Xml.Linq;

namespace GpssStudio.Projects.Formats;

/// <summary>
/// Read-only view of an XML document written by the .NET DataContractSerializer with object references
/// preserved (<c>z:Id</c> / <c>z:Ref</c>). Elements are addressed by local name; references are resolved
/// transparently, so the object graph can be walked like a tree.
/// </summary>
public sealed class DataContractDocument
{
    internal static readonly XNamespace Instance = "http://www.w3.org/2001/XMLSchema-instance";
    internal static readonly XNamespace Serialization = "http://schemas.microsoft.com/2003/10/Serialization/";

    private readonly Dictionary<string, XElement> _objects = new(StringComparer.Ordinal);

    private DataContractDocument(XDocument document)
    {
        foreach (var element in document.Descendants())
        {
            if (element.Attribute(Serialization + "Id") is { } id)
            {
                _objects[id.Value] = element;
            }
        }

        Root = new DcNode(this, document.Root ?? throw new FormatException("Пустой XML-документ."));
    }

    public DcNode Root { get; }

    public static DataContractDocument Parse(string xml) => new(XDocument.Parse(xml, LoadOptions.PreserveWhitespace));

    public static DataContractDocument Load(Stream stream) => new(XDocument.Load(stream, LoadOptions.PreserveWhitespace));

    internal XElement Resolve(XElement element) =>
        element.Attribute(Serialization + "Ref") is { } reference && _objects.TryGetValue(reference.Value, out var target) ? target : element;
}

/// <summary>An element of a <see cref="DataContractDocument"/> with references already resolved.</summary>
public readonly struct DcNode
{
    private readonly DataContractDocument _document;

    internal DcNode(DataContractDocument document, XElement element)
    {
        _document = document;
        Element = element;
    }

    public XElement Element { get; }

    public string Name => Element.Name.LocalName;

    /// <summary>Local part of <c>i:type</c>, e.g. <c>SimpleTebClass</c>; the element name when absent.</summary>
    public string TypeName
    {
        get
        {
            var type = Element.Attribute(DataContractDocument.Instance + "type")?.Value;
            return type is null ? Name : type[(type.IndexOf(':') + 1)..];
        }
    }

    public bool IsNil => Element.Attribute(DataContractDocument.Instance + "nil")?.Value == "true";

    /// <summary>Object identity (the <c>z:Id</c> of the referenced element), used to match shared objects.</summary>
    public string? ObjectId => Element.Attribute(DataContractDocument.Serialization + "Id")?.Value;

    public DcNode? Child(string name)
    {
        foreach (var child in Element.Elements())
        {
            if (child.Name.LocalName == name)
            {
                var resolved = _document.Resolve(child);
                var node = new DcNode(_document, resolved);
                return node.IsNil ? null : node;
            }
        }

        return null;
    }

    /// <summary>Follows a path of child names, e.g. <c>"Id", "ClassGuid"</c>.</summary>
    public DcNode? Path(params string[] names)
    {
        DcNode? current = this;
        foreach (var name in names)
        {
            current = current?.Child(name);
        }

        return current;
    }

    public IEnumerable<DcNode> Children()
    {
        var document = _document;
        return Element.Elements().Select(child => new DcNode(document, document.Resolve(child)));
    }

    /// <summary>Members of a collection: the children of its <c>Items</c> element (or of the node itself).</summary>
    public IEnumerable<DcNode> Items()
    {
        var items = Child("Items");
        return (items ?? this).Children().Where(child => !child.IsNil);
    }

    public string? Text(params string[] path)
    {
        var node = path.Length == 0 ? this : Path(path);
        return node is { IsNil: false } value && !value.Element.HasElements ? value.Element.Value : null;
    }

    public double Number(string name, double fallback = 0) =>
        double.TryParse(Text(name), NumberStyles.Float, CultureInfo.InvariantCulture, out var value) ? value : fallback;

    public int Integer(string name, int fallback = 0) =>
        int.TryParse(Text(name), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : fallback;

    public bool Flag(string name) => string.Equals(Text(name), "true", StringComparison.OrdinalIgnoreCase);
}
