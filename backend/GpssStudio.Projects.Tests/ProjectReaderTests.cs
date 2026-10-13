using System.IO.Compression;
using System.Text;
using GpssStudio.Projects.Formats;
using GpssStudio.Projects.Generation;
using GpssStudio.Projects.Import;
using GpssStudio.Projects.Model;

namespace GpssStudio.Projects.Tests;

/// <summary>Reads a small project archive laid out like a GPSS Studio project folder.</summary>
public sealed class ProjectReaderTests
{
    private const string Namespaces = """xmlns="http://schemas.datacontract.org/2004/07/Tebs.Core" xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:z="http://schemas.microsoft.com/2003/10/Serialization/" """;

    private const string ProjectFile = """
        <?xml version="1.0" encoding="utf-8"?>
        <GpssStudioProject FormatVersion="1">
          <Guid>6f1c0a52-0000-4000-8000-000000000001</Guid>
          <Name>Мастерская</Name>
          <Description>Тестовый проект</Description>
          <SimModels>
            <SimModel><Name>Модель 1</Name><IsCurrent>True</IsCurrent><Forms><Form><Name>Ввод</Name></Form></Forms></SimModel>
          </SimModels>
        </GpssStudioProject>
        """;

    private static readonly string Diagram = $$"""
        <SchemeRootTebClass z:Id="i1" {{Namespaces}}>
          <Header i:nil="true"/>
          <ChildScheme z:Id="i2">
            <Connections z:Id="i3"><Items>
              <a:TebConnection z:Id="c1" xmlns:a="http://schemas.datacontract.org/2004/07/Tebs.Core.Connections">
                <a:Description i:nil="true"/>
                <a:Destination z:Ref="in1"/>
                <a:GpssModel i:nil="true"/>
                <a:OrderIndex>0</a:OrderIndex>
                <a:Points><DPoint><_x>10</_x><_y>20</_y></DPoint><DPoint><_x>10</_x><_y>90</_y></DPoint></a:Points>
                <a:Priority>0</a:Priority>
                <a:Probability>0</a:Probability>
                <a:SchemeChildId>link-1</a:SchemeChildId>
                <a:Source z:Ref="out1"/>
              </a:TebConnection>
            </Items></Connections>
            <Decors><Items><b:ImageDecor xmlns:b="x"><b:X>5</b:X><b:Y>6</b:Y><b:Width>70</b:Width><b:Height>80</b:Height></b:ImageDecor></Items></Decors>
            <Instances z:Id="i4"><Items>
              <TebInstance z:Id="t1">
                <AnonymousClass i:type="SimpleTebClass" z:Id="k1">
                  <Header>Поступление заказов</Header>
                  <Id><ClassGuid>11111111-0000-0000-0000-000000000001</ClassGuid><LibraryId i:nil="true"/></Id>
                  <NameInModel><NameInModel i:nil="true"/></NameInModel>
                  <GpssEntities><Items/></GpssEntities>
                  <GpssModel><Metadata i:nil="true"/><Text> GENERATE 5</Text></GpssModel>
                  <Inputs><Items/></Inputs>
                  <Outputs><Items><TebOutputDefinition><ConnectionsLimit>0</ConnectionsLimit><Id>1</Id><ConnectedBlock><Label i:nil="true"/><Mode>LastBlock</Mode></ConnectedBlock></TebOutputDefinition></Items></Outputs>
                </AnonymousClass>
                <BackgroundBrush i:type="SolidColorBrushInfo"><Opacity>1</Opacity><A>255</A><B>250</B><G>206</G><R>135</R></BackgroundBrush>
                <Height>60</Height>
                <InstanceId>node-1</InstanceId>
                <InstancesCount>1</InstancesCount>
                <NameInModel><NameInModel>teb1</NameInModel></NameInModel>
                <Outputs><Items>
                  <TebOutputInstance z:Id="out1"><Connections><Items><TebConnection z:Ref="c1"/></Items></Connections><Container z:Ref="t1"/><DefinitionId>1</DefinitionId><Side>3</Side><Position>0.5</Position><GpssModel i:nil="true"/><TransactionTransferMode>DirectOrSplit</TransactionTransferMode></TebOutputInstance>
                </Items></Outputs>
                <Width>170</Width><X>100</X><Y>40</Y>
              </TebInstance>
              <TebInstance z:Id="t2">
                <ClassId><ClassGuid>22222222-0000-0000-0000-000000000002</ClassGuid><LibraryId><Guid>33333333-0000-0000-0000-000000000003</Guid><Version>1.0.0.0</Version></LibraryId></ClassId>
                <InstanceId>node-2</InstanceId>
                <InstancesCount>1</InstancesCount>
                <NameInModel><NameInModel>teb2</NameInModel></NameInModel>
                <Inputs><Items>
                  <TebInputInstance z:Id="in1"><Connections><Items><TebConnection z:Ref="c1"/></Items></Connections><Container z:Ref="t2"/><DefinitionId>1</DefinitionId></TebInputInstance>
                </Items></Inputs>
                <X>100</X><Y>160</Y>
              </TebInstance>
              <TebInstance z:Id="t3">
                <AnonymousClass i:type="GlobalDataTebClass">
                  <Header>Данные</Header>
                  <Id><ClassGuid>44444444-0000-0000-0000-000000000004</ClassGuid><LibraryId i:nil="true"/></Id>
                  <GpssEntities><Items>
                    <GpssEntityOfTeb><GpssInstance i:type="Storage"><_name>Bench</_name><_typeObject>Storage</_typeObject><_capacityString>2</_capacityString><_description i:nil="true"/></GpssInstance></GpssEntityOfTeb>
                    <GpssEntityOfTeb><GpssInstance i:type="Matrix"><Name i:type="string">Plan</Name><Values i:type="base64Binary">AAEAAAD/////AQAAAAAAAAAHAQAAAAICAAAAAgAAAAMAAAACBgIAAAABMAYDAAAAATAGBAAAAAEwBgUAAAABMAYGAAAAATAGBwAAAAEwCw==</Values></GpssInstance></GpssEntityOfTeb>
                  </Items></GpssEntities>
                </AnonymousClass>
                <InstanceId>node-3</InstanceId>
                <NameInModel><NameInModel>teb3</NameInModel></NameInModel>
                <X>10</X><Y>10</Y>
              </TebInstance>
            </Items></Instances>
          </ChildScheme>
        </SchemeRootTebClass>
        """;

    private static readonly string LibraryClass = $$"""
        <SimpleTebClass z:Id="i1" {{Namespaces}}>
          <Header>Обслуживание на верстаке</Header>
          <Id><ClassGuid>22222222-0000-0000-0000-000000000002</ClassGuid><LibraryId><Guid>33333333-0000-0000-0000-000000000003</Guid><Version>1.0.0.0</Version></LibraryId></Id>
          <GpssModel><Text> ENTER Bench
         ADVANCE 4
         LEAVE Bench
         TERMINATE 1</Text></GpssModel>
          <Inputs><Items><TebInputDefinition><ConnectionsLimit>0</ConnectionsLimit><Id>1</Id><ConnectedBlock><Label i:nil="true"/><Mode>FirstBlock</Mode></ConnectedBlock></TebInputDefinition></Items></Inputs>
          <Outputs><Items/></Outputs>
        </SimpleTebClass>
        """;

    private static byte[] Library()
    {
        using var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            void Add(string name, string content)
            {
                using var writer = new StreamWriter(zip.CreateEntry(name).Open(), new UTF8Encoding(false));
                writer.Write(content);
            }

            Add("Format", """<string xmlns="http://schemas.microsoft.com/2003/10/Serialization/">1.0</string>""");
            Add("Id", """<TebsLibraryIdentifier xmlns="http://schemas.datacontract.org/2004/07/Tebs.Core.Libraries"><Guid>33333333-0000-0000-0000-000000000003</Guid><Version>1.0.0.0</Version></TebsLibraryIdentifier>""");
            Add("Name", """<string xmlns="http://schemas.microsoft.com/2003/10/Serialization/">Типовые решения</string>""");
            Add("IsEditable", """<boolean xmlns="http://schemas.microsoft.com/2003/10/Serialization/">false</boolean>""");
            Add("RootCategory/Цех/22222222-0000-0000-0000-000000000002", LibraryClass);
        }

        return buffer.ToArray();
    }

    private static MemoryStream ProjectArchive()
    {
        var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            void Add(string name, byte[] content)
            {
                using var stream = zip.CreateEntry(name).Open();
                stream.Write(content);
            }

            var modelText = new byte[32].Concat(Encoding.Latin1.GetBytes(RtfText.FromPlainText("* старый текст\n GENERATE 1\n TERMINATE 1"))).ToArray();
            Add("Мастерская/Project.gsproj", Encoding.UTF8.GetBytes(ProjectFile));
            Add("Мастерская/TebsLibraries/33333333-0000-0000-0000-000000000003.1.0.0.0.tlib", Library());
            Add("Мастерская/SimModels/Модель 1/Diagram.gsdiagram", Encoding.UTF8.GetBytes(Diagram));
            Add("Мастерская/SimModels/Модель 1/ModelText.gps", modelText);
            Add("Мастерская/SimModels/Модель 1/Forms/Ввод/Form.fog", FormTests.FormPackage());
        }

        buffer.Position = 0;
        return buffer;
    }

    [Fact]
    public void ReadZip_ImportsProjectModelsSchemeAndLibraries()
    {
        var project = StudioProjectReader.ReadZip(ProjectArchive());

        Assert.Equal("Мастерская", project.Name);
        Assert.Equal("Тестовый проект", project.Description);
        var library = Assert.Single(project.Libraries);
        Assert.Equal("Типовые решения", library.Name);
        Assert.False(library.IsEditable);
        Assert.Equal("Цех", Assert.Single(library.Classes).Category);

        var model = Assert.Single(project.Models);
        Assert.True(model.IsCurrent);
        Assert.Equal(["Ввод"], model.Forms);
        Assert.Equal(3, Assert.Single(model.UserForms).Inputs.Count);
        Assert.Equal("* старый текст\n GENERATE 1\n TERMINATE 1\n", model.ModelText);

        var scheme = model.Scheme!;
        Assert.Equal(3, scheme.Nodes.Count);
        var source = scheme.Nodes[0];
        Assert.Equal(("node-1", "teb1", TebKinds.Simple, "Поступление заказов"), (source.Id, source.NameInModel, source.Kind, source.Header));
        Assert.Equal("#87CEFA", source.BackgroundColor);
        Assert.Equal((100d, 40d, 170d), (source.X, source.Y, source.Width));

        var server = scheme.Nodes[1];
        Assert.Equal("Обслуживание на верстаке", server.Header);
        Assert.Equal("33333333-0000-0000-0000-000000000003", server.LibraryId);
        Assert.Contains("ADVANCE 4", server.GpssText);

        var data = scheme.Nodes[2];
        Assert.Equal(TebKinds.Data, data.Kind);
        Assert.Equal(("Storage", "Bench", "2"), (data.Entities[0].Type, data.Entities[0].Name, data.Entities[0].Value));
        Assert.Equal(2, data.Entities[1].Cells!.Count);

        var link = Assert.Single(scheme.Links);
        Assert.Equal(("node-1", 1, "node-2", 1), (link.FromNodeId, link.FromPortId, link.ToNodeId, link.ToPortId));
        Assert.Equal(2, link.Points.Count);
        Assert.Single(scheme.Decors);
        Assert.Empty(project.ImportNotes);
    }

    [Fact]
    public void ImportedScheme_GeneratesARunnableModel()
    {
        var model = StudioProjectReader.ReadZip(ProjectArchive()).Models[0];

        var result = ModelGenerator.Generate(model.Scheme!, model.Name);

        Assert.True(result.Success, string.Join("\n", result.Messages));
        Assert.Contains("Bench STORAGE 2", result.Text);
        Assert.Contains("teb2_autoGenerated1_firstBlock ENTER Bench", result.Text);
        var (_, run) = Simulation.SimulationSession.Create(result.Text + "START 3\n", model.Name);
        Assert.Equal("completed", run.State);
    }

    [Fact]
    public void ReadZip_WithoutProjectFile_UsesLooseModelFiles()
    {
        using var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            using var writer = new StreamWriter(zip.CreateEntry("model.gps").Open());
            writer.Write(" GENERATE 1\n TERMINATE 1\n");
        }

        buffer.Position = 0;
        var project = StudioProjectReader.ReadZip(buffer);

        Assert.Equal(" GENERATE 1\n TERMINATE 1\n", Assert.Single(project.Models).ModelText);
        Assert.NotEmpty(project.ImportNotes);
    }

    [Fact]
    public void ReadZip_RejectsArchivesWithoutProjectFiles()
    {
        using var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            using var writer = new StreamWriter(zip.CreateEntry("readme.txt").Open());
            writer.Write("nothing here");
        }

        buffer.Position = 0;
        Assert.Throws<InvalidDataException>(() => StudioProjectReader.ReadZip(buffer));
    }
}
