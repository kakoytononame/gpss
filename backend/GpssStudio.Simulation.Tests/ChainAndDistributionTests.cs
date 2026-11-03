using static GpssStudio.Simulation.Tests.SimulationTestHelpers;

namespace GpssStudio.Simulation.Tests;

/// <summary>Delay and user chain ordering, UNLINK selection and the Gamma/Weibull library procedures.</summary>
public sealed class ChainAndDistributionTests
{
    [Fact]
    public void StorageDelayChain_ServesHigherPriorityFirst()
    {
        var (session, result) = Run("""
            Desk    STORAGE  1
                    GENERATE ,,0,1
                    ENTER    Desk
                    ADVANCE  10
                    LEAVE    Desk
                    TERMINATE
                    GENERATE ,,1,1,0
                    ASSIGN   Kind,1
                    TRANSFER ,Use
                    GENERATE ,,2,1,5
                    ASSIGN   Kind,2
            Use     ENTER    Desk
                    TEST E   X$First,0,Done
                    SAVEVALUE First,P$Kind
            Done    ADVANCE  1
                    LEAVE    Desk
                    TERMINATE
                    GENERATE 100
                    TERMINATE 1
                    START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(2, session.Engine.Savevalue("First").Value);
    }

    [Fact]
    public void UserChain_ParameterOrderBackAndMatchingUnlink()
    {
        // Ids 1, 2, 3 with Prio 3, 1, 2: the chain in Prio order holds 2, 3, 1.
        var (session, result) = Run("""
                    GENERATE 1,,1,3
                    SAVEVALUE Count+,1
                    ASSIGN   Id,X$Count
                    ASSIGN   Prio,((P$Id=1)#3+(P$Id=2)#1+(P$Id=3)#2)
                    LINK     Wait,Prio
            Out     SAVEVALUE Seq,(X$Seq#10+P$Id)
                    TERMINATE
                    GENERATE ,,10,1
                    UNLINK   Wait,Out,1
                    ADVANCE  1
                    UNLINK   Wait,Out,1,BACK
                    ADVANCE  1
                    UNLINK   Wait,Out,1,Id,99,Miss
                    TRANSFER ,Skip
            Miss    SAVEVALUE Missed,1
            Skip    UNLINK   Wait,Out,1,Id,3
                    ADVANCE  1
                    TERMINATE 1
                    START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(213, session.Engine.Savevalue("Seq").Value);
        Assert.Equal(1, session.Engine.Savevalue("Missed").Value);
    }

    [Fact]
    public void UnlinkWithoutValue_ComparesWithTheActiveTransactionsParameter()
    {
        var (session, result) = Run("""
                    GENERATE 1,,1,3
                    SAVEVALUE Count+,1
                    ASSIGN   Id,X$Count
                    LINK     Wait,FIFO
            Out     SAVEVALUE Got,P$Id
                    TERMINATE
                    GENERATE ,,10,1
                    ASSIGN   Id,2
                    UNLINK   Wait,Out,ALL,Id
                    ADVANCE  1
                    SAVEVALUE Left,CH$Wait
                    TERMINATE 1
                    START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(2, session.Engine.Savevalue("Got").Value);
        Assert.Equal(2, session.Engine.Savevalue("Left").Value);
    }

    [Fact]
    public void UserChain_PriorityOrder()
    {
        // Priorities 1, 5, 5, 3 for Ids 1..4: PR order is 2, 3, 4, 1.
        var (session, result) = Run("""
                    GENERATE 1,,1,4
                    SAVEVALUE Count+,1
                    ASSIGN   Id,X$Count
                    PRIORITY ((P$Id=1)#1+(P$Id=2)#5+(P$Id=3)#5+(P$Id=4)#3)
                    LINK     Wait,PR
            Out     SAVEVALUE Seq,(X$Seq#10+P$Id)
                    TERMINATE
                    GENERATE ,,10,1,10
                    ASSIGN   Left,4
            Next    UNLINK   Wait,Out,1
                    ADVANCE  1
                    LOOP     Left,Next
                    TERMINATE 1
                    START 1
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.Equal(2341, session.Engine.Savevalue("Seq").Value);
    }

    [Theory]
    [InlineData("Gamma(1,0,2,3)", 6, 48)]
    [InlineData("Gamma(2,0,2,0.5)", 1, 3)]
    [InlineData("Weibull(3,0,2,2)", 1.7724539, 4)]
    [InlineData("Weibull(4,1,1,1)", 2, 5)]
    public void LibraryProcedures_HaveTheExpectedMoments(string procedure, double mean, double secondMoment)
    {
        const int samples = 40_000;
        var (session, result) = Run($"""
                    GENERATE 1
                    ASSIGN   X,({procedure})
                    SAVEVALUE Sum+,P$X
                    SAVEVALUE Sq+,(P$X#P$X)
                    TERMINATE 1
                    START {samples}
            """);

        Assert.True(result.Success, result.RuntimeError);
        Assert.InRange(session.Engine.Savevalue("Sum").Value / samples, mean * 0.97, mean * 1.03);
        Assert.InRange(session.Engine.Savevalue("Sq").Value / samples, secondMoment * 0.94, secondMoment * 1.06);
    }
}
