import { studioForm, studioProjectWithForm } from '../../../test/fixtures';
import { buildProjectTree } from '../../../widgets/desktop-shell/ProjectExplorer/explorerTrees';
import type { SimulationResultSummary } from '../../../shared/types/result';
import { defaultResultName, formatResultDate, formInputValues, groupResults } from './simulationResults';

const SUMMARIES: SimulationResultSummary[] = [
  { Id: 'a', ProjectId: 'project-1', Kind: 'single', Name: 'Эксперимент 1', CreatedAt: '2026-10-13T10:00:00Z' },
  { Id: 'b', ProjectId: 'project-1', Kind: 'series', Name: 'Серия 1', CreatedAt: '2026-10-13T11:00:00Z' },
  { Id: 'c', ProjectId: 'project-1', Kind: 'single', Name: 'Эксперимент 2', CreatedAt: '2026-10-13T12:00:00Z' },
];

describe('simulation result helpers', () => {
  it('names results by kind, form and local date', () => {
    const date = new Date(2026, 9, 3, 9, 5);
    expect(formatResultDate(date)).toBe('03.10.2026 09:05');
    expect(defaultResultName('single', date, 'Порт')).toBe('Эксперимент «Порт» от 03.10.2026 09:05');
    expect(defaultResultName('series', date)).toBe('Серия экспериментов от 03.10.2026 09:05');
    expect(formatResultDate('not a date')).toBe('not a date');
  });

  it('flattens the form input data into operand rows', () => {
    expect(formInputValues(studioForm())).toEqual([
      { Input: 'Berth', Name: 'Операнд A', Operand: 'A', Value: '1' },
      { Input: '(2) INITIAL', Name: 'Интервал', Operand: 'B', Value: '30' },
    ]);
    expect(formInputValues(undefined)).toEqual([]);
  });

  it('splits results into single experiments and series', () => {
    const grouped = groupResults(SUMMARIES);
    expect(grouped.single.map((item) => item.Id)).toEqual(['a', 'c']);
    expect(grouped.series.map((item) => item.Id)).toEqual(['b']);
  });

  it('adds the result tree to the project explorer', () => {
    const [home] = buildProjectTree(studioProjectWithForm(), 0, false, SUMMARIES);
    const results = home.children?.find((node) => node.id === 'results-root');

    expect(results?.documentId).toBe('results');
    expect(results?.children?.map((node) => [node.label, node.children?.map((item) => item.resultId)])).toEqual([
      ['Одиночные эксперименты', ['a', 'c']],
      ['Серии экспериментов', ['b']],
    ]);
  });
});
