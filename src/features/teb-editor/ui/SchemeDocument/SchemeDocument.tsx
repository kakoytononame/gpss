import { useMemo, useRef, useState } from 'react';
import arrowDownIcon from '../../../../shared/assets/icons/gpss-native/arrowdown_16.png';
import closeIcon from '../../../../shared/assets/icons/gpss-native/closeblack_13.png';
import copyIcon from '../../../../shared/assets/icons/gpss-native/copy16.png';
import deleteIcon from '../../../../shared/assets/icons/gpss-native/delete_16.png';
import folderIcon from '../../../../shared/assets/icons/gpss-native/folderopened_16.png';
import listIcon from '../../../../shared/assets/icons/gpss-native/list16.png';
import pasteIcon from '../../../../shared/assets/icons/gpss-native/paste16.png';
import pinIcon from '../../../../shared/assets/icons/gpss-native/ribbonpin.png';
import resetIcon from '../../../../shared/assets/icons/gpss-native/zoomreset16.png';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import '../BaseDocument/BaseDocument.css';
import './SchemeDocument.css';

type SchemeNodeKind = 'teb' | 'data' | 'time';
type Selection = { type: 'node'; id: string } | { type: 'link'; id: string } | null;
type RightPanelTab = 'properties' | 'tests';
type SchemeDialog = 'shape-gallery' | 'color-picker' | null;

interface SchemeNode {
  id: string;
  label: string;
  kind: SchemeNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  fontFamily?: string;
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

const initialNodes: SchemeNode[] = [
  { id: 'source-data', label: 'Исходные данные моделирования', kind: 'data', x: 56, y: 48, width: 250, height: 110 },
  { id: 'time-control', label: 'Управление временем моделирования', kind: 'time', x: 36, y: 210, width: 300, height: 96 },
  { id: 'arrival', label: 'Прибытие посетителей', kind: 'teb', x: 677, y: 58, width: 166, height: 68 },
  { id: 'kitchen-choice', label: 'Выбор кухни', kind: 'teb', x: 685, y: 206, width: 150, height: 52 },
  { id: 'cashier-1', label: 'Обслуживание посетителя Касса 1', kind: 'teb', x: 377, y: 348, width: 166, height: 68 },
  { id: 'cashier-2', label: 'Обслуживание посетителя Касса 2', kind: 'teb', x: 517, y: 378, width: 166, height: 68 },
  { id: 'cashier-3', label: 'Обслуживание посетителя Касса 3', kind: 'teb', x: 677, y: 378, width: 166, height: 68 },
  { id: 'cashier-4', label: 'Обслуживание посетителя Касса 4', kind: 'teb', x: 837, y: 378, width: 166, height: 68 },
  { id: 'cashier-5', label: 'Обслуживание посетителя Касса 5', kind: 'teb', x: 977, y: 348, width: 166, height: 68 },
  { id: 'free-seat', label: 'Выбор свободного места', kind: 'teb', x: 677, y: 556, width: 166, height: 68 },
];

const initialLinks: SchemeLink[] = [
  { id: 'arrival-to-choice', from: 'arrival', to: 'kitchen-choice' },
  { id: 'choice-to-cashier-1', from: 'kitchen-choice', to: 'cashier-1' },
  { id: 'choice-to-cashier-2', from: 'kitchen-choice', to: 'cashier-2' },
  { id: 'choice-to-cashier-3', from: 'kitchen-choice', to: 'cashier-3' },
  { id: 'choice-to-cashier-4', from: 'kitchen-choice', to: 'cashier-4' },
  { id: 'choice-to-cashier-5', from: 'kitchen-choice', to: 'cashier-5' },
  { id: 'cashier-1-to-free-choice', from: 'cashier-1', to: 'free-seat' },
  { id: 'cashier-2-to-free-choice', from: 'cashier-2', to: 'free-seat' },
  { id: 'cashier-3-to-free-choice', from: 'cashier-3', to: 'free-seat' },
  { id: 'cashier-4-to-free-choice', from: 'cashier-4', to: 'free-seat' },
  { id: 'cashier-5-to-free-choice', from: 'cashier-5', to: 'free-seat' },
];

function center(node: SchemeNode) {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function linkPath(from: SchemeNode, to: SchemeNode) {
  const fromCenter = center(from);
  const toCenter = center(to);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const fromPoint = Math.abs(dx) > Math.abs(dy)
    ? { x: fromCenter.x + Math.sign(dx) * from.width / 2, y: fromCenter.y }
    : { x: fromCenter.x, y: fromCenter.y + Math.sign(dy) * from.height / 2 };
  const toPoint = Math.abs(dx) > Math.abs(dy)
    ? { x: toCenter.x - Math.sign(dx) * to.width / 2, y: toCenter.y }
    : { x: toCenter.x, y: toCenter.y - Math.sign(dy) * to.height / 2 };

  return `M ${fromPoint.x} ${fromPoint.y} L ${toPoint.x} ${toPoint.y}`;
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
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes] = useState<SchemeNode[]>(initialNodes);
  const [links, setLinks] = useState<SchemeLink[]>(initialLinks);
  const [selection, setSelection] = useState<Selection>({ type: 'node', id: 'kitchen-choice' });
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('properties');
  const [propertiesSearch, setPropertiesSearch] = useState('');
  const [testsSearch, setTestsSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dialog, setDialog] = useState<SchemeDialog>(null);
  const [colorTarget, setColorTarget] = useState<'backgroundColor' | 'borderColor' | 'textColor'>('backgroundColor');
  const [colorDraft, setColorDraft] = useState('#80c7ee');

  const visibleNodes = nodes.filter((node) => !node.hidden);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selection?.type === 'node' ? nodeById.get(selection.id) ?? null : null;
  const selectedLink = selection?.type === 'link' ? links.find((link) => link.id === selection.id) ?? null : null;

  function readCanvasPoint(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: ((clientX - rect.left) / rect.width) * 1300,
      y: ((clientY - rect.top) / rect.height) * 640,
    };
  }

  function handlePointerDown(node: SchemeNode, clientX: number, clientY: number) {
    const point = readCanvasPoint(clientX, clientY);
    setSelection({ type: 'node', id: node.id });
    setDragging({ id: node.id, offsetX: point.x - node.x, offsetY: point.y - node.y });
  }

  function handlePointerMove(clientX: number, clientY: number) {
    if (!dragging) {
      return;
    }

    const point = readCanvasPoint(clientX, clientY);
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === dragging.id
          ? {
              ...node,
              x: Math.max(8, Math.min(1300 - node.width - 8, point.x - dragging.offsetX)),
              y: Math.max(8, Math.min(640 - node.height - 8, point.y - dragging.offsetY)),
            }
          : node,
      ),
    );
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

  function handleResetScheme() {
    setNodes(initialNodes);
    setLinks(initialLinks);
    setSelection({ type: 'node', id: 'kitchen-choice' });
    setStatusMessage('Структурная схема восстановлена.', 'saved');
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
    updateSelectedNodeField('shape', shape);
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

  const normalizedPropertiesSearch = propertiesSearch.trim().toLowerCase();
  const visiblePropertySections = normalizedPropertiesSearch
    ? propertySections
        .map((section) => ({
          ...section,
          rows: section.rows.filter((row) => `${row.name} ${row.value}`.toLowerCase().includes(normalizedPropertiesSearch)),
        }))
        .filter((section) => section.rows.length)
    : propertySections;

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
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
          onPointerDown={() => setSelection(null)}
        >
          <svg className="scheme-links" viewBox="0 0 1300 640" preserveAspectRatio="none" role="img" aria-label="Связи структурной схемы">
            <defs>
              <marker id="scheme-arrow" viewBox="0 0 10 10" refX="8.8" refY="5" markerWidth="9" markerHeight="9" orient="auto">
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
          </svg>

          {visibleNodes.map((node) => (
            <button
              className={`scheme-node scheme-node--${node.kind} ${selection?.type === 'node' && selection.id === node.id ? 'is-selected' : ''}`}
              key={node.id}
                  style={{
                    left: `${(node.x / 1300) * 100}%`,
                    top: `${(node.y / 640) * 100}%`,
                    width: `${(node.width / 1300) * 100}%`,
                    minHeight: `${node.height}px`,
                    backgroundColor: node.backgroundColor,
                    borderColor: node.borderColor,
                    color: node.textColor,
                    fontFamily: node.fontFamily,
                  }}
              type="button"
              onDoubleClick={() => activateDocument('editor')}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                handlePointerDown(node, event.clientX, event.clientY);
              }}
            >
              {node.label}
            </button>
          ))}

          <div className="scheme-caption">Состояние моделирования: {simulationState}</div>
        </div>

        <aside className="scheme-dock" aria-label="Свойства и тесты ТЭБов">
          <div className={`scheme-dock__caption ${rightPanelTab === 'tests' ? 'scheme-dock__caption--active' : ''}`}>
            <span>{rightPanelTab === 'properties' ? 'Свойства' : 'Тесты ТЭБов'}</span>
            <span className="scheme-dock__grip">................................................</span>
            <button type="button" title="Меню панели" aria-label="Меню панели"><img src={arrowDownIcon} alt="" /></button>
            <button type="button" title="Закрепить" aria-label="Закрепить"><img src={pinIcon} alt="" /></button>
            <button type="button" title="Закрыть" aria-label="Закрыть"><img src={closeIcon} alt="" /></button>
          </div>

          {rightPanelTab === 'properties' ? (
            <div className="scheme-properties">
              <div className="scheme-dock-toolbar">
                <button className="scheme-dock-tool is-active" type="button" title="По категориям" aria-label="По категориям"><img src={listIcon} alt="" /></button>
                <button className="scheme-dock-tool" type="button" title="По алфавиту" aria-label="По алфавиту">A↓</button>
                <button className="scheme-dock-tool" type="button" title="Сбросить значение" aria-label="Сбросить значение"><img src={resetIcon} alt="" /></button>
                <input value={propertiesSearch} placeholder="Поиск свойств" onChange={(event) => setPropertiesSearch(event.target.value)} />
              </div>
              <div className="scheme-property-grid">
                {visiblePropertySections.length ? (
                  visiblePropertySections.map((section) => (
                    <div className="scheme-property-section" key={section.title}>
                      <div className="scheme-property-section__title">▸ {section.title}</div>
                      {section.rows.map((row) => (
                        <div className="scheme-property-row" key={`${section.title}-${row.name}`}>
                          <div className="scheme-property-row__name">{row.name}</div>
                          <div className={`scheme-property-row__value ${row.muted ? 'is-muted' : ''} ${row.action ? 'is-action' : ''}`}>
                            {row.name === 'Заголовок класса' && selectedNode ? (
                              <input
                                value={selectedNode.label}
                                onChange={(event) =>
                                  setNodes((currentNodes) => currentNodes.map((node) => (node.id === selectedNode.id ? { ...node, label: event.target.value } : node)))
                                }
                              />
                            ) : row.swatch ? (
                              <button
                                className="scheme-property-swatch"
                                style={{ backgroundColor: row.swatch }}
                                type="button"
                                onClick={() =>
                                  openColorPicker(
                                    (row.colorTarget as 'backgroundColor' | 'borderColor' | 'textColor') ?? 'backgroundColor',
                                    row.swatch as string,
                                  )
                                }
                              />
                            ) : row.action === 'shape' ? (
                              <button className="scheme-property-gallery-button" type="button" onClick={() => setDialog('shape-gallery')}>
                                ▦ <span>↶</span>
                              </button>
                            ) : row.action === 'image' ? (
                              <div className="scheme-property-image-actions">
                                <button type="button"><img src={folderIcon} alt="" /></button>
                                <button type="button"><img src={pasteIcon} alt="" /></button>
                                <button type="button"><img src={deleteIcon} alt="" /></button>
                              </div>
                            ) : row.control ? (
                              <div className="scheme-combo">
                                <button className="scheme-combo__button" type="button" onClick={() => setOpenDropdown(openDropdown === row.name ? null : row.name)}>
                                  <span>{row.value}</span>
                                  <span>⌄</span>
                                </button>
                                {openDropdown === row.name ? (
                                  <div className={`scheme-combo__menu scheme-combo__menu--${row.control}`}>
                                    {(row.control === 'moveMode'
                                      ? ['Прямой переход или копирование', 'Переход к первому доступному блоку', 'Случайный переход к любому из блоков']
                                      : row.control === 'fontFamily'
                                        ? [
                                            'Arial',
                                            'Arial Black',
                                            'Arial Narrow',
                                            'Bahnschrift',
                                            'Bahnschrift Condensed',
                                            'Bahnschrift Light',
                                            'Bahnschrift Light Condensed',
                                            'Bahnschrift SemiBold',
                                            'Bahnschrift SemiCondensed',
                                            'Calibri',
                                            'Cambria',
                                            'Consolas',
                                            'Segoe UI',
                                            'Times New Roman',
                                          ]
                                        : ['По умолчанию', 'Масштабировать', 'Заполнить', 'Масштабировать и заполнить']
                                    ).map((option) => (
                                      <button
                                        className={option === row.value ? 'is-selected' : ''}
                                        key={option}
                                        type="button"
                                        onClick={() => {
                                          if (row.control === 'moveMode') updateSelectedNodeField('moveMode', option);
                                          if (row.control === 'fontFamily') updateSelectedNodeField('fontFamily', option);
                                          if (row.control === 'imageMode') updateSelectedNodeField('imageMode', option);
                                          setOpenDropdown(null);
                                        }}
                                      >
                                        {option}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              row.value
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="scheme-properties__empty">Выберите элемент или стрелку на схеме.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="scheme-tests">
              <div className="scheme-dock-toolbar">
                <button className="scheme-dock-tool" type="button" title="Запустить тесты" aria-label="Запустить тесты">▶</button>
                <button className="scheme-dock-tool" type="button" title="Редактировать" aria-label="Редактировать"><img src={listIcon} alt="" /></button>
                <select value="По тэбам" onChange={() => undefined}>
                  <option>По тэбам</option>
                  <option>По результату</option>
                </select>
                <button className="scheme-dock-tool" type="button" title="Копировать" aria-label="Копировать"><img src={copyIcon} alt="" /></button>
                <button className="scheme-dock-tool" type="button" title="Вставить" aria-label="Вставить"><img src={pasteIcon} alt="" /></button>
                <button className="scheme-dock-tool" type="button" title="Удалить" aria-label="Удалить"><img src={deleteIcon} alt="" /></button>
              </div>
              <input className="scheme-tests__search" value={testsSearch} placeholder="Поиск тестов (F3)" onChange={(event) => setTestsSearch(event.target.value)} />
              <div className="scheme-tests__body">
                <div className="scheme-tests__empty">
                  <img src={folderIcon} alt="" />
                  <span>Тесты для выбранного ТЭБа не заданы.</span>
                </div>
              </div>
            </div>
          )}

          <div className="scheme-dock-tabs">
            <button className={rightPanelTab === 'properties' ? 'is-active' : ''} type="button" onClick={() => setRightPanelTab('properties')}>Свойства</button>
            <button className={rightPanelTab === 'tests' ? 'is-active' : ''} type="button" onClick={() => setRightPanelTab('tests')}>Тесты ТЭБов</button>
          </div>
        </aside>
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
              {[
                'ADVANCE',
                'ASSEMBLE',
                'ASSIGN',
                'BUFFER',
                'DEPART',
                'ENTER',
                'GATE',
                'GATHER',
                'GENERATE',
                'LEAVE',
                'LINK',
                'LOGIC',
                'LOOP',
                'MARK',
                'MATCH',
                'MSAVEVALUE',
                'PREEMPT',
                'PRIORITY',
                'QUEUE',
                'RELEASE',
                'RETURN',
                'SAVEVALUE',
                'SEIZE',
                'SELECT',
                'SPLIT',
                'TABULATE',
                'TERMINATE',
                'TEST',
                'TRANSFER',
                'UNLINK',
              ].map((shape) => (
                <button className={`scheme-shape-card ${selectedNode?.shape === shape ? 'is-selected' : ''}`} key={shape} type="button" onClick={() => applyShape(shape)}>
                  <span className={`scheme-shape-preview scheme-shape-preview--gpss scheme-shape-preview--${shape.toLowerCase()}`} />
                  <span>{shape}</span>
                </button>
              ))}
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
