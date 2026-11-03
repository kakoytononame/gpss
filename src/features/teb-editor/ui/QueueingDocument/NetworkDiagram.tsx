import { useMemo } from 'react';
import type { NodeAnalysis, QueueingModel } from '../../../../shared/types/queueing';
import { LAYOUT, formatNumber, kendallPreview, networkLayout } from '../../model/queueing';

interface NetworkDiagramProps {
  model: QueueingModel;
  analysis: NodeAnalysis[] | undefined;
  selected: string | null;
  onSelect: (nodeId: string) => void;
}

/** Sources, nodes (servers, queue) and routes with their probabilities; feedback routes are drawn as arcs. */
export function NetworkDiagram({ model, analysis, selected, onSelect }: NetworkDiagramProps) {
  const layout = useMemo(() => networkLayout(model), [model]);
  const position = new Map(layout.nodes.map((node) => [node.id, node]));
  const exitX = layout.width - 34;
  const { nodeWidth: w, nodeHeight: h } = LAYOUT;

  return (
    <svg
      className="queueing-diagram"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      role="img"
      aria-label="Схема системы массового обслуживания"
    >
      <defs>
        <marker id="queueing-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#4f6f8f" />
        </marker>
      </defs>

      {layout.sources.map((source, index) => {
        const target = position.get(source.entry);
        const y = LAYOUT.margin + index * (h + LAYOUT.rowGap) + h / 2;
        return (
          <g key={source.classId} className="queueing-diagram__source">
            <rect x={LAYOUT.margin} y={y - 16} width={LAYOUT.sourceWidth} height={32} rx={16} />
            <text x={LAYOUT.margin + LAYOUT.sourceWidth / 2} y={y + 4} textAnchor="middle">
              {source.closed ? '⟳ ' : ''}
              {truncate(source.name, 14)}
            </text>
            {target ? (
              <path d={`M${LAYOUT.margin + LAYOUT.sourceWidth},${y} C${target.x - 30},${y} ${target.x - 40},${target.y + h / 2} ${target.x},${target.y + h / 2}`} markerEnd="url(#queueing-arrow)" />
            ) : null}
          </g>
        );
      })}

      {layout.edges.map((edge, index) => {
        const from = position.get(edge.from)!;
        const startX = from.x + w;
        const startY = from.y + h / 2;
        const label = edge.probability < 0.9999 ? formatNumber(edge.probability, 3) : '';
        if (edge.to === null) {
          return (
            <g key={index} className="queueing-diagram__edge queueing-diagram__edge--exit">
              <path d={`M${startX},${startY} L${exitX},${startY}`} markerEnd="url(#queueing-arrow)" />
              {label ? (
                <text x={exitX - 22} y={startY - 5} textAnchor="middle">
                  {label}
                </text>
              ) : null}
            </g>
          );
        }

        const to = position.get(edge.to)!;
        if (edge.back) {
          // Feedback: an arc below the nodes.
          const bottom = Math.max(from.y, to.y) + h + 18;
          const d = `M${from.x + w / 2},${from.y + h} C${from.x + w / 2},${bottom} ${to.x + w / 2},${bottom} ${to.x + w / 2 + (edge.from === edge.to ? 20 : 0)},${to.y + h}`;
          return (
            <g key={index} className="queueing-diagram__edge queueing-diagram__edge--back">
              <path d={d} markerEnd="url(#queueing-arrow)" />
              {label ? (
                <text x={(from.x + to.x + w) / 2} y={bottom - 2} textAnchor="middle">
                  {label}
                </text>
              ) : null}
            </g>
          );
        }

        const endX = to.x;
        const endY = to.y + h / 2;
        return (
          <g key={index} className="queueing-diagram__edge">
            <path d={`M${startX},${startY} C${startX + 35},${startY} ${endX - 35},${endY} ${endX},${endY}`} markerEnd="url(#queueing-arrow)" />
            {label ? (
              <text x={(startX + endX) / 2} y={(startY + endY) / 2 - 5} textAnchor="middle">
                {label}
              </text>
            ) : null}
          </g>
        );
      })}

      {model.Nodes.map((node) => {
        const place = position.get(node.Id)!;
        const quality = analysis?.find((item) => item.NodeId === node.Id)?.Quality;
        const utilization = analysis?.find((item) => item.NodeId === node.Id)?.Metrics.Utilization;
        const servers = node.Servers === 0 ? 3 : Math.min(node.Servers, 4);
        return (
          <g
            key={node.Id}
            className={`queueing-diagram__node${selected === node.Id ? ' is-selected' : ''}${quality ? ` is-${quality.toLowerCase()}` : ''}`}
            transform={`translate(${place.x},${place.y})`}
            onClick={() => onSelect(node.Id)}
            role="button"
            tabIndex={0}
            aria-label={`Узел ${node.Name}`}
            onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ' ? onSelect(node.Id) : undefined)}
          >
            <rect width={w} height={h} rx={6} />
            {/* queue: a few slots, then the servers as circles */}
            {[0, 1, 2].map((slot) => (
              <rect key={slot} className="queueing-diagram__slot" x={8 + slot * 11} y={h - 22} width={9} height={14} />
            ))}
            {Array.from({ length: servers }, (_, index) => (
              <circle key={index} className="queueing-diagram__server" cx={w - 14 - index * 15} cy={h - 15} r={6} />
            ))}
            {node.Servers === 0 || node.Servers > 4 ? (
              <text className="queueing-diagram__count" x={w - 14 - servers * 15 + 3} y={h - 11} textAnchor="end">
                {node.Servers === 0 ? '∞' : `×${node.Servers}`}
              </text>
            ) : null}
            <text className="queueing-diagram__title" x={8} y={16}>
              {truncate(node.Name || node.Id, 18)}
            </text>
            <text className="queueing-diagram__kendall" x={8} y={30}>
              {kendallPreview(model, node)}
              {typeof utilization === 'number' ? `  ρ=${formatNumber(utilization, 2)}` : ''}
            </text>
          </g>
        );
      })}

      {layout.edges.some((edge) => edge.to === null) ? (
        <g className="queueing-diagram__exit">
          <text x={exitX + 4} y={LAYOUT.margin + 12}>
            выход
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}
