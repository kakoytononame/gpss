import type { PointerEvent } from 'react';
import { classNames } from '../../../../shared/lib/utils';
import type { SchemeNode } from '../../../../shared/types/teb';
import { GpssNodeShape } from './GpssNodeShape';
import { getNodeTextMetrics, SCHEME_PORTS, type SchemePort } from './schemeGeometry';

interface SchemeNodeViewProps {
  node: SchemeNode;
  zoom: number;
  isSelected: boolean;
  isConnectionTarget: boolean;
  showPorts: boolean;
  onPointerDown: (node: SchemeNode, event: PointerEvent<HTMLDivElement>) => void;
  onPortPointerDown: (node: SchemeNode, port: SchemePort, event: PointerEvent<HTMLSpanElement>) => void;
  onOpen: () => void;
}

export function SchemeNodeView({ node, zoom, isSelected, isConnectionTarget, showPorts, onPointerDown, onPortPointerDown, onOpen }: SchemeNodeViewProps) {
  const textMetrics = getNodeTextMetrics(node);
  const hasGpssIcon = Boolean(node.iconShape);

  return (
    <div
      className={classNames(
        'scheme-node',
        `scheme-node--${node.kind}`,
        hasGpssIcon && 'scheme-node--gpss-icon',
        node.isComposite && 'scheme-node--composite',
        isSelected && 'is-selected',
        isConnectionTarget && 'is-connection-target',
      )}
      style={{
        left: `${node.x * zoom}px`,
        top: `${node.y * zoom}px`,
        width: `${node.width * zoom}px`,
        height: `${node.height * zoom}px`,
        padding: `${textMetrics.paddingY * zoom}px ${textMetrics.paddingX * zoom}px`,
        backgroundColor: hasGpssIcon ? 'transparent' : node.backgroundColor,
        borderColor: hasGpssIcon ? 'transparent' : node.borderColor,
        borderWidth: node.borderWidth !== undefined ? `${node.borderWidth}px` : undefined,
        borderRadius: node.cornerRadius !== undefined ? `${node.cornerRadius}px` : undefined,
        color: node.textColor,
        fontFamily: node.fontFamily,
        fontSize: `${textMetrics.fontSize * zoom}px`,
        fontWeight: node.fontBold ? 700 : undefined,
        fontStyle: node.fontItalic ? 'italic' : undefined,
      }}
      role="button"
      tabIndex={0}
      aria-label={node.label}
      title={node.isComposite ? 'Композитный ТЭБ: двойной щелчок открывает его схему' : undefined}
      aria-pressed={isSelected}
      onDoubleClick={onOpen}
      onPointerDown={(event) => onPointerDown(node, event)}
    >
      {node.iconShape ? (
        <GpssNodeShape
          shape={node.iconShape}
          backgroundColor={node.backgroundColor ?? '#80c7ee'}
          borderColor={node.borderColor ?? '#3f9fcd'}
          borderWidth={node.borderWidth ?? 2}
        />
      ) : null}
      <span className="scheme-node__label">{node.label}</span>
      {showPorts ? (
        <span className="scheme-node__ports" aria-hidden="true">
          {SCHEME_PORTS.map((port) => (
            <span className={`scheme-node-port scheme-node-port--${port}`} key={port} onPointerDown={(event) => onPortPointerDown(node, port, event)} />
          ))}
        </span>
      ) : null}
    </div>
  );
}
