import type { PointerEvent } from 'react';
import type { SchemeLink, SchemeNode } from '../../../../shared/types/teb';
import { center, type CanvasExtent, type Point } from './schemeGeometry';

interface SchemeMinimapProps {
  nodes: SchemeNode[];
  links: SchemeLink[];
  surface: CanvasExtent;
  /** Visible part of the scheme in scheme coordinates. */
  viewport: { left: number; top: number; width: number; height: number };
  onNavigate: (point: Point) => void;
}

const WIDTH = 180;

/** Overview of the whole scheme with the visible area; a click or drag moves the view. */
export function SchemeMinimap({ nodes, links, surface, viewport, onNavigate }: SchemeMinimapProps) {
  if (nodes.length === 0 || (viewport.width >= surface.width && viewport.height >= surface.height)) {
    return null;
  }

  const scale = WIDTH / surface.width;
  const height = Math.max(40, surface.height * scale);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  function navigate(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    onNavigate({ x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale });
  }

  return (
    <svg
      className="scheme-minimap"
      width={WIDTH}
      height={height}
      viewBox={`0 0 ${surface.width} ${surface.height}`}
      role="img"
      aria-label="Обзор схемы"
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        navigate(event);
      }}
      onPointerMove={(event) => (event.buttons === 1 ? navigate(event) : undefined)}
    >
      {links
        .filter((link) => !link.hidden && byId.has(link.from) && byId.has(link.to))
        .map((link) => {
          const a = center(byId.get(link.from)!);
          const b = center(byId.get(link.to)!);
          return <line key={link.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="scheme-minimap__link" />;
        })}
      {nodes.map((node) => (
        <rect key={node.id} x={node.x} y={node.y} width={node.width} height={node.height} fill={node.backgroundColor ?? '#80c7ee'} className="scheme-minimap__node" />
      ))}
      <rect className="scheme-minimap__view" x={viewport.left} y={viewport.top} width={viewport.width} height={viewport.height} />
    </svg>
  );
}
