import { useMemo, useState } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import arrowDownIcon from '../../../shared/assets/icons/gpss-native/arrowdown_16.png';
import closeIcon from '../../../shared/assets/icons/gpss-native/closeblack_13.png';
import copyIcon from '../../../shared/assets/icons/gpss-native/copy16.png';
import deleteIcon from '../../../shared/assets/icons/gpss-native/delete_16.png';
import folderIcon from '../../../shared/assets/icons/gpss-native/folder_16.png';
import pasteIcon from '../../../shared/assets/icons/gpss-native/paste16.png';
import propertiesIcon from '../../../shared/assets/icons/gpss-native/properties_32.png';
import testFailedIcon from '../../../shared/assets/icons/gpss-native/testfailed_16.png';
import testNotRunIcon from '../../../shared/assets/icons/gpss-native/testnotrun_16.png';
import testPassedIcon from '../../../shared/assets/icons/gpss-native/testpassed_16.png';
import tebsPropertiesIcon from '../../../shared/assets/icons/gpss-native/tebsproperties_32.png';
import type { RightPanelTab, SchemeNode } from '../../../shared/types/teb';
import './RightDockPanel.css';

type EditableSchemeField =
  | 'nameInModel'
  | 'label'
  | 'description'
  | 'className'
  | 'classId'
  | 'isLibraryClass'
  | 'instanceCount'
  | 'moveMode'
  | 'shape'
  | 'cornerRadius'
  | 'backgroundColor'
  | 'borderColor'
  | 'borderWidth'
  | 'textColor'
  | 'fontFamily'
  | 'fontSize'
  | 'fontBold'
  | 'fontItalic'
  | 'imageMode'
  | 'x'
  | 'y'
  | 'width'
  | 'height';

interface PropertyRow {
  group?: string;
  name?: string;
  value?: string | number | boolean;
  field?: EditableSchemeField;
  type?: 'text' | 'number' | 'color' | 'select' | 'checkbox' | 'actions' | 'readonly';
  actionKind?: 'shape' | 'image';
  options?: string[];
  min?: number;
  max?: number;
}

const MOVE_MODE_OPTIONS = ['Прямой переход или копирование', 'Переход к первому доступному блоку', 'Случайный переход к любому из блоков'];
const IMAGE_MODE_OPTIONS = ['По умолчанию', 'Масштабировать', 'Заполнить', 'Масштабировать и заполнить'];
const FONT_OPTIONS = ['Arial', 'Arial Black', 'Arial Narrow', 'Bahnschrift', 'Calibri', 'Cambria', 'Consolas', 'Segoe UI', 'Times New Roman'];
const SHAPE_OPTIONS = [
  'Прямоугольник',
  'Круг',
  'Эллипс',
  'Треугольник 1',
  'Треугольник 2',
  'ТЭБ с данными',
  'Шестиугольник',
  'ADVANCE',
  'ASSEMBLE',
  'ASSIGN',
  'BUFFER',
  'DEPART',
  'ENTER',
  'GENERATE',
  'QUEUE',
  'SEIZE',
  'TERMINATE',
  'TRANSFER',
];

function classIdForNode(node: SchemeNode | null, fallbackId?: string) {
  if (!node) {
    return fallbackId || 'e0ec7fc3-44d2-404d-9736-53bcca5c804e';
  }

  if (node.classId) {
    return node.classId;
  }

  if (node.kind === 'data') {
    return '9fc53553-54ce-43b0-8894-a5086ebcd2aa';
  }

  if (node.kind === 'time') {
    return '5dc45591-49c8-46d3-8c70-f49c5a707d91';
  }

  return fallbackId || 'e0ec7fc3-44d2-404d-9736-53bcca5c804e';
}

function classNameForNode(node: SchemeNode | null, fallbackType?: string) {
  if (!node) {
    return fallbackType || 'SimpleTebClass';
  }

  if (node.className) {
    return node.className;
  }

  if (node.kind === 'data') {
    return 'DataTebClass';
  }

  if (node.kind === 'time') {
    return 'TimeTebClass';
  }

  return fallbackType || 'SimpleTebClass';
}

function normalizeNumber(value: string, fallback: number, min = 0, max = 3000) {
  const next = Number(value.replace(',', '.'));

  if (!Number.isFinite(next)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, next));
}

function PanelCaption({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="right-dock-caption">
      <span className="right-dock-caption__title">{title}</span>
      <span className="right-dock-caption__grip" aria-hidden="true">
        ..................................................
      </span>
      <button className="right-dock-caption__button" type="button" title="Меню панели" aria-label="Меню панели">
        <img src={arrowDownIcon} alt="" aria-hidden="true" />
      </button>
      <button className="right-dock-caption__button" type="button" title="Закрыть панель" aria-label="Закрыть панель" onClick={onClose}>
        <img src={closeIcon} alt="" aria-hidden="true" />
      </button>
    </div>
  );
}

function PropertyValue({
  row,
  disabled,
  onChange,
  onCommit,
  onOpenShapeGallery,
}: {
  row: PropertyRow;
  disabled: boolean;
  onChange: (field: EditableSchemeField, value: string | number | boolean) => void;
  onCommit: () => void;
  onOpenShapeGallery: () => void;
}) {
  if ((!row.field && row.type !== 'actions') || row.type === 'readonly') {
    return <span className="property-value-text">{String(row.value ?? '')}</span>;
  }

  if (row.type === 'checkbox') {
    return (
      <input
        checked={Boolean(row.value)}
        className="property-check"
        disabled={disabled}
        type="checkbox"
        aria-label={row.name}
        onChange={(event) => {
          onChange(row.field as EditableSchemeField, event.target.checked);
          onCommit();
        }}
      />
    );
  }

  if (row.type === 'color') {
    return (
      <input
        className="property-color-input"
        disabled={disabled}
        type="color"
        value={String(row.value || '#000000')}
        aria-label={row.name}
        onBlur={onCommit}
        onChange={(event) => onChange(row.field as EditableSchemeField, event.target.value)}
      />
    );
  }

  if (row.type === 'select') {
    return (
      <select
        className="property-select"
        disabled={disabled}
        value={String(row.value ?? '')}
        aria-label={row.name}
        onChange={(event) => {
          onChange(row.field as EditableSchemeField, event.target.value);
          onCommit();
        }}
      >
        {(row.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (row.type === 'actions') {
    const isShapeAction = row.actionKind !== 'image';

    return (
      <div className="property-actions">
        <button type="button" title={isShapeAction ? 'Выбрать форму тэба' : 'Выбрать файл'} disabled={disabled} onClick={isShapeAction ? onOpenShapeGallery : undefined}>
          {isShapeAction ? '▦' : <img src={folderIcon} alt="" aria-hidden="true" />}
        </button>
        <button type="button" title={isShapeAction ? 'Сбросить форму' : 'Вставить изображение'} disabled={disabled}>
          <img src={pasteIcon} alt="" aria-hidden="true" />
        </button>
        <button type="button" title={isShapeAction ? 'Удалить форму' : 'Удалить изображение'} disabled={disabled}>
          <img src={deleteIcon} alt="" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (row.type === 'number') {
    return (
      <input
        className="property-input"
        disabled={disabled}
        type="number"
        min={row.min}
        max={row.max}
        value={String(row.value ?? '')}
        aria-label={row.name}
        onBlur={onCommit}
        onChange={(event) => onChange(row.field as EditableSchemeField, normalizeNumber(event.target.value, Number(row.value ?? 0), row.min, row.max))}
      />
    );
  }

  return (
    <input
      className="property-input"
      disabled={disabled}
      type="text"
      value={String(row.value ?? '')}
      aria-label={row.name}
      onBlur={onCommit}
      onChange={(event) => onChange(row.field as EditableSchemeField, event.target.value)}
    />
  );
}

function PropertiesView() {
  const teb = useTebEditorStore((state) => state.teb);
  const schemeSelection = useTebEditorStore((state) => state.schemeSelection);
  const schemeNodes = useTebEditorStore((state) => state.schemeNodes);
  const setSchemeNodes = useTebEditorStore((state) => state.setSchemeNodes);
  const saveWorkspaceSnapshot = useTebEditorStore((state) => state.saveWorkspaceSnapshot);
  const [search, setSearch] = useState('');
  const [shapeGalleryOpen, setShapeGalleryOpen] = useState(false);

  const selectedSchemeNode = schemeSelection?.type === 'node' ? schemeNodes.find((node) => node.id === schemeSelection.id) ?? null : null;
  const disabled = !selectedSchemeNode;
  const modelName = selectedSchemeNode?.nameInModel || selectedSchemeNode?.id.replaceAll('-', '') || teb?.nameInModel || 'teb3';
  const classTitle = selectedSchemeNode?.label || teb?.header || 'Обслуживание посетителя';
  const className = classNameForNode(selectedSchemeNode, teb?.type);
  const classId = classIdForNode(selectedSchemeNode, teb?.id);

  function updateSelectedNode(field: EditableSchemeField, value: string | number | boolean) {
    if (!selectedSchemeNode) {
      return;
    }

    setSchemeNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== selectedSchemeNode.id) {
          return node;
        }

        return { ...node, [field]: value };
      }),
      `Свойство "${field}" элемента схемы изменено.`,
    );
  }

  function commitWorkspace() {
    saveWorkspaceSnapshot();
  }

  function applyShape(shape: string) {
    updateSelectedNode('shape', shape);
    setShapeGalleryOpen(false);
    commitWorkspace();
  }

  const rows = useMemo<PropertyRow[]>(
    () => [
      { group: '1. Основные' },
      { name: 'Имя в модели', field: 'nameInModel', value: modelName, type: 'text' },
      { name: 'Описание', field: 'description', value: selectedSchemeNode?.description || teb?.description || '', type: 'text' },
      { name: 'Имя класса', field: 'className', value: className, type: 'text' },
      { name: 'Заголовок класса', field: 'label', value: classTitle, type: 'text' },
      { name: 'ID класса тэба', field: 'classId', value: classId, type: 'text' },
      { name: 'Класс из библиотеки', field: 'isLibraryClass', value: selectedSchemeNode?.isLibraryClass ?? false, type: 'checkbox' },
      { group: '3. Дублирование' },
      { name: 'Количество экземпляров', field: 'instanceCount', value: selectedSchemeNode?.instanceCount ?? 1, type: 'number', min: 1, max: 999 },
      { name: 'Режим перемещения', field: 'moveMode', value: selectedSchemeNode?.moveMode || MOVE_MODE_OPTIONS[0], type: 'select', options: MOVE_MODE_OPTIONS },
      { group: '4. Форма' },
      { name: 'Форма тэба', field: 'shape', value: selectedSchemeNode?.shape || 'Прямоугольник', type: 'actions', actionKind: 'shape' },
      { name: 'Закругление углов', field: 'cornerRadius', value: selectedSchemeNode?.cornerRadius ?? 0, type: 'number', min: 0, max: 80 },
      { group: '5. Стиль' },
      { name: 'Цвет фона', field: 'backgroundColor', value: selectedSchemeNode?.backgroundColor || '#87cefa', type: 'color' },
      { name: 'Цвет границы', field: 'borderColor', value: selectedSchemeNode?.borderColor || '#4f9bcd', type: 'color' },
      { name: 'Толщина границы', field: 'borderWidth', value: selectedSchemeNode?.borderWidth ?? 1, type: 'number', min: 0, max: 12 },
      { group: '6. Текст' },
      { name: 'Текст', field: 'label', value: classTitle, type: 'text' },
      { name: 'Шрифт', field: 'fontFamily', value: selectedSchemeNode?.fontFamily || 'Arial', type: 'select', options: FONT_OPTIONS },
      { name: 'Размер шрифта', field: 'fontSize', value: selectedSchemeNode?.fontSize ?? 12, type: 'number', min: 8, max: 48 },
      { name: 'Полужирный', field: 'fontBold', value: selectedSchemeNode?.fontBold ?? false, type: 'checkbox' },
      { name: 'Курсив', field: 'fontItalic', value: selectedSchemeNode?.fontItalic ?? false, type: 'checkbox' },
      { name: 'Цвет текста', field: 'textColor', value: selectedSchemeNode?.textColor || '#000000', type: 'color' },
      { group: '7. Изображение' },
      { name: 'Изображение', value: '', type: 'actions', actionKind: 'image' },
      { name: 'Режим отображения', field: 'imageMode', value: selectedSchemeNode?.imageMode || 'Масштабировать', type: 'select', options: IMAGE_MODE_OPTIONS },
      { group: '8. Положение и размер' },
      { name: 'X', field: 'x', value: selectedSchemeNode ? Math.round(selectedSchemeNode.x) : 0, type: 'number', min: 0, max: 1300 },
      { name: 'Y', field: 'y', value: selectedSchemeNode ? Math.round(selectedSchemeNode.y) : 0, type: 'number', min: 0, max: 640 },
      { name: 'Ширина', field: 'width', value: selectedSchemeNode ? Math.round(selectedSchemeNode.width) : 160, type: 'number', min: 40, max: 800 },
      { name: 'Высота', field: 'height', value: selectedSchemeNode ? Math.round(selectedSchemeNode.height) : 60, type: 'number', min: 28, max: 500 },
    ],
    [classId, className, classTitle, modelName, selectedSchemeNode, teb?.description],
  );

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((row) => row.group || `${row.name ?? ''} ${row.value ?? ''}`.toLowerCase().includes(query));
  }, [rows, search]);

  return (
    <div className="properties-view">
      <div className="properties-toolbar">
        <img src={propertiesIcon} alt="" aria-hidden="true" />
        <img src={tebsPropertiesIcon} alt="" aria-hidden="true" />
        <input type="search" placeholder="Поиск свойств" aria-label="Поиск свойств" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="properties-grid" role="table" aria-label="Свойства">
        {visibleRows.map((row, index) =>
          row.group ? (
            <div className="property-group" role="row" key={`${row.group}-${index}`}>
              {row.group}
            </div>
          ) : (
            <div className="property-row" role="row" key={`${row.name}-${index}`}>
              <div className="property-name" role="cell">
                {row.name}
              </div>
              <div className="property-value" role="cell">
                <PropertyValue
                  row={row}
                  disabled={disabled}
                  onChange={updateSelectedNode}
                  onCommit={commitWorkspace}
                  onOpenShapeGallery={() => setShapeGalleryOpen(true)}
                />
              </div>
            </div>
          ),
        )}
      </div>

      {shapeGalleryOpen ? (
        <div className="property-modal-backdrop">
          <div className="property-shape-dialog" role="dialog" aria-modal="true" aria-label="Галерея форм тэба">
            <div className="property-shape-dialog__title">
              <span>Галерея форм тэба</span>
              <button type="button" aria-label="Закрыть" onClick={() => setShapeGalleryOpen(false)}>
                ×
              </button>
            </div>
            <div className="property-shape-dialog__body">
              {SHAPE_OPTIONS.map((shape) => (
                <button
                  className={selectedSchemeNode?.shape === shape ? 'is-selected' : ''}
                  key={shape}
                  type="button"
                  onClick={() => applyShape(shape)}
                >
                  <span className="property-shape-preview" aria-hidden="true" />
                  <span>{shape}</span>
                </button>
              ))}
            </div>
            <div className="property-shape-dialog__actions">
              <button type="button" onClick={() => setShapeGalleryOpen(false)}>
                OK
              </button>
              <button type="button" onClick={() => setShapeGalleryOpen(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TestsView() {
  const tests = useTebEditorStore((state) => state.tebTests);
  const setTebTestStatus = useTebEditorStore((state) => state.setTebTestStatus);

  function runTests() {
    tests.forEach((test) => {
      const failed = test.id === 'test-parameters';
      setTebTestStatus(test.id, failed ? 'failed' : 'passed', failed ? 'Требуется значение заголовка класса.' : 'Тест выполнен успешно.');
    });
  }

  function clearTests() {
    tests.forEach((test) => setTebTestStatus(test.id, 'not-run', 'Не запускался.'));
  }

  return (
    <div className="teb-tests-view">
      <div className="teb-tests-toolbar">
        <button type="button" title="Запустить тесты" onClick={runTests}>
          <img src={testNotRunIcon} alt="" aria-hidden="true" />
        </button>
        <button type="button" title="Сгруппировать по тэбам">По тэбам</button>
        <button type="button" title="Скопировать результаты">
          <img src={copyIcon} alt="" aria-hidden="true" />
        </button>
        <button type="button" title="Очистить результаты" onClick={clearTests}>
          <img src={deleteIcon} alt="" aria-hidden="true" />
        </button>
      </div>
      <input className="teb-tests-search" type="search" placeholder="Поиск тестов (F3)" aria-label="Поиск тестов" />
      <div className="teb-tests-list">
        {tests.map((test) => (
          <div className={`teb-test-row teb-test-row--${test.status}`} key={test.name}>
            <img src={test.status === 'passed' ? testPassedIcon : test.status === 'failed' ? testFailedIcon : testNotRunIcon} alt="" aria-hidden="true" />
            <div>
              <div className="teb-test-row__name">{test.name}</div>
              <div className="teb-test-row__message">{test.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RightDockPanel() {
  const rightPanelTab = useTebEditorStore((state) => state.rightPanelTab);
  const setRightPanelTab = useTebEditorStore((state) => state.setRightPanelTab);
  const toggleRightPanel = useTebEditorStore((state) => state.toggleRightPanel);

  const title = rightPanelTab === 'properties' ? 'Свойства' : 'Тесты ТЭБов';

  function switchTab(tab: RightPanelTab) {
    setRightPanelTab(tab);
  }

  return (
    <aside className="right-dock-panel">
      <PanelCaption title={title} onClose={toggleRightPanel} />
      <div className="right-dock-content">{rightPanelTab === 'properties' ? <PropertiesView /> : <TestsView />}</div>
      <div className="right-dock-tabs" role="tablist" aria-label="Правая панель">
        <button className={rightPanelTab === 'properties' ? 'is-active' : ''} type="button" role="tab" aria-selected={rightPanelTab === 'properties'} onClick={() => switchTab('properties')}>
          Свойства
        </button>
        <button className={rightPanelTab === 'teb-tests' ? 'is-active' : ''} type="button" role="tab" aria-selected={rightPanelTab === 'teb-tests'} onClick={() => switchTab('teb-tests')}>
          Тесты ТЭБов
        </button>
      </div>
    </aside>
  );
}
