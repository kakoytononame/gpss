using static GpssStudio.Simulation.Tests.SimulationTestHelpers;

namespace GpssStudio.Simulation.Tests;

public sealed class EngineTests
{
    private const string SingleServer = """
                GENERATE 10
                QUEUE    WAIT
                SEIZE    SERVER
                DEPART   WAIT
                ADVANCE  5
                RELEASE  SERVER
                TERMINATE 1
        """;

    [Fact]
    public void DeterministicSingleServer_ProducesExactStatistics()
    {
        var (session, _) = Run(SingleServer + "\n START 5");
        var report = session.Snapshot().Report!;

        Assert.Equal(55, session.Engine.AbsoluteClock);
        Assert.Equal(["SERVER", "5", "0.455", "5.000", "1", "0", "0", "0", "0", "0"], Row(report, "facilities", "SERVER"));
        var queue = Row(report, "queues", "WAIT");
        Assert.Equal("5", queue[3]);
        Assert.Equal("5", queue[4]);
        Assert.Equal("0.000", queue[6]);
        var blocks = report.Sections.Single(section => section.Id == "blocks").Rows;
        Assert.All(blocks.Take(6), row => Assert.True(Number(row[3]) >= 5));
    }

    [Fact]
    public void Queueing_WaitingTimesAreMeasured()
    {
        // Arrivals every 2, service 3: the server is busy from t=2 until the 10th departure at t=32.
        var (session, _) = Run(SingleServer.Replace("GENERATE 10", "GENERATE 2").Replace("ADVANCE  5", "ADVANCE  3") + "\n START 10");
        var queue = Row(session.Snapshot().Report!, "queues", "WAIT");

        Assert.True(Number(queue[1]) >= 4, $"max content {queue[1]}");
        Assert.True(Number(queue[6]) > 0);
        Assert.Equal(32, session.Engine.AbsoluteClock);
        Assert.Equal("0.938", Row(session.Snapshot().Report!, "facilities", "SERVER")[2]);
    }

    [Fact]
    public void MM1_UtilisationMatchesTheory()
    {
        var model = """
                  GENERATE (Exponential(1,0,10))
                  SEIZE    SRV
                  ADVANCE  (Exponential(2,0,6))
                  RELEASE  SRV
                  TERMINATE 1
                  START 5000
            """;
        var (session, _) = Run(model);
        var utilisation = Number(Row(session.Snapshot().Report!, "facilities", "SRV")[2]);

        Assert.InRange(utilisation, 0.55, 0.65);
    }

    [Fact]
    public void Storage_LimitsConcurrencyAndWakesWaiters()
    {
        var model = """
            ROOM      STORAGE 2
                      GENERATE 1,,,6
                      ENTER    ROOM
                      ADVANCE  10
                      LEAVE    ROOM
                      TERMINATE 1
                      START 6
            """;
        var (session, _) = Run(model);
        var storage = Row(session.Snapshot().Report!, "storages", "ROOM");

        // Arrivals at 1..6, two channels, service 10: pairs finish at 11/12, 21/22, 31/32.
        Assert.Equal(32, session.Engine.AbsoluteClock);
        Assert.Equal("2", storage[4]);
        Assert.Equal("6", storage[5]);
    }

    [Fact]
    public void TransferFraction_SplitsFlowStatistically()
    {
        var model = """
                  GENERATE 1
                  TRANSFER .25,,SIDE
                  TERMINATE 1
            SIDE  TERMINATE 1
                  START 4000
            """;
        var (session, _) = Run(model);
        var side = session.Engine.Blocks.Single(block => block.Label == "SIDE").EntryCount;

        Assert.InRange(side, 850, 1150);
    }

    [Fact]
    public void TestAndGate_BlockUntilConditionHolds()
    {
        var model = """
                  GENERATE 1,,,3
                  TEST GE  X$OPEN,1
                  TERMINATE 1
                  GENERATE ,,20,1
                  SAVEVALUE OPEN,1
                  LOGIC S  SW
                  TERMINATE
                  GENERATE ,,30,1
                  GATE LS  SW
                  TERMINATE 1
                  START 4
            """;
        var (session, _) = Run(model);

        Assert.Equal(30, session.Engine.AbsoluteClock);
        Assert.Equal(3, session.Engine.Blocks[2].EntryCount);
    }

    [Fact]
    public void SplitAndAssemble_RejoinFamily()
    {
        var model = """
                  GENERATE 10,,,2
                  SPLIT    2,WORK
            WORK  ADVANCE  3
                  ASSEMBLE 3
                  TERMINATE 1
                  START 2
            """;
        var (session, _) = Run(model);

        Assert.Equal(23, session.Engine.AbsoluteClock);
        Assert.Equal(6, session.Engine.Blocks.Single(block => block.Operation == "ASSEMBLE").EntryCount);
    }

    [Fact]
    public void AssignLoopAndParameters_Work()
    {
        var model = """
                  GENERATE ,,,1
                  ASSIGN   COUNT,3
            AGAIN ADVANCE  2
                  SAVEVALUE TOTAL+,1
                  LOOP     COUNT,AGAIN
                  TERMINATE 1
                  START 1
            """;
        var (session, _) = Run(model);

        Assert.Equal(6, session.Engine.AbsoluteClock);
        Assert.Equal("3.000", Row(session.Snapshot().Report!, "savevalues", "TOTAL")[2]);
    }

    [Fact]
    public void LinkAndUnlink_MoveTransactionsBetweenChains()
    {
        var model = """
                  GENERATE 1,,,3
                  LINK     WAITING,FIFO
                  GENERATE ,,10,1
                  UNLINK   WAITING,DONE,ALL
                  TERMINATE
            DONE  TERMINATE 1
                  START 3
            """;
        var (session, _) = Run(model);

        Assert.Equal(10, session.Engine.AbsoluteClock);
    }

    [Fact]
    public void PreemptAndReturn_ResumeInterruptedTransaction()
    {
        var model = """
                  GENERATE ,,0,1
                  SEIZE    MACHINE
                  ADVANCE  10
                  RELEASE  MACHINE
                  TERMINATE 1
                  GENERATE ,,4,1
                  PREEMPT  MACHINE
                  ADVANCE  3
                  RETURN   MACHINE
                  TERMINATE
                  START 1
            """;
        var (session, _) = Run(model);

        Assert.Equal(13, session.Engine.AbsoluteClock);
    }

    [Fact]
    public void Tables_CollectFrequencies()
    {
        var model = """
            TT    TABLE    M1,5,5,4
                  GENERATE 1,,,4
                  ADVANCE  P$DELAY
                  TABULATE TT
                  TERMINATE 1
                  START 4
            """;
        var (session, _) = Run(model);

        var table = Assert.Single(session.Engine.Tables);
        Assert.Equal(4, table.WeightedCount);
        Assert.Equal(0, table.Mean);
    }

    [Fact]
    public void FunctionsAndVariables_AreEvaluated()
    {
        var model = """
            DISC  FUNCTION P1,D3
            1,10/2,20/3,30
            SUM   VARIABLE FN$DISC+5
                  GENERATE ,,,1
                  ASSIGN   1,2
                  SAVEVALUE RES,V$SUM
                  TERMINATE 1
                  START 1
            """;
        var (session, _) = Run(model);

        Assert.Equal("25.000", Row(session.Snapshot().Report!, "savevalues", "RES")[2]);
    }

    [Fact]
    public void RandomNumbers_AreReproducible()
    {
        const string model = "  GENERATE (Exponential(1,0,3))\n  TERMINATE 1\n  START 50";

        Assert.Equal(Run(model).Session.Engine.AbsoluteClock, Run(model).Session.Engine.AbsoluteClock);
    }

    [Fact]
    public void StepContinueResetClearAndShow_Commands()
    {
        var (session, created) = Run(SingleServer);
        Assert.Equal("idle", created.State);

        var step = session.Execute("STEP 3");
        Assert.Equal("paused", step.State);
        Assert.Equal(3, step.Journal.Count(line => line.StartsWith("Транзакт 1 вошёл")));

        Assert.Equal("completed", session.Execute("CONTINUE").State);
        Assert.Equal(15, session.Engine.AbsoluteClock);

        Assert.Contains("F$SERVER = 0", session.Execute("SHOW F$SERVER").Journal);

        session.Execute("RESET");
        Assert.Equal(0, session.Engine.Blocks[0].EntryCount);

        session.Execute("CLEAR");
        Assert.Equal(0, session.Engine.AbsoluteClock);
        Assert.Empty(session.Engine.FutureEvents);

        Assert.Equal("completed", session.Execute("START 2").State);
        Assert.Equal(25, session.Engine.AbsoluteClock);

        var bad = session.Execute("JUMP 3");
        Assert.False(bad.Success);
    }

    [Fact]
    public void RuntimeErrors_AreReportedNotThrown()
    {
        var (_, releaseError) = Run("  GENERATE ,,,1\n  RELEASE NOTMINE\n  TERMINATE 1\n  START 1");
        Assert.False(releaseError.Success);
        Assert.Contains("NOTMINE", releaseError.RuntimeError);

        var (_, deadlock) = Run("  GENERATE ,,,1\n  TEST E 1,2\n  TERMINATE 1\n  START 1");
        Assert.False(deadlock.Success);
        Assert.Contains("заблокирована", deadlock.RuntimeError);

        var (_, storage) = Run("  GENERATE ,,,1\n  ENTER UNKNOWN\n  TERMINATE 1\n  START 1");
        Assert.Contains("STORAGE", storage.RuntimeError);
    }

    [Fact]
    public void RunawayModel_StopsAtTheLimit()
    {
        var (_, result) = Run("  GENERATE 1\n  TEST L Q$A,0\n  TERMINATE 1\n  START 1");

        Assert.False(result.Success);
        Assert.Contains("транзакт", result.RuntimeError, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void EndlessLoopWithinOneInstant_StopsAtTheLimit()
    {
        var (session, _) = SimulationSession.Create("  GENERATE 1\n  TRANSFER ,LOOPX\nLOOPX TRANSFER ,LOOPX", "Тест");
        session!.Engine.MaxBlockEntries = 100_000;

        var result = session.Execute("START 1");

        Assert.False(result.Success);
        Assert.Contains("предел", result.RuntimeError);
    }

    [Fact]
    public void CanteenModel_RunsForOneDay()
    {
        var text = ExampleModels.Find("canteen")!.Text;
        var (session, result) = Run(text);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(1440, session.Engine.AbsoluteClock);
        var report = result.Report!;
        Assert.Equal(10, report.Sections.Single(section => section.Id == "facilities").Rows.Count);
        Assert.Equal(["HOLL", "STOLIKI"], report.Sections.Single(section => section.Id == "storages").Rows.Select(row => row[0]));
        Assert.All(report.Charts.FacilityUtilization, bar => Assert.InRange(bar.Value, 0.1, 0.6));
        Assert.NotEmpty(report.Charts.TimeSeries);
        Assert.Single(report.Charts.Tables);
    }
}
