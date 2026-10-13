using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using GpssStudio.Projects.Formats;
using GpssStudio.Projects.Model;

namespace GpssStudio.Projects.Import;

/// <summary>
/// Imports a GPSS Studio project: <c>Project.gsproj</c>, TEB libraries (<c>TebsLibraries/*.tlib</c>) and for
/// every model <c>SimModels/&lt;name&gt;/Diagram.gsdiagram</c> and <c>ModelText.gps</c>.
/// The project is given as a set of files (a folder or a ZIP archive of it).
/// </summary>
public static class StudioProjectReader
{
    /// <summary>Upper bound for the unpacked size of an uploaded archive.</summary>
    public const long MaxUnpackedBytes = 200L * 1024 * 1024;

    static StudioProjectReader()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    public static StudioProject ReadZip(Stream archive)
    {
        // Names are read byte for byte (Latin-1) and decoded afterwards: UTF-8 when valid, otherwise the
        // DOS code page used by Windows archivers for Cyrillic names (CP866).
        using var zip = new ZipArchive(archive, ZipArchiveMode.Read, leaveOpen: true, entryNameEncoding: Encoding.Latin1);
        var files = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
        long total = 0;
        foreach (var entry in zip.Entries.Where(entry => entry.Length > 0 || !entry.FullName.EndsWith('/')))
        {
            total += entry.Length;
            if (total > MaxUnpackedBytes)
            {
                throw new InvalidDataException("Архив проекта слишком большой (более 200 МБ в распакованном виде).");
            }

            using var stream = entry.Open();
            using var buffer = new MemoryStream();
            stream.CopyTo(buffer);
            files[Normalize(DecodeEntryName(entry.FullName))] = buffer.ToArray();
        }

        return Read(files);
    }

    public static StudioProject ReadDirectory(string directory)
    {
        var files = Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories)
            .ToDictionary(path => Normalize(Path.GetRelativePath(directory, path)), File.ReadAllBytes, StringComparer.OrdinalIgnoreCase);
        return Read(files);
    }

    /// <summary>Reads a project from files keyed by relative path ("/" separated).</summary>
    public static StudioProject Read(IReadOnlyDictionary<string, byte[]> files)
    {
        var project = new StudioProject();
        var projectFile = files.Keys.Where(path => path.EndsWith(".gsproj", StringComparison.OrdinalIgnoreCase)).OrderBy(path => path.Count(ch => ch == '/')).FirstOrDefault();
        var root = projectFile is null ? FindModelRoot(files) : FolderOf(projectFile);

        var listedModels = new List<StudioModel>();
        if (projectFile is not null)
        {
            ReadProjectFile(files[projectFile], project, listedModels);
        }
        else
        {
            project.ImportNotes.Add("Файл Project.gsproj не найден: проект собран из найденных моделей.");
        }

        var libraryClasses = new Dictionary<string, TebNode>(StringComparer.OrdinalIgnoreCase);
        foreach (var (path, content) in files.Where(file => file.Key.EndsWith(".tlib", StringComparison.OrdinalIgnoreCase)).OrderBy(file => file.Key))
        {
            try
            {
                var library = ReadLibrary(content, project.ImportNotes);
                project.Libraries.Add(library);
                foreach (var libraryClass in library.Classes)
                {
                    libraryClasses[libraryClass.Template.ClassId] = libraryClass.Template;
                }
            }
            catch (Exception exception) when (exception is InvalidDataException or FormatException or System.Xml.XmlException)
            {
                project.ImportNotes.Add($"Библиотека {path}: {exception.Message}");
            }
        }

        var reader = new DiagramReader(libraryClasses, project.ImportNotes);
        var modelFolders = files.Keys
            .Where(path => path.StartsWith(root + "SimModels/", StringComparison.OrdinalIgnoreCase))
            .Select(path => path[(root.Length + "SimModels/".Length)..])
            .Where(path => path.Contains('/'))
            .Select(path => path[..path.IndexOf('/')])
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Models listed in the project file come first, in their order; unlisted model folders are appended.
        foreach (var name in listedModels.Select(model => model.Name).Concat(modelFolders).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var model = listedModels.FirstOrDefault(item => item.Name.Equals(name, StringComparison.OrdinalIgnoreCase)) ?? new StudioModel { Name = name };
            var folder = $"{root}SimModels/{name}/";
            ReadModelFiles(files, folder, model, reader, project.ImportNotes);
            project.Models.Add(model);
        }

        if (project.Models.Count == 0 && projectFile is null)
        {
            var model = new StudioModel { Name = "Модель" };
            ReadModelFiles(files, root, model, reader, project.ImportNotes);
            if (model.Scheme is null && model.ModelText is null)
            {
                throw new InvalidDataException("В архиве нет проекта GPSS Studio: не найдены Project.gsproj, Diagram.gsdiagram или ModelText.gps.");
            }

            project.Models.Add(model);
        }

        if (string.IsNullOrWhiteSpace(project.Name))
        {
            project.Name = project.Models.FirstOrDefault()?.Name ?? "Проект";
        }

        return project;
    }

    private static void ReadModelFiles(IReadOnlyDictionary<string, byte[]> files, string folder, StudioModel model, DiagramReader reader, List<string> notes)
    {
        if (files.TryGetValue(folder + "Diagram.gsdiagram", out var diagram))
        {
            try
            {
                using var stream = new MemoryStream(diagram);
                model.Scheme = reader.ReadDiagram(DataContractDocument.Load(stream));
            }
            catch (Exception exception) when (exception is System.Xml.XmlException or FormatException)
            {
                notes.Add($"Модель «{model.Name}»: схема не прочитана ({exception.Message}).");
            }
        }

        var textFile = files.Keys.FirstOrDefault(path => path.StartsWith(folder, StringComparison.OrdinalIgnoreCase)
                                                         && !path[folder.Length..].Contains('/')
                                                         && (path.EndsWith("ModelText.gps", StringComparison.OrdinalIgnoreCase) || path.EndsWith(".gps", StringComparison.OrdinalIgnoreCase)));
        if (textFile is not null)
        {
            model.ModelText = GpssModelFile.ReadText(files[textFile]);
        }

        model.Forms = files.Keys
            .Where(path => path.StartsWith(folder + "Forms/", StringComparison.OrdinalIgnoreCase) && path.EndsWith("/Form.fog", StringComparison.OrdinalIgnoreCase))
            .Select(path => path[(folder.Length + "Forms/".Length)..^"/Form.fog".Length])
            .Union(model.Forms, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static void ReadProjectFile(byte[] content, StudioProject project, List<StudioModel> models)
    {
        using var stream = new MemoryStream(content);
        var document = XDocument.Load(stream);
        var root = document.Root ?? throw new InvalidDataException("Пустой файл проекта.");
        string? Value(XElement element, string name) => element.Element(name)?.Value;

        project.Id = Value(root, "Guid") ?? project.Id;
        project.Name = Value(root, "Name") ?? string.Empty;
        project.Description = NullIfEmpty(Value(root, "Description"));
        project.CreatedAt = DateTimeOffset.TryParse(Value(root, "CreationDate"), CultureInfo.InvariantCulture, DateTimeStyles.None, out var created) ? created : null;

        foreach (var element in root.Element("SimModels")?.Elements("SimModel") ?? [])
        {
            models.Add(new StudioModel
            {
                Name = Value(element, "Name") ?? "Модель",
                Description = NullIfEmpty(Value(element, "Description")),
                IsCurrent = string.Equals(Value(element, "IsCurrent"), "True", StringComparison.OrdinalIgnoreCase),
                Forms = element.Element("Forms")?.Elements("Form").Select(form => Value(form, "Name") ?? string.Empty).Where(name => name.Length > 0).ToList() ?? [],
            });
        }
    }

    /// <summary>A <c>.tlib</c> file is a ZIP archive: Id, Name, Description, IsEditable and classes under RootCategory/.</summary>
    public static TebLibrary ReadLibrary(byte[] content, List<string> notes)
    {
        using var zip = new ZipArchive(new MemoryStream(content), ZipArchiveMode.Read, leaveOpen: false, entryNameEncoding: Encoding.Latin1);
        string? Entry(string name)
        {
            var entry = zip.GetEntry(name);
            if (entry is null)
            {
                return null;
            }

            using var reader = new StreamReader(entry.Open(), Encoding.UTF8);
            return reader.ReadToEnd();
        }

        static string? Scalar(string? xml) => xml is null ? null : XElement.Parse(xml).Value;

        var library = new TebLibrary
        {
            Name = Scalar(Entry("Name")) ?? "Библиотека ТЭБов",
            Description = NullIfEmpty(Scalar(Entry("Description"))),
            IsEditable = !string.Equals(Scalar(Entry("IsEditable")), "false", StringComparison.OrdinalIgnoreCase),
        };

        if (Entry("Id") is { } idXml)
        {
            var id = XElement.Parse(idXml);
            library.Id = id.Elements().FirstOrDefault(element => element.Name.LocalName == "Guid")?.Value ?? string.Empty;
            library.Version = id.Elements().FirstOrDefault(element => element.Name.LocalName == "Version")?.Value ?? library.Version;
        }

        var reader = new DiagramReader(new Dictionary<string, TebNode>(), notes);
        foreach (var entry in zip.Entries.Where(entry => entry.FullName.StartsWith("RootCategory/", StringComparison.Ordinal) && entry.Length > 0))
        {
            using var stream = entry.Open();
            var template = reader.ReadClass(DataContractDocument.Load(stream).Root);
            var category = DecodeEntryName(entry.FullName)["RootCategory/".Length..];
            category = category.Contains('/') ? category[..category.LastIndexOf('/')] : string.Empty;
            library.Classes.Add(new LibraryClass { Category = category, Template = template });
        }

        return library;
    }

    private static string FindModelRoot(IReadOnlyDictionary<string, byte[]> files)
    {
        var marker = files.Keys.FirstOrDefault(path => path.EndsWith("Diagram.gsdiagram", StringComparison.OrdinalIgnoreCase))
                     ?? files.Keys.FirstOrDefault(path => path.EndsWith(".gps", StringComparison.OrdinalIgnoreCase));
        return marker is null ? string.Empty : FolderOf(marker);
    }

    private static string DecodeEntryName(string latin1Name)
    {
        var bytes = Encoding.Latin1.GetBytes(latin1Name);
        try
        {
            return new UTF8Encoding(false, throwOnInvalidBytes: true).GetString(bytes);
        }
        catch (DecoderFallbackException)
        {
            return Encoding.GetEncoding(866).GetString(bytes);
        }
    }

    private static string FolderOf(string path) => path.Contains('/') ? path[..(path.LastIndexOf('/') + 1)] : string.Empty;

    private static string Normalize(string path) => path.Replace('\\', '/').TrimStart('/');

    private static string? NullIfEmpty(string? text) => string.IsNullOrWhiteSpace(text) ? null : text;
}
