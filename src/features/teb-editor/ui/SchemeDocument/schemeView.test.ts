import type { SchemeNode } from '../../../../shared/types/teb';
import { curvedLinkPath, fitToViewport, MIN_SCHEME_ZOOM, nodesBounds, snapToGrid } from './schemeGeometry';

const node = (id: string, x: number, y: number): SchemeNode => ({ id, label: id, kind: 'teb', x, y, width: 100, height: 50 });

describe('scheme view geometry', () => {
  it('leaves and enters facing sides with a smooth curve', () => {
    expect(curvedLinkPath(node('a', 0, 0), node('b', 0, 200))).toBe('M 50 50 C 50 125 50 125 50 200');
    expect(curvedLinkPath(node('a', 0, 0), node('b', 300, 20)).startsWith('M 100 25 C')).toBe(true);
    expect(curvedLinkPath(node('b', 300, 20), node('a', 0, 0)).startsWith('M 300 45 C')).toBe(true);
  });

  it('fits all nodes into the viewport and centres them', () => {
    const nodes = [node('a', 100, 100), node('b', 1900, 900)];
    expect(nodesBounds(nodes)).toEqual({ x: 100, y: 100, width: 1900, height: 850 });
    const fit = fitToViewport(nodes, { width: 1000, height: 500 });
    expect(fit.zoom).toBe(0.49); // min((1000 − 64)/1900, (500 − 64)/850)
    expect(fit.zoom).toBeGreaterThanOrEqual(MIN_SCHEME_ZOOM);
    expect(fitToViewport([node('a', 0, 0)], { width: 1000, height: 500 }).zoom).toBe(1.3);
  });

  it('snaps positions to the grid', () => {
    expect(snapToGrid(23)).toBe(20);
    expect(snapToGrid(26)).toBe(30);
  });
});
