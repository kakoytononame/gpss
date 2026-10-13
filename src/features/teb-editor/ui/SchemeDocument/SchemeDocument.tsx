import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent, type WheelEvent } from 'react';
import { readLibraryPayload } from '../../../../shared/lib/libraryDrag';
import { clamp } from '../../../../shared/lib/utils';
import type { SchemeNode } from '../../../../shared/types/teb';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { pathHeaders, schemeExtent } from '../../model/projectScheme';
import { SIMULATION_STATE_LABELS } from '../../model/simulationLabels';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import {
  buildLinkId,
  clampNodePosition,
  containsPoint,
  createNodeFromLibraryItem,
  DEFAULT_CANVAS,
  linkPath,
  MAX_SCHEME_ZOOM,
  MIN_SCHEME_ZOOM,
  pointForPort,
  SCHEME_ZOOM_STEP,
  type Point,
  type SchemePort,
} from './schemeGeometry';
import { SchemeNodeView } from './SchemeNodeView';
import '../BaseDocument/BaseDocument.css';
import './SchemeDocument.css';

interface NodeDrag {
  id: string;
  offsetX: number;
  offsetY: number;
}

interface ConnectionDrag {
  fromId: string;
  port: SchemePort;
  start: Point;
  current: Point;
}

/** The connection tooltip stays this far from the right edge of the canvas. */
const TOOLTIP_RIGHT_MARGIN = 60;

function isEditableElement(element: Element | null): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element?.getAttribute('contenteditable') === 'true'
  );
}

export function SchemeDocument() {
  const startSimulation = useTebEditorStore((state) => state.startSimulation);
  const stopSimulation = useTebEditorStore((state) => state.stopSimulation);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const simulationState = useTebEditorStore((state) => state.simulationState);
  const nodes = useTebEditorStore((state) => state.schemeNodes);
  const links = useTebEditorStore((state) => state.schemeLinks);
  const selection = useTebEditorStore((state) => state.schemeSelection);
  const setNodes = useTebEditorStore((state) => state.setSchemeNodes);
  const setLinks = useTebEditorStore((state) => state.setSchemeLinks);
  const setSelection = useTebEditorStore((state) => state.setSchemeSelection);
  const resetScheme = useTebEditorStore((state) => state.resetScheme);
  const openRightPanel = useTebEditorStore((state) => state.openRightPanel);
  const openSchemeNode = useTebEditorStore((state) => state.openSchemeNode);
  const project = useTebEditorStore((state) => state.project);
  const projectModel = useTebEditorStore((state) => state.project?.Models[state.projectModelIndex]);
  const schemePath = useTebEditorStore((state) => state.schemePath);
  const projectBusy = useTebEditorStore((state) => state.projectBusy);
  const projectDirty = useTebEditorStore((state) => state.projectDirty);
  const leaveToSchemeLevel = useTebEditorStore((state) => state.leaveToSchemeLevel);
  const generateModelText = useTebEditorStore((state) => state.generateModelText);
  const saveProject = useTebEditorStore((state) => state.saveProject);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null);
  const [zoom, setZoom] = useState(1);

  const visibleNodes = useMemo(() => nodes.filter((node) => !node.hidden), [nodes]);
  // Imported schemes can be larger than the default canvas; the surface grows with its content.
  const surface = useMemo(() => (project ? schemeExtent(nodes, DEFAULT_CANVAS) : DEFAULT_CANVAS), [nodes, project]);
  const levelHeaders = useMemo(() => pathHeaders(projectModel, schemePath), [projectModel, schemePath]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selection?.type === 'node' ? (nodeById.get(selection.id) ?? null) : null;
  const connectionTarget = connectionDrag ? findConnectionTarget(connectionDrag) : null;

  function findConnectionTarget(drag: ConnectionDrag): SchemeNode | null {
    return visibleNodes.find((node) => node.id !== drag.fromId && containsPoint(node, drag.current)) ?? null;
  }

  function readCanvasPoint(clientX: number, clientY: number): Point {
    const element = canvasRef.current;
    if (!element) {
      return { x: 0, y: 0 };
    }

    const rect = element.getBoundingClientRect();
    return {
      x: clamp((element.scrollLeft + clientX - rect.left) / zoom, 0, surface.width),
      y: clamp((element.scrollTop + clientY - rect.top) / zoom, 0, surface.height),
    };
  }

  function selectNode(node: SchemeNode) {
    setSelection({ type: 'node', id: node.id });
    openRightPanel('properties');
  }

  function handleNodePointerDown(node: SchemeNode, event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = readCanvasPoint(event.clientX, event.clientY);
    selectNode(node);
    setNodeDrag({ id: node.id, offsetX: point.x - node.x, offsetY: point.y - node.y });
  }

  function handlePortPointerDown(node: SchemeNode, port: SchemePort, event: PointerEvent<HTMLSpanElement>) {
    event.stopPropagation();
    selectNode(node);
    setNodeDrag(null);
    setConnectionDrag({ fromId: node.id, port, start: pointForPort(node, port), current: readCanvasPoint(event.clientX, event.clientY) });
    setStatusMessage('Выберите входной блок для создания связи.', 'saved');
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (connectionDrag) {
      const current = readCanvasPoint(event.clientX, event.clientY);
      setConnectionDrag((drag) => (drag ? { ...drag, current } : null));
      return;
    }

    if (!nodeDrag) {
      return;
    }

    const point = readCanvasPoint(event.clientX, event.clientY);
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeDrag.id
          ? { ...node, ...clampNodePosition(point.x - nodeDrag.offsetX, point.y - nodeDrag.offsetY, node.width, node.height, surface) }
          : node,
      ),
    );
  }

  function finishConnection(drag: ConnectionDrag) {
    const target = findConnectionTarget(drag);
    setConnectionDrag(null);

    if (!target) {
      setStatusMessage('Создание связи отменено: входной блок не выбран.', 'saved');
      return;
    }

    const existingLink = links.find((link) => !link.hidden && link.from === drag.fromId && link.to === target.id);
    const linkId = existingLink?.id ?? buildLinkId(drag.fromId, target.id);

    if (!existingLink) {
      setLinks((currentLinks) => [...currentLinks, { id: linkId, from: drag.fromId, to: target.id }], 'Связь структурной схемы создана.');
    }

    setSelection({ type: 'link', id: linkId });
    setStatusMessage(existingLink ? 'Такая связь уже существует.' : 'Выход блока связан со входом выбранного блока.', 'saved');
  }

  function handlePointerUp() {
    if (connectionDrag) {
      finishConnection(connectionDrag);
      return;
    }

    setNodeDrag(null);
  }

  function handlePointerLeave() {
    if (connectionDrag) {
      setConnectionDrag(null);
      setStatusMessage('Создание связи отменено.', 'saved');
    }

    setNodeDrag(null);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const canvas = canvasRef.current;
    if (!canvas || (!event.ctrlKey && Math.abs(event.deltaY) < Math.abs(event.deltaX))) {
      return;
    }

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const logicalX = (canvas.scrollLeft + pointerX) / zoom;
    const logicalY = (canvas.scrollTop + pointerY) / zoom;
    const step = event.deltaY > 0 ? -SCHEME_ZOOM_STEP : SCHEME_ZOOM_STEP;
    const nextZoom = clamp(Number((zoom + step).toFixed(2)), MIN_SCHEME_ZOOM, MAX_SCHEME_ZOOM);

    if (nextZoom === zoom) {
      return;
    }

    setZoom(nextZoom);
    // Keep the point under the cursor in place once the surface has been resized.
    window.requestAnimationFrame(() => {
      canvas.scrollLeft = Math.max(0, logicalX * nextZoom - pointerX);
      canvas.scrollTop = Math.max(0, logicalY * nextZoom - pointerY);
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const payload = readLibraryPayload(event.dataTransfer);

    if (!payload) {
      return;
    }

    const node = createNodeFromLibraryItem(payload, readCanvasPoint(event.clientX, event.clientY));
    setNodes((currentNodes) => [...currentNodes, node], `ТЭБ "${payload.label}" добавлен на структурную схему.`);
    selectNode(node);
  }

  function deleteSelection() {
    if (!selection) {
      return;
    }

    if (selection.type === 'node') {
      setNodes((currentNodes) => currentNodes.map((node) => (node.id === selection.id ? { ...node, hidden: true } : node)));
      setLinks((currentLinks) => currentLinks.map((link) => (link.from === selection.id || link.to === selection.id ? { ...link, hidden: true } : link)));
      setStatusMessage('Элемент схемы удалён.', 'saved');
    } else {
      setLinks((currentLinks) => currentLinks.map((link) => (link.id === selection.id ? { ...link, hidden: true } : link)));
      setStatusMessage('Связь схемы удалена.', 'saved');
    }

    setSelection(null);
  }

  const deleteSelectionRef = useRef(deleteSelection);
  useEffect(() => {
    deleteSelectionRef.current = deleteSelection;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete' || isEditableElement(document.activeElement) || !useTebEditorStore.getState().schemeSelection) {
        return;
      }

      event.preventDefault();
      deleteSelectionRef.current();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <section className="placeholder-document">
      <div className="placeholder-document__header">
        {project ? (
          <nav className="scheme-breadcrumb" aria-label="Уровень схемы">
            <button type="button" onClick={() => leaveToSchemeLevel(0)} disabled={schemePath.length === 0}>
              {project.Name} › {projectModel?.Name ?? 'Модель'}
            </button>
            {levelHeaders.map((header, index) => (
              <button type="button" key={schemePath[index]} onClick={() => leaveToSchemeLevel(index + 1)} disabled={index === levelHeaders.length - 1}>
                › {header}
              </button>
            ))}
            {projectDirty ? <span className="scheme-breadcrumb__dirty">изменён</span> : null}
          </nav>
        ) : (
          <h2>Структурная схема</h2>
        )}
        <div className="placeholder-document__actions">
          {project ? (
            <>
              <IconButton
                label="Сгенерировать текст модели"
                title="Собрать текст GPSS модели по структурной схеме"
                disabled={projectBusy}
                onClick={() => void generateModelText()}
              />
              <IconButton
                label="Сохранить проект"
                title="Сохранить проект на сервере"
                disabled={projectBusy || !projectDirty}
                onClick={() => void saveProject()}
              />
              {schemePath.length > 0 ? (
                <IconButton label="Наверх" title="Перейти на уровень выше" onClick={() => leaveToSchemeLevel(schemePath.length - 1)} />
              ) : null}
            </>
          ) : null}
          <IconButton
            label={selectedNode?.isComposite ? 'Открыть схему' : 'Открыть ТЭБ'}
            title={selectedNode?.isComposite ? 'Открыть схему композитного ТЭБа' : 'Перейти к редактору ТЭБа'}
            disabled={!selectedNode}
            onClick={() => selectedNode && openSchemeNode(selectedNode.id)}
          />
          <IconButton label="Старт" title="Запустить моделирование" onClick={() => void startSimulation()} />
          <IconButton label="Стоп" title="Остановить моделирование" onClick={() => void stopSimulation()} />
          <IconButton label="Удалить" title="Удалить выбранный объект" disabled={!selection} onClick={deleteSelection} />
          <IconButton label="Сброс" title="Восстановить схему" onClick={resetScheme} />
        </div>
      </div>

      <div className="scheme-workspace">
        <div
          className="scheme-canvas"
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerDown={() => setSelection(null)}
          onWheel={handleWheel}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="scheme-surface" style={{ width: `${surface.width * zoom}px`, height: `${surface.height * zoom}px` }}>
            <svg
              className="scheme-links"
              viewBox={`0 0 ${surface.width} ${surface.height}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Связи структурной схемы"
            >
              <defs>
                <marker id="scheme-arrow" viewBox="0 0 10 10" refX="9.2" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
                <marker
                  id="scheme-arrow-draft"
                  viewBox="0 0 10 10"
                  refX="9.2"
                  refY="5"
                  markerWidth="11"
                  markerHeight="11"
                  markerUnits="userSpaceOnUse"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
              </defs>
              {links.map((link) => {
                const from = nodeById.get(link.from);
                const to = nodeById.get(link.to);
                if (!from || !to || from.hidden || to.hidden || link.hidden) {
                  return null;
                }

                return (
                  <path
                    className={`scheme-link ${selection?.type === 'link' && selection.id === link.id ? 'is-selected' : ''}`}
                    d={linkPath(from, to)}
                    key={link.id}
                    markerEnd="url(#scheme-arrow)"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelection({ type: 'link', id: link.id });
                    }}
                  />
                );
              })}
              {connectionDrag ? (
                <path
                  className={`scheme-link-draft ${connectionTarget ? 'is-connectable' : ''}`}
                  d={`M ${connectionDrag.start.x} ${connectionDrag.start.y} L ${connectionDrag.current.x} ${connectionDrag.current.y}`}
                  markerEnd="url(#scheme-arrow-draft)"
                />
              ) : null}
            </svg>

            {visibleNodes.map((node) => {
              const isSelected = selection?.type === 'node' && selection.id === node.id;
              return (
                <SchemeNodeView
                  key={node.id}
                  node={node}
                  zoom={zoom}
                  isSelected={isSelected}
                  isConnectionTarget={connectionTarget?.id === node.id}
                  showPorts={isSelected || Boolean(connectionDrag)}
                  onPointerDown={handleNodePointerDown}
                  onPortPointerDown={handlePortPointerDown}
                  onOpen={() => openSchemeNode(node.id)}
                />
              );
            })}

            {connectionDrag && connectionTarget ? (
              <div
                className="scheme-connection-tooltip"
                style={{
                  left: `${Math.min((surface.width - TOOLTIP_RIGHT_MARGIN) * zoom, connectionDrag.current.x * zoom + 18)}px`,
                  top: `${Math.max(8, connectionDrag.current.y * zoom - 8)}px`,
                }}
              >
                <strong>Элементарный ТЭБ: {connectionTarget.label}</strong>
                <span>Класс: {connectionTarget.className || connectionTarget.label}</span>
              </div>
            ) : null}

            <div className="scheme-caption">Состояние моделирования: {SIMULATION_STATE_LABELS[simulationState]}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
