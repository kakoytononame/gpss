import { classNames, clamp, createId, movedIndex, reorderItems } from './utils';

describe('reorderItems', () => {
  it('swaps an item with its neighbour and returns a copy', () => {
    const items = ['a', 'b', 'c'];
    expect(reorderItems(items, 0, 'down')).toEqual(['b', 'a', 'c']);
    expect(reorderItems(items, 2, 'up')).toEqual(['a', 'c', 'b']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('ignores moves past the edges and invalid indexes', () => {
    expect(reorderItems(['a', 'b'], 0, 'up')).toEqual(['a', 'b']);
    expect(reorderItems(['a', 'b'], 1, 'down')).toEqual(['a', 'b']);
    expect(reorderItems(['a', 'b'], 5, 'up')).toEqual(['a', 'b']);
  });
});

describe('movedIndex', () => {
  it('follows the moved row and stays inside the list', () => {
    expect(movedIndex(1, 'up', 3)).toBe(0);
    expect(movedIndex(1, 'down', 3)).toBe(2);
    expect(movedIndex(0, 'up', 3)).toBe(0);
    expect(movedIndex(2, 'down', 3)).toBe(2);
  });
});

describe('createId', () => {
  it('produces RFC 4122 v4 identifiers', () => {
    expect(createId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('works without crypto.randomUUID (plain HTTP by LAN address)', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) });
    expect(createId()).toMatch(/^07070707-0707-4707-8707-070707070707$/);
  });
});

describe('helpers', () => {
  it('clamps and joins class names', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(classNames('a', false, null, 'b', undefined)).toBe('a b');
  });
});
