using GpssStudio.Simulation.Expressions;
using GpssStudio.Simulation.Parsing;
using GpssStudio.Simulation.Translation;

namespace GpssStudio.Simulation.Tests;

public sealed class TranslatorTests
{
    [Fact]
    public void Parser_RecognisesLabelsCommentsAndAuxiliaryOperators()
    {
        var errors = new List<TranslationError>();
        var statements = SourceParser.Parse("* comment line\nLBL  TEST GE  Q$BUF,5,EXIT ; trailing comment\n     GENERATE (Exponential(1, 0, 4)),,,5", errors);

        Assert.Empty(errors);
        Assert.Equal(2, statements.Count);
        Assert.Equal("LBL", statements[0].Label);
        Assert.Equal("GE", statements[0].Auxiliary);
        Assert.Equal(["Q$BUF", "5", "EXIT"], statements[0].Operands);
        // Whitespace inside parentheses is insignificant.
        Assert.Equal(["(Exponential(1,0,4))", "", "", "5"], statements[1].Operands);
    }

    [Fact]
    public void Translate_ReportsErrorsWithLineNumbersInOrder()
    {
        var model = Translator.Translate("  SEIZE\n  TRANSFER ,NOWHERE\nX FOO 1\n  COUNT L 1,2\n  GENERATE (1+\n");

        Assert.False(model.Succeeded);
        Assert.Equal([1, 2, 3, 4, 5], model.Errors.Select(error => error.Line));
        Assert.Contains("NOWHERE", model.Errors[1].Message);
        Assert.Contains("не поддерживается", model.Errors[3].Message);
    }

    [Fact]
    public void Translate_DuplicateLabel_IsAnError()
    {
        var model = Translator.Translate("A GENERATE 1\nA TERMINATE 1");

        Assert.Contains(model.Errors, error => error.Message.Contains("повторно"));
    }

    [Fact]
    public void Translate_ReadsFunctionFollowerLines()
    {
        var model = Translator.Translate("XPDIS FUNCTION RN1,C3\n0,0/.5,.69/1,2\n  GENERATE 10,FN$XPDIS\n  TERMINATE 1");

        Assert.True(model.Succeeded, string.Join(";", model.Errors));
        Assert.Equal(3, model.Functions["XPDIS"].Points.Count);
        Assert.Equal(1, model.Functions["XPDIS"].RandomStream);
    }

    [Theory]
    [InlineData("2+3*4", 14)]
    [InlineData("(2+3)*4", 20)]
    [InlineData("2^3^2", 512)]
    [InlineData("7\\2", 3)]
    [InlineData("7@4", 3)]
    [InlineData("-3+5", 2)]
    [InlineData("(3 'G' 2)", 1)]
    [InlineData("(3<=2)", 0)]
    [InlineData("ABS(-4)+INT(2.7)", 6)]
    public void Expressions_Evaluate(string text, double expected)
    {
        Assert.Equal(expected, ExpressionParser.Parse(text).Evaluate(new ConstantContext(), null), 6);
    }

    [Theory]
    [InlineData("Q$BUF", "Q", "BUF")]
    [InlineData("P1", "P", "1")]
    [InlineData("RN3", "RN", "3")]
    [InlineData("FN$DIST", "FN", "DIST")]
    [InlineData("AC1", "AC1", "")]
    public void Expressions_RecogniseSnas(string text, string family, string argument)
    {
        var expression = Assert.IsType<SnaExpr>(ExpressionParser.Parse(text));
        Assert.Equal(family, expression.Family);
        Assert.Equal(argument, expression.Argument);
    }

    private sealed class ConstantContext : IEvaluationContext
    {
        public double Sna(string family, string argument, Runtime.Transaction? transaction) => 0;
        public double NameValue(string name) => 0;
        public double Random(int stream) => 0.5;
    }
}
