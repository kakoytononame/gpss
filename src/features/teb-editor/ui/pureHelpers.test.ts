import { filterPropertyRows, parseBoundedNumber, buildPropertyRows } from '../../../widgets/desktop-shell/RightDockPanel/propertyRows';
import { filterTree, isLibraryItem, LIBRARIES_TREE, PROJECT_TREE } from '../../../widgets/desktop-shell/ProjectExplorer/explorerTrees';
import { findWrapped, indentLines, lineRange, outdentLines, replaceAllIgnoreCase } from './ModelLogDocument/journalText';
import { clampNodePosition, containsPoint, createNodeFromLibraryItem, linkPath, pointForPort, SCHEME_WIDTH } from './SchemeDocument/schemeGeometry';

const node = { id: 'n', label: 'Узел', kind: 'teb' as const, x: 100, y: 100, width: 100, height: 50 };

describe('journal text helpers', () => {
  it('finds text case-insensitively and wraps around', () => {
    const text = 'Alpha beta ALPHA';
    expect(findWrapped(text, 'alpha', 1, false)).toBe(11);
    expect(findWrapped(text, 'alpha', 12, false)).toBe(0);
    expect(findWrapped(text, 'alpha', 10, true)).toBe(0);
    expect(findWrapped(text, 'gamma', 0, false)).toBe(-1);
  });

  it('replaces all matches literally', () => {
    expect(replaceAllIgnoreCase('a.b A.B', 'a.b', '$&x')).toEqual({ text: '$&x $&x', count: 2 });
    expect(replaceAllIgnoreCase('abc', 'z', 'y').count).toBe(0);
  });

  it('indents whole selected lines', () => {
    const text = 'one\ntwo\nthree';
    expect(lineRange(text, 5, 6)).toEqual({ lineStart: 4, lineEnd: 7 });
    expect(indentLines('a\nb')).toBe('  a\n  b');
    expect(outdentLines('  a\nb')).toBe('a\nb');
  });
});

describe('scheme geometry', () => {
  it('computes ports, hit tests and clamps nodes to the canvas', () => {
    expect(pointForPort(node, 'right')).toEqual({ x: 200, y: 125 });
    expect(containsPoint(node, { x: 150, y: 120 })).toBe(true);
    expect(containsPoint(node, { x: 99, y: 120 })).toBe(false);
    expect(clampNodePosition(SCHEME_WIDTH, -5, 100, 50)).toEqual({ x: SCHEME_WIDTH - 108, y: 8 });
  });

  it('draws links between node borders', () => {
    const target = { ...node, id: 't', x: 400 };
    expect(linkPath(node, target)).toBe('M 200 125 L 400 125');
  });

  it('creates GPSS block nodes from library drops', () => {
    const created = createNodeFromLibraryItem({ id: 'standard-block-seize', label: 'SEIZE', kind: 'block' }, { x: 300, y: 300 });
    expect(created).toMatchObject({ label: 'SEIZE', kind: 'teb', iconShape: 'seize', nameInModel: 'SEIZE', width: 160 });
    const entity = createNodeFromLibraryItem({ id: 'standard-entity-q', label: 'Очередь', kind: 'entity' }, { x: 0, y: 0 });
    expect(entity).toMatchObject({ kind: 'data', x: 8, y: 8, iconShape: undefined });
  });
});

describe('property grid', () => {
  it('filters rows and hides groups without matches', () => {
    const rows = buildPropertyRows(node, null);
    const filtered = filterPropertyRows(rows, 'шрифт');
    expect(filtered.map((row) => (row.kind === 'group' ? row.title : row.name))).toEqual(['6. Текст', 'Шрифт', 'Размер шрифта']);
  });

  it('shows the node description rather than the TEB description', () => {
    const rows = buildPropertyRows({ ...node, description: '' }, { description: 'TEB' } as never);
    expect(rows.find((row) => row.kind === 'field' && row.name === 'Описание')).toMatchObject({ value: '' });
  });

  it('parses numbers with either decimal separator and clamps them', () => {
    expect(parseBoundedNumber('12,5', 0, 0, 100)).toBe(12.5);
    expect(parseBoundedNumber('1000', 0, 0, 100)).toBe(100);
    expect(parseBoundedNumber('', 7, 0, 100)).toBe(7);
    expect(parseBoundedNumber('abc', 7, 0, 100)).toBe(7);
  });
});

describe('explorer trees', () => {
  it('keeps matching nodes with their ancestors', () => {
    const filtered = filterTree(PROJECT_TREE, 'журнал');
    expect(filtered[0].label).toBe('Столовая');
    expect(JSON.stringify(filtered)).toContain('Журнал моделирования');
    expect(JSON.stringify(filtered)).not.toContain('Структурная схема');
    expect(filterTree(PROJECT_TREE, '   ')).toBe(PROJECT_TREE);
  });

  it('marks standard blocks as draggable library items', () => {
    expect(isLibraryItem('standard-block-generation-generate')).toBe(true);
    expect(isLibraryItem('scheme')).toBe(false);
    expect(JSON.stringify(filterTree(LIBRARIES_TREE, 'GENERATE'))).toContain('GENERATE');
  });
});
