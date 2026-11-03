import { getGpssBlockIconShape } from '../../../../shared/lib/gpssBlockShapes';
import type { LibraryDropPayload } from '../../../../shared/lib/libraryDrag';
import { clamp } from '../../../../shared/lib/utils';
import type { SchemeNode } from '../../../../shared/types/teb';

export type SchemePort = 'top' | 'right' | 'bottom' | 'left';

export interface Point {
  x: number;
  y: number;
}

export const SCHEME_WIDTH = 1300;
export const SCHEME_HEIGHT = 640;
export const SCHEME_PORTS: SchemePort[] = ['top', 'right', 'bottom', 'left'];
export const MIN_SCHEME_ZOOM = 0.25;
export const MAX_SCHEME_ZOOM = 2.4;
export const SCHEME_ZOOM_STEP = 0.08;
/** Keeps nodes away from the canvas border. */
export const SCHEME_MARGIN = 8;

export function center(node: SchemeNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function boundaryPoint(node: SchemeNode, directionX: number, directionY: number): Point {
  const nodeCenter = center(node);
  const horizontalScale = directionX === 0 ? Number.POSITIVE_INFINITY : node.width / 2 / Math.abs(directionX);
  const verticalScale = directionY === 0 ? Number.POSITIVE_INFINITY : node.height / 2 / Math.abs(directionY);
  const scale = Math.min(horizontalScale, verticalScale);

  return { x: nodeCenter.x + directionX * scale, y: nodeCenter.y + directionY * scale };
}

/**
 * Straight SVG path between the borders of two nodes, along the line joining their centres.
 */
export function linkPath(from: SchemeNode, to: SchemeNode): string {
  const fromCenter = center(from);
  const toCenter = center(to);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (dx === 0 && dy === 0) {
    return `M ${fromCenter.x} ${from.y + from.height} L ${toCenter.x} ${to.y}`;
  }

  const fromPoint = boundaryPoint(from, dx, dy);
  const toPoint = boundaryPoint(to, -dx, -dy);
  return `M ${fromPoint.x} ${fromPoint.y} L ${toPoint.x} ${toPoint.y}`;
}

/**
 * Smooth link between the facing sides of two nodes: a cubic curve that leaves and enters perpendicular to the
 * borders (vertical when the nodes are mostly above each other, horizontal otherwise).
 */
export function curvedLinkPath(from: SchemeNode, to: SchemeNode): string {
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return linkPath(from, to);
  }

  const vertical = Math.abs(dy) * 1.4 >= Math.abs(dx) && Math.abs(dy) > (from.height + to.height) / 2;
  if (vertical) {
    const down = dy > 0;
    const start = { x: a.x, y: down ? from.y + from.height : from.y };
    const end = { x: b.x, y: down ? to.y : to.y + to.height };
    const bend = Math.max(24, Math.abs(end.y - start.y) / 2) * (down ? 1 : -1);
    return `M ${start.x} ${start.y} C ${start.x} ${start.y + bend} ${end.x} ${end.y - bend} ${end.x} ${end.y}`;
  }

  const right = dx > 0;
  const start = { x: right ? from.x + from.width : from.x, y: a.y };
  const end = { x: right ? to.x : to.x + to.width, y: b.y };
  const bend = Math.max(24, Math.abs(end.x - start.x) / 2) * (right ? 1 : -1);
  return `M ${start.x} ${start.y} C ${start.x + bend} ${start.y} ${end.x - bend} ${end.y} ${end.x} ${end.y}`;
}

export const SCHEME_GRID = 10;

export function snapToGrid(value: number, grid = SCHEME_GRID): number {
  return Math.round(value / grid) * grid;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of the nodes (an empty scheme gives the default canvas). */
export function nodesBounds(nodes: SchemeNode[]): Bounds {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: SCHEME_WIDTH, height: SCHEME_HEIGHT };
  }

  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Zoom and scroll offsets that show all nodes in a viewport, with a margin, never enlarging beyond 130 %. */
export function fitToViewport(nodes: SchemeNode[], viewport: { width: number; height: number }, margin = 32) {
  const bounds = nodesBounds(nodes);
  const zoom = clamp(
    Math.min((viewport.width - 2 * margin) / Math.max(1, bounds.width), (viewport.height - 2 * margin) / Math.max(1, bounds.height)),
    MIN_SCHEME_ZOOM,
    1.3,
  );
  const roundedZoom = Math.floor(zoom * 100) / 100;
  return {
    zoom: roundedZoom,
    scrollLeft: Math.max(0, bounds.x * roundedZoom - (viewport.width - bounds.width * roundedZoom) / 2),
    scrollTop: Math.max(0, bounds.y * roundedZoom - (viewport.height - bounds.height * roundedZoom) / 2),
  };
}

export function pointForPort(node: SchemeNode, port: SchemePort): Point {
  switch (port) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y };
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 };
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 };
  }
}

export function containsPoint(node: SchemeNode, point: Point): boolean {
  return point.x >= node.x && point.x <= node.x + node.width && point.y >= node.y && point.y <= node.y + node.height;
}

export interface CanvasExtent {
  width: number;
  height: number;
}

export const DEFAULT_CANVAS: CanvasExtent = { width: SCHEME_WIDTH, height: SCHEME_HEIGHT };

/** Top-left position that keeps a node of the given size inside the canvas. */
export function clampNodePosition(x: number, y: number, width: number, height: number, canvas: CanvasExtent = DEFAULT_CANVAS): Point {
  return {
    x: clamp(x, SCHEME_MARGIN, canvas.width - width - SCHEME_MARGIN),
    y: clamp(y, SCHEME_MARGIN, canvas.height - height - SCHEME_MARGIN),
  };
}

/**
 * Shrinks the label font so that the longest word and all wrapped lines fit into the node.
 */
export function getNodeTextMetrics(node: SchemeNode) {
  const baseFontSize = node.fontSize ?? (node.kind === 'data' ? 16 : 17);
  const availableWidth = Math.max(20, node.width - 24);
  const availableHeight = Math.max(16, node.height - 18);
  const longestWordLength = Math.max(...node.label.split(/\s+/).map((word) => word.length), 1);
  const maxByWordWidth = availableWidth / (longestWordLength * 0.56);
  const charsPerLineAtBase = Math.max(1, Math.floor(availableWidth / (baseFontSize * 0.56)));
  const lineCountAtBase = Math.max(1, Math.ceil(node.label.length / charsPerLineAtBase));
  const maxByHeight = availableHeight / (lineCountAtBase * 1.16);
  const fontSize = clamp(Math.min(baseFontSize, maxByWordWidth, maxByHeight), 5, baseFontSize);

  return {
    fontSize,
    paddingY: clamp(fontSize * 0.55, 2, 10),
    paddingX: clamp(fontSize * 0.72, 3, 12),
  };
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
}

export function buildLinkId(fromId: string, toId: string): string {
  return `${fromId}-to-${toId}-${Date.now()}`;
}

/**
 * Scheme node for a TEB or GPSS entity dropped from the library tree, centred on `point`.
 */
export function createNodeFromLibraryItem(payload: LibraryDropPayload, point: Point): SchemeNode {
  const isEntity = payload.kind === 'entity';
  const width = isEntity ? 150 : payload.label.length > 18 ? 190 : 160;
  const height = isEntity ? 58 : 76;
  const position = clampNodePosition(point.x - width / 2, point.y - height / 2, width, height);

  return {
    id: `library-${slug(payload.label)}-${Date.now()}`,
    label: payload.label,
    iconShape: isEntity ? undefined : (payload.iconShape ?? getGpssBlockIconShape(payload.label)),
    nameInModel: payload.label.replace(/[^A-Za-zА-Яа-яЁё0-9_]+/g, '_').replace(/^_|_$/g, ''),
    kind: isEntity ? 'data' : 'teb',
    ...position,
    width,
    height,
    className: isEntity ? 'GpssEntityTebClass' : 'SimpleTebClass',
    backgroundColor: isEntity ? '#dddddd' : '#80c7ee',
    borderColor: isEntity ? '#b4b4b4' : '#3f9fcd',
    textColor: '#1d2d3a',
    fontFamily: 'Arial',
    fontSize: 12,
    shape: payload.label,
  };
}
