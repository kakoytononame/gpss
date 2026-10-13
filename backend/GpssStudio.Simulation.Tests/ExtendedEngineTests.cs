using GpssStudio.Simulation.Expressions;
using static GpssStudio.Simulation.Tests.SimulationTestHelpers;

namespace GpssStudio.Simulation.Tests;

/// <summary>GPSS World features used by the GPSS Studio sample projects.</summary>
public sealed class ExtendedEngineTests
{
    [Theory]
    [InlineData("2#3", 6)]
    [InlineData("1+2#3", 7)]
    [InlineData("7@4#2", 7)]
    [InlineData("2+3 'G' 4", 1)]
    [InlineData("1 'E' 1 'E' 1", 1)]
    [InlineData("2<3=1", 1)]
    [InlineData("1 'AND' 0 'OR' 1", 1)]
    [InlineData("4<>4", 0)]
    [InlineData("MX$M(2,3)", 23)]
    public void Expressions_FollowGpssWorldPrecedence(string text, double expected)
    {
        Assert.Equal(expected, ExpressionParser.Parse(text).Evaluate(new TestContext(), null), 6);
    }

    [Fact]
    public void Expressions_ParseIndirectAddressing()
    {
        var queue = Assert.IsType<SnaExpr>(ExpressionParser.Parse("Q*Line"));
        Assert.True(queue.Indirect);
        Assert.Equal("Line", queue.Argument);

        var parameter = Assert.IsType<SnaExpr>(ExpressionParser.Parse("*3"));
        Assert.Equal("P", parameter.Family);

        var cell = Assert.IsType<MatrixCellExpr>(ExpressionParser.Parse("MX*Sales(*Part,2)"));
        Assert.True(cell.Indirect);
    }

    [Fact]
    public void EquNumbers_AddressTheSameEntityAsNames()
    {
        var (session, result) = Run("""
            Dock   EQU 2
            Dock   STORAGE 3
                   GENERATE 1,,,1
                   ASSIGN Target,2
                   ENTER  P$Target,2
                   SAVEVALUE Left,R$Dock
                   SAVEVALUE ByNumber,S2
                   TERMINATE 1
                   START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(1, session.Engine.Savevalue("Left").Value);
        Assert.Equal(2, session.Engine.Savevalue("ByNumber").Value);
        Assert.Single(session.Engine.Storages);
    }

    [Fact]
    public void Matrices_InitialMsavevalueAndMx()
    {
        var (session, result) = Run("""
            Stock  MATRIX ,2,2
                   INITIAL MX$Stock(1,2),5
                   GENERATE 1,,,3
                   MSAVEVALUE Stock+,1,2,10
                   MSAVEVALUE Stock,2,1,(MX$Stock(1,2)#2)
                   TERMINATE 1
                   START 3
            """);

        Assert.True(result.Success, result.RuntimeError);
        var matrix = Assert.Single(session.Engine.Matrices);
        Assert.Equal(35, matrix[1, 2]);
        Assert.Equal(70, matrix[2, 1]);
    }

    [Fact]
    public void Matrices_OutOfRangeCellIsARuntimeError()
    {
        var (_, result) = Run("""
            M      MATRIX ,1,1
                   GENERATE 1,,,1
                   MSAVEVALUE M,2,1,1
                   TERMINATE 1
                   START 1
            """);

        Assert.False(result.Success);
        Assert.Contains("вне границ", result.RuntimeError);
    }

    [Fact]
    public void Functions_AcceptExpressionPointsAndIgnoreExtraPoints()
    {
        var (session, result) = Run("""
                   INITIAL X$Shift,2
            Rate   FUNCTION C1,D2
            (X$Shift#10),1/100,7/200,9
                   GENERATE 5,,,2
                   SAVEVALUE Last,FN$Rate
                   TERMINATE 1
                   START 2
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(1, session.Engine.Savevalue("Last").Value);
    }

    [Fact]
    public void CountAndSelect_ScanEntityRanges()
    {
        var (session, result) = Run("""
            B1     EQU 1
            B2     EQU 2
            B3     EQU 3
            B1     STORAGE 1
            B2     STORAGE 1
            B3     STORAGE 1
                   GENERATE ,,,1
                   ENTER  B1
                   COUNT SNF Free,B1,B3
                   SELECT SNF Next,B1,B3
                   SELECT MAX Biggest,B1,B3,,R
                   SELECT E None,B1,B3,5,R,Fallback
                   SAVEVALUE Unreached,1
            Fallback SAVEVALUE Free,P$Free
                   SAVEVALUE Next,P$Next
                   SAVEVALUE None,P$None
                   LEAVE B1
                   TERMINATE 1
                   START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(2, session.Engine.Savevalue("Free").Value);
        Assert.Equal(2, session.Engine.Savevalue("Next").Value);
        Assert.Equal(0, session.Engine.Savevalue("None").Value);
        Assert.Equal(0, session.Engine.Savevalue("Unreached").Value);
    }

    [Fact]
    public void TransactionGroups_JoinScanAlterRemoveExamine()
    {
        var (session, result) = Run("""
                   GENERATE 1,,,3
                   SAVEVALUE Made+,1
                   ASSIGN Size,X$Made
                   JOIN   Parts
                   ADVANCE 10
                   TERMINATE
                   GENERATE 5,,,1
                   SCAN   G Parts,Size,1,Size,Found
                   ALTER  Parts,ALL,Price,7
                   REMOVE E Parts,1,,Size,1
                   EXAMINE Parts,,Outside
                   SAVEVALUE Member,1
            Outside SAVEVALUE Count,GT$Parts
                   SAVEVALUE Found,P$Found
                   JOIN   Codes,42
                   EXAMINE Codes,42,Missing
                   SAVEVALUE Has42,1
            Missing TERMINATE 1
                   START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(2, session.Engine.Savevalue("Found").Value);
        Assert.Equal(2, session.Engine.Savevalue("Count").Value);
        Assert.Equal(0, session.Engine.Savevalue("Member").Value);
        Assert.Equal(1, session.Engine.Savevalue("Has42").Value);
        Assert.All(session.Engine.TransactionGroups.Single().Members, member => Assert.Equal(7, member.GetParameter("Price")));
    }

    [Fact]
    public void Displace_MovesADelayedTransaction()
    {
        var (session, result) = Run("""
                   GENERATE ,,,1
                   ADVANCE 100
                   SAVEVALUE Slow,AC1
                   TERMINATE 1
            Early  SAVEVALUE Early,AC1
                   TERMINATE 1
                   GENERATE ,,10,1
                   DISPLACE 1,Early,Rest
                   SAVEVALUE Rest,P$Rest
                   TERMINATE
                   START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(10, session.Engine.Savevalue("Early").Value);
        Assert.Equal(90, session.Engine.Savevalue("Rest").Value);
        Assert.Equal(0, session.Engine.Savevalue("Slow").Value);
    }

    [Fact]
    public void Match_SynchronisesFamilyMembers()
    {
        var (session, result) = Run("""
                   GENERATE ,,,1
                   SPLIT  1,Other
                   ADVANCE 3
            Left   MATCH  Right
                   SAVEVALUE LeftTime,AC1
                   TERMINATE 1
            Other  ADVANCE 8
            Right  MATCH  Left
                   SAVEVALUE RightTime,AC1
                   TERMINATE
                   START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(8, session.Engine.Savevalue("LeftTime").Value);
        Assert.Equal(8, session.Engine.Savevalue("RightTime").Value);
    }

    [Fact]
    public void SplitWithoutDestination_SendsCopiesToTheNextBlock()
    {
        var (session, result) = Run("""
                   GENERATE ,,,1
                   SPLIT  2
                   SAVEVALUE Seen+,1
                   TERMINATE 1
                   START 3
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(3, session.Engine.Savevalue("Seen").Value);
    }

    [Fact]
    public void DataStreams_WriteSeekReadInMemory()
    {
        var (session, result) = Run("""
                   GENERATE ,,,1
                   OPEN   ("log.txt"),2
                   WRITE  15,2
                   WRITE  27,2
                   SEEK   2,2
                   READ   Value,2,Eof
                   SAVEVALUE Value,P$Value
                   READ   Value,2,Eof
                   SAVEVALUE Unreached,1
            Eof    CLOSE  Error,2
                   SAVEVALUE Error,P$Error
                   TERMINATE 1
                   START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(27, session.Engine.Savevalue("Value").Value);
        Assert.Equal(0, session.Engine.Savevalue("Unreached").Value);
        Assert.Equal(23, session.Engine.Savevalue("Error").Value);
        Assert.Equal(["15", "27"], session.Engine.Files["log.txt"]);
    }

    [Fact]
    public void Trace_WritesBlockEntriesToTheJournal()
    {
        var (_, result) = Run("""
                   GENERATE ,,,1
                   TRACE
                   ADVANCE 1
                   UNTRACE
                   TERMINATE 1
                   START 1
            """);

        Assert.Contains(result.Journal, line => line.Contains("вошёл в блок 3 ADVANCE"));
        Assert.DoesNotContain(result.Journal, line => line.Contains("вошёл в блок 5"));
    }

    [Fact]
    public void ExecuteAndPlus_PerformOtherBlocks()
    {
        var (session, result) = Run("""
                   GENERATE ,,,1
                   EXECUTE Bump
                   PLUS   (ABS(-6)#2),Twelve
                   SAVEVALUE Twelve,P$Twelve
                   TERMINATE 1
            Bump   SAVEVALUE Count+,5
                   TERMINATE
                   START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(5, session.Engine.Savevalue("Count").Value);
        Assert.Equal(12, session.Engine.Savevalue("Twelve").Value);
    }

    [Fact]
    public void NulPaddingAndLegacyOperatorComma_AreAccepted()
    {
        var (_, result) = Run("B1 STORAGE 1\n GENERATE ,,,1\n SELECT SNF,Free,B1,B1\n TERMINATE 1\n START 1\n\0\0");

        Assert.True(result.Success, result.RuntimeError);
    }

    private sealed class TestContext : IEvaluationContext
    {
        public double Sna(string family, string argument, Runtime.Transaction? transaction) => 0;
        public double NameValue(string name) => 0;
        public double Random(int stream) => 0.5;
        public double MatrixValue(string matrix, int row, int column) => row * 10 + column;
    }
}

public sealed class DebuggerTests
{
    private const string Model = """
               GENERATE 10,,,3
               QUEUE  Line
               SEIZE  Server
        Serve  DEPART Line
               ADVANCE 25
               RELEASE Server
               TERMINATE 1
        """;

    [Fact]
    public void Stop_HaltsBeforeTheBlockAndContinuePassesIt()
    {
        var (session, _) = SimulationTestHelpers.Run(Model);

        session.Execute("STOP ,Serve");
        var stopped = session.Execute("START 3");

        Assert.Equal("paused", stopped.State);
        Assert.Contains("перед входом в блок 4 DEPART (Serve)", stopped.StopReason);
        Assert.Equal(10, stopped.Clock);
        Assert.Equal([new BreakpointInfo(0, 4, 4)], stopped.Breakpoints);
        var first = Assert.Single(stopped.Transactions, transaction => transaction.Number == 1);
        Assert.Equal((3, 4, "Текущих событий"), (first.CurrentBlock, first.NextBlock, first.Chain));

        var next = session.Execute("CONTINUE");
        Assert.Equal("paused", next.State);
        Assert.Equal(35, next.Clock);
        Assert.Contains(next.Transactions, transaction => transaction.Chain == "Ожидает устройство Server");

        session.Execute("STOP");
        Assert.Equal("completed", session.Execute("CONTINUE").State);
    }

    [Fact]
    public void Stop_ForOneTransactionAndOff()
    {
        var (session, _) = SimulationTestHelpers.Run(Model);

        session.Execute("STOP 2,Serve");
        Assert.Equal(35, session.Execute("START 3").Clock);
        session.Execute("STOP 2,Serve,OFF");
        Assert.Empty(session.Snapshot().Breakpoints);
        Assert.Equal("Неизвестная метка", session.Execute("STOP ,Nowhere").RuntimeError is { } error && error.Contains("Nowhere") ? "Неизвестная метка" : "нет ошибки");
    }

    [Fact]
    public void Result_ListsBlockLines()
    {
        var (session, _) = SimulationTestHelpers.Run(Model);

        Assert.Equal([1, 2, 3, 4, 5, 6, 7], session.Snapshot().BlockLines);
    }
}
