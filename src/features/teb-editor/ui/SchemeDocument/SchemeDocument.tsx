import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import deleteIcon from '../../../../shared/assets/icons/gpss-native/delete_16.png';
import folderIcon from '../../../../shared/assets/icons/gpss-native/folderopened_16.png';
import pasteIcon from '../../../../shared/assets/icons/gpss-native/paste16.png';
import { GPSS_GALLERY_BLOCKS, getGpssBlockIconShape } from '../../../../shared/lib/gpssBlockShapes';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import '../BaseDocument/BaseDocument.css';
import './SchemeDocument.css';

type SchemeNodeKind = 'teb' | 'data' | 'time';
type SchemeDialog = 'shape-gallery' | 'color-picker' | null;
type SchemePort = 'top' | 'right' | 'bottom' | 'left';

const SCHEME_WIDTH = 1300;
const SCHEME_HEIGHT = 640;
const MIN_SCHEME_ZOOM = 0.55;
const MAX_SCHEME_ZOOM = 2.4;
const SCHEME_ZOOM_STEP = 0.08;

interface LibraryDropPayload {
  id: string;
  label: string;
  icon?: string;
  iconShape?: string;
  kind?: string;
}

interface SchemeNode {
  id: string;
  label: string;
  kind: SchemeNodeKind;
  iconShape?: string;
  nameInModel?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  description?: string;
  className?: string;
  classId?: string;
  isLibraryClass?: boolean;
  instanceCount?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  cornerRadius?: number;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  imageMode?: string;
  moveMode?: string;
  shape?: string;
  hidden?: boolean;
}

interface SchemeLink {
  id: string;
  from: string;
  to: string;
  hidden?: boolean;
}

interface ConnectionDrag {
  fromId: string;
  port: SchemePort;
  start: { x: number; y: number };
  current: { x: number; y: number };
}

function center(node: SchemeNode) {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function linkPath(from: SchemeNode, to: SchemeNode) {
  const fromCenter = center(from);
  const toCenter = center(to);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  function boundaryPoint(node: SchemeNode, directionX: number, directionY: number) {
    const nodeCenter = center(node);
    const horizontalScale = directionX === 0 ? Number.POSITIVE_INFINITY : node.width / 2 / Math.abs(directionX);
    const verticalScale = directionY === 0 ? Number.POSITIVE_INFINITY : node.height / 2 / Math.abs(directionY);
    const scale = Math.min(horizontalScale, verticalScale);

    return {
      x: nodeCenter.x + directionX * scale,
      y: nodeCenter.y + directionY * scale,
    };
  }

  if (dx === 0 && dy === 0) {
    return `M ${fromCenter.x} ${from.y + from.height} L ${toCenter.x} ${to.y}`;
  }

  const fromPoint = boundaryPoint(from, dx, dy);
  const toPoint = boundaryPoint(to, -dx, -dy);

  return `M ${fromPoint.x} ${fromPoint.y} L ${toPoint.x} ${toPoint.y}`;
}

interface GpssNodeShapeProps {
  shape: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
}

function GpssNodeShape({ shape, backgroundColor, borderColor, borderWidth }: GpssNodeShapeProps) {
  const normalizedShape = shape.toLowerCase();
  const strokeWidth = Math.max(1, borderWidth);
  const common = {
    fill: backgroundColor,
    stroke: borderColor,
    strokeWidth,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  const lineCommon = {
    fill: 'none',
    stroke: borderColor,
    strokeWidth,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  let body: ReactNode = <rect x="5" y="8" width="150" height="60" rx="2" {...common} />;
  let decoration: ReactNode = null;

  if (normalizedShape === 'diamond' || normalizedShape === 'test') {
    body = <path d="M 80 5 L 155 38 L 80 71 L 5 38 Z" {...common} />;
    decoration = normalizedShape === 'test' ? <path d="M 36 38 H 124" {...lineCommon} /> : null;
  } else if (normalizedShape === 'generate') {
    body = <path d="M 42 7 A 31 31 0 1 0 42 69 H 139 V 53 H 155 V 69 H 42" {...common} />;
  } else if (normalizedShape === 'terminate') {
    body = <ellipse cx="80" cy="38" rx="73" ry="32" {...common} />;
  } else if (normalizedShape === 'loop') {
    body = <path d="M 30 7 H 155 V 69 H 30 L 5 38 Z" {...common} />;
  } else if (normalizedShape === 'link' || normalizedShape === 'unlink') {
    body = <rect x="12" y="8" width="136" height="60" rx="20" {...common} />;
    decoration = normalizedShape === 'link'
      ? <rect x="136" y="18" width="19" height="40" rx="9" {...common} />
      : <rect x="5" y="10" width="23" height="56" rx="11" {...common} />;
  } else if (normalizedShape === 'select') {
    body = <path d="M 23 8 H 130 L 155 38 L 130 68 H 23 Z" {...common} />;
    decoration = <circle cx="11" cy="38" r="10" {...common} />;
  } else if (normalizedShape === 'mark') {
    body = <rect x="7" y="8" width="146" height="60" rx="18" {...common} />;
  }

  if (normalizedShape === 'assemble') {
    decoration = <path d="M 6 9 L 80 42 L 154 9" {...lineCommon} />;
  } else if (normalizedShape === 'gather') {
    decoration = <path d="M 6 9 L 154 67 M 154 9 L 6 67" {...lineCommon} />;
  } else if (normalizedShape === 'assign' || normalizedShape === 'priority') {
    decoration = <rect x="58" y="1" width="44" height="16" {...common} />;
  } else if (normalizedShape === 'buffer' || normalizedShape === 'savevalue') {
    decoration = <path d="M 5 59 H 155 M 5 65 H 155" {...lineCommon} />;
  } else if (normalizedShape === 'depart' || normalizedShape === 'queue') {
    decoration = <circle cx="151" cy="16" r="10" {...common} />;
  } else if (normalizedShape === 'enter' || normalizedShape === 'tabulate') {
    decoration = <path d="M 139 68 V 53 H 155 V 68" {...lineCommon} />;
  } else if (normalizedShape === 'leave' || normalizedShape === 'release' || normalizedShape === 'return') {
    decoration = <path d="M 130 8 L 145 23 L 155 8" {...lineCommon} />;
  } else if (normalizedShape === 'logic') {
    decoration = <rect x="145" y="27" width="12" height="22" {...common} />;
  } else if (normalizedShape === 'match') {
    decoration = <path d="M 155 8 L 132 38 L 155 68" {...lineCommon} />;
  } else if (normalizedShape === 'preempt' || normalizedShape === 'seize') {
    decoration = <path d="M 128 68 L 143 48 L 158 68 Z" {...common} />;
  }

  return (
    <svg className="scheme-node__shape" viewBox="0 0 160 76" preserveAspectRatio="none" aria-hidden="true">
      {body}
      {decoration}
    </svg>
  );
}

function pointForPort(node: SchemeNode, port: SchemePort) {
  if (port === 'top') {
    return { x: node.x + node.width / 2, y: node.y };
  }

  if (port === 'right') {
    return { x: node.x + node.width, y: node.y + node.height / 2 };
  }

  if (port === 'bottom') {
    return { x: node.x + node.width / 2, y: node.y + node.height };
  }

  return { x: node.x, y: node.y + node.height / 2 };
}

function containsPoint(node: SchemeNode, point: { x: number; y: number }) {
  return point.x >= node.x && point.x <= node.x + node.width && point.y >= node.y && point.y <= node.y + node.height;
}

function getNodeTextMetrics(node: SchemeNode) {
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

function buildLinkId(fromId: string, toId: string) {
  return `${fromId}-to-${toId}-${Date.now()}`;
}

function buildNodeId(label: string) {
  return `library-${label.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
}

function readLibraryPayload(dataTransfer: DataTransfer): LibraryDropPayload | null {
  const rawPayload = dataTransfer.getData('application/x-gpss-teb');

  if (!rawPayload) {
    return null;
  }

  try {
    return JSON.parse(rawPayload) as LibraryDropPayload;
  } catch {
    return null;
  }
}

function nodeTypeLabel(kind: SchemeNodeKind) {
  if (kind === 'data') {
    return 'ТЭБ с данными';
  }

  if (kind === 'time') {
    return 'Элементарный ТЭБ';
  }

  return 'Элемент схемы';
}

function classIdForNode(node?: SchemeNode | null) {
  if (!node) {
    return '';
  }

  const ids: Record<SchemeNodeKind, string> = {
    data: '9fc53553-54ce-43b0-8894-a5086ebcd2aa',
    time: '5dc45591-49c8-46d3-8c70-f49c5a707d91',
    teb: 'e0ec7fc3-44d2-404d-9736-53bcca5c804e',
  };

  return ids[node.kind];
}

export function SchemeDocument() {
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
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
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null);
  const [schemeZoom, setSchemeZoom] = useState(1);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dialog, setDialog] = useState<SchemeDialog>(null);
  const [colorTarget, setColorTarget] = useState<'backgroundColor' | 'borderColor' | 'textColor'>('backgroundColor');
  const [colorDraft, setColorDraft] = useState('#80c7ee');

  const visibleNodes = nodes.filter((node) => !node.hidden);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selection?.type === 'node' ? nodeById.get(selection.id) ?? null : null;
  const selectedLink = selection?.type === 'link' ? links.find((link) => link.id === selection.id) ?? null : null;
  const connectionTarget = connectionDrag
    ? visibleNodes.find((node) => node.id !== connectionDrag.fromId && containsPoint(node, connectionDrag.current)) ?? null
    : null;

  function readCanvasPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: clamp((canvas.scrollLeft + clientX - rect.left) / schemeZoom, 0, SCHEME_WIDTH),
      y: clamp((canvas.scrollTop + clientY - rect.top) / schemeZoom, 0, SCHEME_HEIGHT),
    };
  }

  function handlePointerDown(node: SchemeNode, clientX: number, clientY: number) {
    const point = readCanvasPoint(clientX, clientY);
    setSelection({ type: 'node', id: node.id });
    openRightPanel('properties');
    setDragging({ id: node.id, offsetX: point.x - node.x, offsetY: point.y - node.y });
  }

  function handleConnectionStart(node: SchemeNode, port: SchemePort, clientX: number, clientY: number) {
    const start = pointForPort(node, port);
    const current = readCanvasPoint(clientX, clientY);
    setSelection({ type: 'node', id: node.id });
    openRightPanel('properties');
    setDragging(null);
    setConnectionDrag({ fromId: node.id, port, start, current });
    setStatusMessage('Выберите входной блок для создания связи.', 'saved');
  }

  function handlePointerMove(clientX: number, clientY: number) {
    if (connectionDrag) {
      const current = readCanvasPoint(clientX, clientY);
      setConnectionDrag((drag) => (drag ? { ...drag, current } : null));
      return;
    }

    if (!dragging) {
      return;
    }

    const point = readCanvasPoint(clientX, clientY);
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === dragging.id
          ? {
              ...node,
              x: clamp(point.x - dragging.offsetX, 8, SCHEME_WIDTH - node.width - 8),
              y: clamp(point.y - dragging.offsetY, 8, SCHEME_HEIGHT - node.height - 8),
            }
          : node,
      ),
    );
  }

  function finishConnection() {
    if (!connectionDrag) {
      return;
    }

    const target = visibleNodes.find((node) => node.id !== connectionDrag.fromId && containsPoint(node, connectionDrag.current));

    if (!target) {
      setConnectionDrag(null);
      setStatusMessage('Создание связи отменено: входной блок не выбран.', 'saved');
      return;
    }

    const existingLink = links.find((link) => !link.hidden && link.from === connectionDrag.fromId && link.to === target.id);
    const linkId = existingLink?.id ?? buildLinkId(connectionDrag.fromId, target.id);

    if (!existingLink) {
      setLinks((currentLinks) => [...currentLinks, { id: linkId, from: connectionDrag.fromId, to: target.id }], 'Связь структурной схемы создана.');
    }

    setSelection({ type: 'link', id: linkId });
    setConnectionDrag(null);
    setStatusMessage(existingLink ? 'Такая связь уже существует.' : 'Выход блока связан со входом выбранного блока.', 'saved');
  }

  function handleCanvasPointerUp() {
    if (connectionDrag) {
      finishConnection();
      return;
    }

    setDragging(null);
  }

  function handleCanvasPointerLeave() {
    if (connectionDrag) {
      setConnectionDrag(null);
      setStatusMessage('Создание связи отменено.', 'saved');
    }

    setDragging(null);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const logicalX = (canvas.scrollLeft + pointerX) / schemeZoom;
    const logicalY = (canvas.scrollTop + pointerY) / schemeZoom;
    const direction = event.deltaY > 0 ? -SCHEME_ZOOM_STEP : SCHEME_ZOOM_STEP;
    const nextZoom = clamp(Number((schemeZoom + direction).toFixed(2)), MIN_SCHEME_ZOOM, MAX_SCHEME_ZOOM);

    if (nextZoom === schemeZoom) {
      return;
    }

    setSchemeZoom(nextZoom);
    window.requestAnimationFrame(() => {
      canvas.scrollLeft = Math.max(0, logicalX * nextZoom - pointerX);
      canvas.scrollTop = Math.max(0, logicalY * nextZoom - pointerY);
    });
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const payload = readLibraryPayload(event.dataTransfer);

    if (!payload) {
      return;
    }

    const point = readCanvasPoint(event.clientX, event.clientY);
    const width = payload.kind === 'entity' ? 150 : payload.label.length > 18 ? 190 : 160;
    const height = payload.kind === 'entity' ? 58 : 76;
    const node: SchemeNode = {
      id: buildNodeId(payload.label),
      label: payload.label,
      iconShape: payload.kind === 'entity' ? undefined : payload.iconShape ?? getGpssBlockIconShape(payload.label),
      nameInModel: payload.label.replace(/[^A-Za-zА-Яа-яЁё0-9_]+/g, '_').replace(/^_|_$/g, ''),
      kind: payload.kind === 'entity' ? 'data' : 'teb',
      x: clamp(point.x - width / 2, 8, SCHEME_WIDTH - width - 8),
      y: clamp(point.y - height / 2, 8, SCHEME_HEIGHT - height - 8),
      width,
      height,
      className: payload.kind === 'entity' ? 'GpssEntityTebClass' : 'SimpleTebClass',
      backgroundColor: payload.kind === 'entity' ? '#dddddd' : '#80c7ee',
      borderColor: payload.kind === 'entity' ? '#b4b4b4' : '#3f9fcd',
      textColor: '#1d2d3a',
      fontFamily: 'Arial',
      fontSize: 12,
      shape: payload.label,
    };

    setNodes((currentNodes) => [...currentNodes, node], `ТЭБ "${payload.label}" добавлен на структурную схему.`);
    setSelection({ type: 'node', id: node.id });
    openRightPanel('properties');
  }

  function handleDeleteSelection() {
    if (!selection) {
      return;
    }

    if (selection.type === 'node') {
      setNodes((currentNodes) => currentNodes.map((node) => (node.id === selection.id ? { ...node, hidden: true } : node)));
      setLinks((currentLinks) => currentLinks.map((link) => (link.from === selection.id || link.to === selection.id ? { ...link, hidden: true } : link)));
      setSelection(null);
      setStatusMessage('Элемент схемы удалён.', 'saved');
      return;
    }

    setLinks((currentLinks) => currentLinks.map((link) => (link.id === selection.id ? { ...link, hidden: true } : link)));
    setSelection(null);
    setStatusMessage('Связь схемы удалена.', 'saved');
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const activeElement = document.activeElement;
      const isTextInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute('contenteditable') === 'true';

      if (isTextInput || event.key !== 'Delete') {
        return;
      }

      if (!selection) {
        return;
      }

      event.preventDefault();
      handleDeleteSelection();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, nodes, links]);

  function handleResetScheme() {
    resetScheme();
  }

  function updateSelectedNodeField<K extends keyof SchemeNode>(field: K, value: SchemeNode[K]) {
    if (!selectedNode) {
      return;
    }

    setNodes((currentNodes) => currentNodes.map((node) => (node.id === selectedNode.id ? { ...node, [field]: value } : node)));
  }

  function openColorPicker(target: 'backgroundColor' | 'borderColor' | 'textColor', fallback: string) {
    setColorTarget(target);
    setColorDraft((selectedNode?.[target] as string | undefined) ?? fallback);
    setDialog('color-picker');
  }

  function applyColor() {
    updateSelectedNodeField(colorTarget, colorDraft);
    setDialog(null);
  }

  function applyShape(shape: string) {
    if (!selectedNode) {
      return;
    }

    const iconShape = getGpssBlockIconShape(shape);
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              shape,
              iconShape,
            }
          : node,
      ),
    );
    setDialog(null);
  }

  const incomingCount = selectedNode ? links.filter((link) => !link.hidden && link.to === selectedNode.id).length : 0;
  const outgoingCount = selectedNode ? links.filter((link) => !link.hidden && link.from === selectedNode.id).length : 0;
  const selectedNodeLabel = selectedNode?.label ?? '';
  const selectedClassId = classIdForNode(selectedNode);
  const propertySections = selectedNode
    ? [
        {
          title: '1. Основные',
          rows: [
            { name: 'Имя в модели', value: selectedNode.id.replaceAll('-', '') },
            { name: 'Описание', value: '' },
            { name: 'Имя класса', value: '' },
            { name: 'Заголовок класса', value: selectedNodeLabel, muted: true },
            { name: 'ID класса тэба', value: selectedClassId },
            { name: 'Класс из библиотеки', value: '□' },
            { name: 'Тип объекта', value: nodeTypeLabel(selectedNode.kind) },
          ],
        },
        {
          title: '3. Дублирование',
          rows: [
            { name: 'Количество экземпля...', value: '1' },
            { name: 'Режим перемещения...', value: selectedNode.moveMode ?? 'Прямой переход или копирование', control: 'moveMode' },
          ],
        },
        {
          title: '4. Форма',
          rows: [
            { name: 'Форма тэба', value: selectedNode.shape ?? 'Прямоугольник', action: 'shape' },
            { name: 'Закругление углов', value: '0' },
          ],
        },
        {
          title: '5. Стиль',
          rows: [
            { name: 'Цвет фона', value: '', swatch: selectedNode.backgroundColor ?? '#80c7ee', colorTarget: 'backgroundColor' },
            { name: 'Цвет границы', value: '', swatch: selectedNode.borderColor ?? '#3f9fcd', colorTarget: 'borderColor' },
            { name: 'Толщина границы', value: '0' },
          ],
        },
        {
          title: '6. Текст',
          rows: [
            { name: 'Текст', value: selectedNodeLabel },
            { name: 'Шрифт', value: selectedNode.fontFamily ?? 'Arial', control: 'fontFamily' },
            { name: 'Размер шрифта', value: '12' },
            { name: 'Полужирный', value: '□' },
            { name: 'Курсив', value: '□' },
            { name: 'Цвет текста', value: '', swatch: selectedNode.textColor ?? '#000000', colorTarget: 'textColor' },
          ],
        },
        {
          title: '7. Изображение',
          rows: [
            { name: 'Изображение', value: '📁        📋        ✕', action: 'image' },
            { name: 'Режим отображения', value: selectedNode.imageMode ?? 'Масштабировать', control: 'imageMode' },
          ],
        },
        {
          title: '8. Положение и размер',
          rows: [
            { name: 'X', value: String(Math.round(selectedNode.x)) },
            { name: 'Y', value: String(selectedNode.y) },
            { name: 'Ширина', value: String(Math.round(selectedNode.width)) },
            { name: 'Высота', value: String(Math.round(selectedNode.height)) },
            { name: 'Входящие связи', value: String(incomingCount) },
            { name: 'Исходящие связи', value: String(outgoingCount) },
          ],
        },
      ]
    : selectedLink
      ? [
          {
            title: '1. Основные',
            rows: [
              { name: 'Имя связи', value: selectedLink.id },
              { name: 'Откуда', value: nodeById.get(selectedLink.from)?.label ?? '' },
              { name: 'Куда', value: nodeById.get(selectedLink.to)?.label ?? '' },
            ],
          },
          {
            title: '5. Стиль',
            rows: [
              { name: 'Цвет линии', value: '', swatch: '#3f9fcd' },
              { name: 'Толщина линии', value: '5' },
              { name: 'Наконечник', value: 'Стрелка' },
            ],
          },
        ]
      : [];

  return (
    <section className="placeholder-document">
      <div className="placeholder-document__header">
        <h2>Структурная схема</h2>
        <div className="placeholder-document__actions">
          <IconButton label="Открыть ТЭБ" title="Перейти к редактору ТЭБа" disabled={!selectedNode} onClick={() => activateDocument('editor')} />
          <IconButton label="Старт" title="Запустить моделирование" onClick={startSimulation} />
          <IconButton label="Стоп" title="Остановить моделирование" onClick={stopSimulation} />
          <IconButton label="Удалить" title="Удалить выбранный объект" disabled={!selection} onClick={handleDeleteSelection} />
          <IconButton label="Сброс" title="Восстановить схему" onClick={handleResetScheme} />
        </div>
      </div>

      <div className="scheme-workspace">
        <div
          className="scheme-canvas"
          ref={canvasRef}
          onPointerMove={(event) => handlePointerMove(event.clientX, event.clientY)}
          onPointerUp={handleCanvasPointerUp}
          onPointerLeave={handleCanvasPointerLeave}
          onPointerDown={() => setSelection(null)}
          onWheel={handleWheel}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="scheme-surface" style={{ width: `${SCHEME_WIDTH * schemeZoom}px`, height: `${SCHEME_HEIGHT * schemeZoom}px` }}>
          <svg className="scheme-links" viewBox={`0 0 ${SCHEME_WIDTH} ${SCHEME_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Связи структурной схемы">
            <defs>
              <marker id="scheme-arrow" viewBox="0 0 10 10" refX="9.2" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
              <marker id="scheme-arrow-draft" viewBox="0 0 10 10" refX="9.2" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
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
            const textMetrics = getNodeTextMetrics(node);

            return (
              <div
                className={`scheme-node scheme-node--${node.kind} ${node.iconShape ? 'scheme-node--gpss-icon' : ''} ${selection?.type === 'node' && selection.id === node.id ? 'is-selected' : ''} ${connectionTarget?.id === node.id ? 'is-connection-target' : ''}`}
                key={node.id}
                  style={{
                    left: `${node.x * schemeZoom}px`,
                    top: `${node.y * schemeZoom}px`,
                    width: `${node.width * schemeZoom}px`,
                    height: `${node.height * schemeZoom}px`,
                    padding: `${textMetrics.paddingY * schemeZoom}px ${textMetrics.paddingX * schemeZoom}px`,
                    backgroundColor: node.iconShape ? 'transparent' : node.backgroundColor,
                    borderColor: node.iconShape ? 'transparent' : node.borderColor,
                    borderWidth: node.borderWidth !== undefined ? `${node.borderWidth}px` : undefined,
                    borderRadius: node.cornerRadius !== undefined ? `${node.cornerRadius}px` : undefined,
                    color: node.textColor,
                    fontFamily: node.fontFamily,
                    fontSize: `${textMetrics.fontSize * schemeZoom}px`,
                    fontWeight: node.fontBold ? 700 : undefined,
                    fontStyle: node.fontItalic ? 'italic' : undefined,
                  }}
                role="button"
                tabIndex={0}
                onDoubleClick={() => activateDocument('editor')}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  handlePointerDown(node, event.clientX, event.clientY);
                }}
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
                {(selection?.type === 'node' && selection.id === node.id) || connectionDrag ? (
                  <span className="scheme-node__ports" aria-hidden="true">
                    {(['top', 'right', 'bottom', 'left'] as SchemePort[]).map((port) => (
                      <span
                        className={`scheme-node-port scheme-node-port--${port}`}
                        key={port}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          handleConnectionStart(node, port, event.clientX, event.clientY);
                        }}
                      />
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}

          {connectionDrag && connectionTarget ? (
            <div
              className="scheme-connection-tooltip"
              style={{
                left: `${Math.min(1240 * schemeZoom, connectionDrag.current.x * schemeZoom + 18)}px`,
                top: `${Math.max(8, connectionDrag.current.y * schemeZoom - 8)}px`,
              }}
            >
              <strong>Элементарный ТЭБ: {connectionTarget.label}</strong>
              <span>Класс: {connectionTarget.className || connectionTarget.label}</span>
            </div>
          ) : null}

          <div className="scheme-caption">Состояние моделирования: {simulationState}</div>
          </div>
        </div>

      </div>

      {dialog === 'shape-gallery' ? (
        <div className="scheme-modal-backdrop">
          <div className="scheme-shape-dialog" role="dialog" aria-modal="true" aria-label="Галерея форм тэба">
            <div className="scheme-modal-title"><span>▣</span> Галерея форм тэба <button type="button" onClick={() => setDialog(null)}>×</button></div>
            <div className="scheme-shape-gallery">
              <div className="scheme-shape-group"><span />Базовые<span /></div>
              {[
                ['circle', 'Круг'],
                ['rectangle', 'Прямоугольник'],
                ['triangle-1', 'Треугольник 1'],
                ['triangle-2', 'Треугольник 2'],
                ['data', 'ТЭБ с данными'],
                ['hexagon', 'Шестиугольник'],
                ['ellipse', 'Эллипс'],
              ].map(([shape, label]) => (
                <button className={`scheme-shape-card ${selectedNode?.shape === shape ? 'is-selected' : ''}`} key={shape} type="button" onClick={() => applyShape(shape)}>
                  <span className={`scheme-shape-preview scheme-shape-preview--${shape}`} />
                  <span>{label}</span>
                </button>
              ))}
              <div className="scheme-shape-group"><span />Блок-схема<span /></div>
              {[
                ['io', 'Данные (ввод-вывод)'],
                ['document', 'Документ'],
                ['ram', 'ОЗУ'],
                ['preparation', 'Подготовка'],
                ['process', 'Процесс'],
                ['decision', 'Решение (условие)'],
                ['manual', 'Ручная операция'],
                ['terminator', 'Терминатор'],
              ].map(([shape, label]) => (
                <button className="scheme-shape-card" key={shape} type="button" onClick={() => applyShape(shape)}>
                  <span className={`scheme-shape-preview scheme-shape-preview--${shape}`} />
                  <span>{label}</span>
                </button>
              ))}
              <div className="scheme-shape-group"><span />GPSS<span /></div>
              {GPSS_GALLERY_BLOCKS.map((shape) => {
                const iconShape = getGpssBlockIconShape(shape);

                return (
                  <button className={`scheme-shape-card ${selectedNode?.shape === shape ? 'is-selected' : ''}`} key={shape} type="button" onClick={() => applyShape(shape)}>
                    <span className="scheme-shape-preview scheme-shape-preview--gpss-symbol">
                      <span className={`scheme-node__type-icon tree-row__teb-icon--${iconShape}`} aria-hidden="true" />
                    </span>
                    <span>{shape}</span>
                  </button>
                );
              })}
            </div>
            <div className="scheme-modal-actions"><button type="button" onClick={() => setDialog(null)}>OK</button><button type="button" onClick={() => setDialog(null)}>Отмена</button></div>
          </div>
        </div>
      ) : null}

      {dialog === 'color-picker' ? (
        <div className="scheme-modal-backdrop">
          <div className="scheme-color-dialog" role="dialog" aria-modal="true" aria-label="Выбор цвета">
            <div className="scheme-modal-title"><span>▣</span> Выбор цвета <button type="button" onClick={() => setDialog(null)}>×</button></div>
            <div className="scheme-color-tabs"><span /><span /><span /><span /></div>
            <div className="scheme-color-picker-body">
              <div className="scheme-color-square" />
              <input className="scheme-hue" max="360" min="0" type="range" value="200" onChange={() => undefined} />
              <div className="scheme-alpha" />
            </div>
            <div className="scheme-color-value-row"><span style={{ backgroundColor: colorDraft }} /><input value={colorDraft} onChange={(event) => setColorDraft(event.target.value)} /></div>
            <input className="scheme-color-native" type="color" value={colorDraft} onChange={(event) => setColorDraft(event.target.value)} />
            <div className="scheme-modal-actions"><button type="button" onClick={applyColor}>OK</button><button type="button" onClick={() => setDialog(null)}>Отмена</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
