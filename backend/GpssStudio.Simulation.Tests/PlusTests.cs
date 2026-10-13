using GpssStudio.Simulation.Plus;

namespace GpssStudio.Simulation.Tests;

/// <summary>PLUS procedures and TRANSFER FN.</summary>
public sealed class PlusTests
{
    private const string Procedures = """
        * Average of the non-zero arguments
        PROCEDURE Calc_P(par1,par2,par3) BEGIN
        TEMPORARY Calc,Num;
        Calc=0;
        Num=0;
        IF (par1 /= 0) THEN BEGIN
        Calc=Calc+par1;
        Num=Num+1;
        END;

        IF (par2 /= 0) THEN BEGIN
        Calc=Calc+par2;
        Num=Num+1;
        END;
        IF (par3 'NE' 0) THEN BEGIN Calc=Calc+par3; Num=Num+1; END;

        IF(Num /= 0) THEN
        Calc=Calc/Num;
        ELSE RETURN 0;

        RETURN Calc;
        END;

        PROCEDURE Factorial(N) BEGIN
        TEMPORARY Acc,I;
        Acc=1;
        I=1;
        WHILE (I <= N) DO BEGIN
        Acc=Acc#I;
        I=I+1;
        END;
        RETURN Acc;
        END;

        PROCEDURE Fib(N) BEGIN
        IF (N < 2) THEN RETURN N;
        RETURN Fib(N-1)+Fib(N-2);
        END;

        PROCEDURE Count_Calls(Step) BEGIN
        Calls = Calls + Step;
        IF (Calls < 10) THEN GOTO Done;
        Calls = 100;
        Done: RETURN Calls;
        END;
        """;

    [Theory]
    [InlineData("Calc_P(4,0,8)", 6)]
    [InlineData("Calc_P(0,0,0)", 0)]
    [InlineData("Factorial(5)", 120)]
    [InlineData("Fib(10)", 55)]
    public void Procedures_AreCalledFromExpressions(string call, double expected)
    {
        var (session, result) = SimulationSession.Create(Procedures + "\nCalls EQU 0\nGENERATE 1\nTERMINATE 1", "PLUS");
        Assert.True(result.Success, string.Join("; ", result.Errors));

        Assert.Equal(expected, session!.Evaluate([call])[0]);
    }

    [Fact]
    public void Assignments_ToGlobalNamesPersistBetweenCalls()
    {
        var (session, _) = SimulationSession.Create(Procedures + "\nCalls EQU 0\nGENERATE 1\nTERMINATE 1", "PLUS");

        Assert.Equal([4.0, 8.0, 100.0, 100.0], session!.Evaluate(["Count_Calls(4)", "Count_Calls(4)", "Count_Calls(4)", "Calls"]));
    }

    [Fact]
    public void Blocks_UseProcedureResults()
    {
        const string model = """
            PROCEDURE Delay(Kind) BEGIN
              IF (Kind = 1) THEN RETURN 5;
              ELSE RETURN 20;
            END;
                   GENERATE 10
                   ASSIGN Kind,(1+P$Kind)
                   ADVANCE (Delay(1))
                   TERMINATE 1
            """;
        var (session, result) = SimulationSession.Create(model, "PLUS");
        Assert.True(result.Success, string.Join("; ", result.Errors));

        Assert.Equal(25, session!.Execute("START 2").Clock);
    }

    [Fact]
    public void TransferFn_JumpsToTheBlockGivenByAListFunction()
    {
        const string model = """
            Route  FUNCTION P$Kind,L2
            1,Left/2,Right
                   GENERATE 1,,,4
                   ASSIGN Kind,(XN1@2+1)
            Fork   TRANSFER FN,Route
            Left   SAVEVALUE Lefts+,1
                   TERMINATE 1
            Right  SAVEVALUE Rights+,1
                   TERMINATE 1
            """;
        var (session, result) = SimulationSession.Create(model, "FN");
        Assert.True(result.Success, string.Join("; ", result.Errors));

        var run = session!.Execute("START 4");
        Assert.True(run.Success, run.RuntimeError);
        Assert.Equal([2.0, 2.0], session.Evaluate(["X$Lefts", "X$Rights"]));
    }

    [Theory]
    [InlineData("PROCEDURE P(a) BEGIN RETURN a; ", "END")]
    [InlineData("PROCEDURE P(a) BEGIN IF a > 1 THEN RETURN 1; END;", "\"(\"")]
    [InlineData("PROCEDURE P(a) BEGIN TEMPORARY MATRIX M[2,2]; END;", "MATRIX")]
    public void Errors_AreReported(string text, string fragment)
    {
        var exception = Assert.Throws<FormatException>(() => PlusParser.ParseProcedure(text));
        Assert.Contains(fragment, exception.Message);
    }

    [Fact]
    public void FindEnd_StopsAtTheEndOfTheBody()
    {
        string[] lines = ["PROCEDURE A(x)", "BEGIN", "IF (x) THEN BEGIN", "* END comment", "x=1; END;", "RETURN x; END;", "GENERATE 1"];

        Assert.Equal(5, PlusParser.FindEnd(lines, 0));
        Assert.Equal(0, PlusParser.FindEnd(["PROCEDURE B(y) RETURN y+1;", "GENERATE 1"], 0));
    }
}
