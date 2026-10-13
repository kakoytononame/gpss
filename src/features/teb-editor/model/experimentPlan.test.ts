import { experimentToCsv, parseLevels, suggestFactors, suggestIndicators, toRequestFactors } from './experimentPlan';

const MODEL = ['Desk STORAGE 2', 'Batch EQU 5', ' INITIAL X$Mean,8', ' GENERATE 10', ' QUEUE Line', ' SEIZE Clerk', ' ENTER Desk', ' TERMINATE 1'].join('\n');

describe('experiment plan', () => {
  it('parses level lists and ranges', () => {
    expect(parseLevels('4; 6 8')).toEqual([4, 6, 8]);
    expect(parseLevels('1,5; 2')).toEqual([1.5, 2]);
    expect(parseLevels('2..5')).toEqual([2, 3, 4, 5]);
    expect(parseLevels('0.1..0.3 step 0.1')).toEqual([0.1, 0.2, 0.3]);
    expect(parseLevels('1..3 шаг 0')).toEqual([]);
  });

  it('suggests factors and indicators from the model text', () => {
    expect(suggestFactors(MODEL)).toEqual([
      { name: 'Desk', kind: 'Storage', levels: '2' },
      { name: 'Batch', kind: 'Equ', levels: '5' },
      { name: 'Mean', kind: 'Savevalue', levels: '8' },
    ]);
    expect(suggestIndicators(MODEL).map((indicator) => indicator.expression)).toEqual(['QT$Line', 'FR$Clerk', 'SR$Desk']);
    expect(
      toRequestFactors([
        { name: ' Mean ', kind: 'Savevalue', levels: '4;8' },
        { name: '', kind: 'Equ', levels: '1' },
      ]),
    ).toEqual([{ Name: 'Mean', Kind: 'Savevalue', Levels: [4, 8] }]);
  });

  it('exports the summary as CSV', () => {
    const csv = experimentToCsv({
      FactorNames: ['Mean'],
      IndicatorNames: ['QT$Line'],
      Points: [{ Index: 0, Factors: [4], Indicators: [{ Mean: 2.5, StandardDeviation: 1, ConfidenceHalfWidth: 0.5, Min: 1, Max: 4, Count: 3 }], Failed: 0 }],
      Runs: [],
      BestPoint: 0,
      ElapsedSeconds: 1,
      Messages: [],
    });

    expect(csv).toBe('Точка;Mean;QT$Line: среднее;QT$Line: ±95%;QT$Line: σ\r\n1;4;2.5;0.5;1');
  });
});
