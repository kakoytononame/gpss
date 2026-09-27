import type { SchemeNode, TebDocument } from '../../../shared/types/teb';

export type EditableSchemeField = keyof Pick<
  SchemeNode,
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
  | 'height'
>;

export type PropertyValueType = 'text' | 'number' | 'color' | 'select' | 'checkbox' | 'actions' | 'readonly';

export interface PropertyGroupRow {
  kind: 'group';
  title: string;
}

export interface PropertyFieldRow {
  kind: 'field';
  name: string;
  value: string | number | boolean;
  field?: EditableSchemeField;
  type: PropertyValueType;
  actionKind?: 'shape' | 'image';
  options?: string[];
  min?: number;
  max?: number;
}

export type PropertyRow = PropertyGroupRow | PropertyFieldRow;

export const MOVE_MODE_OPTIONS = ['Прямой переход или копирование', 'Переход к первому доступному блоку', 'Случайный переход к любому из блоков'];
export const IMAGE_MODE_OPTIONS = ['По умолчанию', 'Масштабировать', 'Заполнить', 'Масштабировать и заполнить'];
export const FONT_OPTIONS = ['Arial', 'Arial Black', 'Arial Narrow', 'Bahnschrift', 'Calibri', 'Cambria', 'Consolas', 'Segoe UI', 'Times New Roman'];
export const SHAPE_OPTIONS = [
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

const DATA_TEB_CLASS_ID = '9fc53553-54ce-43b0-8894-a5086ebcd2aa';
const TIME_TEB_CLASS_ID = '5dc45591-49c8-46d3-8c70-f49c5a707d91';
const DEFAULT_TEB_CLASS_ID = 'e0ec7fc3-44d2-404d-9736-53bcca5c804e';

function classIdForNode(node: SchemeNode | null, fallbackId?: string): string {
  if (node?.classId) {
    return node.classId;
  }

  if (node?.kind === 'data') {
    return DATA_TEB_CLASS_ID;
  }

  if (node?.kind === 'time') {
    return TIME_TEB_CLASS_ID;
  }

  return fallbackId || DEFAULT_TEB_CLASS_ID;
}

function classNameForNode(node: SchemeNode | null, fallbackType?: string): string {
  if (node?.className) {
    return node.className;
  }

  if (node?.kind === 'data') {
    return 'DataTebClass';
  }

  if (node?.kind === 'time') {
    return 'TimeTebClass';
  }

  return fallbackType || 'SimpleTebClass';
}

const group = (title: string): PropertyGroupRow => ({ kind: 'group', title });
const field = (row: Omit<PropertyFieldRow, 'kind'>): PropertyFieldRow => ({ kind: 'field', ...row });

/**
 * Property grid of the selected scheme node. Without a selection the grid shows
 * the TEB being edited in read-only form.
 */
export function buildPropertyRows(node: SchemeNode | null, teb: TebDocument | null): PropertyRow[] {
  const title = node?.label || teb?.header || 'Обслуживание посетителя';

  return [
    group('1. Основные'),
    field({ name: 'Имя в модели', field: 'nameInModel', value: node?.nameInModel || node?.id.replaceAll('-', '') || teb?.nameInModel || 'teb3', type: 'text' }),
    field({ name: 'Описание', field: 'description', value: node ? (node.description ?? '') : (teb?.description ?? ''), type: 'text' }),
    field({ name: 'Имя класса', field: 'className', value: classNameForNode(node, teb?.type), type: 'text' }),
    field({ name: 'Заголовок класса', field: 'label', value: title, type: 'text' }),
    field({ name: 'ID класса тэба', field: 'classId', value: classIdForNode(node, teb?.id), type: 'text' }),
    field({ name: 'Класс из библиотеки', field: 'isLibraryClass', value: node?.isLibraryClass ?? false, type: 'checkbox' }),
    group('3. Дублирование'),
    field({ name: 'Количество экземпляров', field: 'instanceCount', value: node?.instanceCount ?? 1, type: 'number', min: 1, max: 999 }),
    field({ name: 'Режим перемещения', field: 'moveMode', value: node?.moveMode || MOVE_MODE_OPTIONS[0], type: 'select', options: MOVE_MODE_OPTIONS }),
    group('4. Форма'),
    field({ name: 'Форма тэба', field: 'shape', value: node?.shape || 'Прямоугольник', type: 'actions', actionKind: 'shape' }),
    field({ name: 'Закругление углов', field: 'cornerRadius', value: node?.cornerRadius ?? 0, type: 'number', min: 0, max: 80 }),
    group('5. Стиль'),
    field({ name: 'Цвет фона', field: 'backgroundColor', value: node?.backgroundColor || '#87cefa', type: 'color' }),
    field({ name: 'Цвет границы', field: 'borderColor', value: node?.borderColor || '#4f9bcd', type: 'color' }),
    field({ name: 'Толщина границы', field: 'borderWidth', value: node?.borderWidth ?? 1, type: 'number', min: 0, max: 12 }),
    group('6. Текст'),
    field({ name: 'Текст', field: 'label', value: title, type: 'text' }),
    field({ name: 'Шрифт', field: 'fontFamily', value: node?.fontFamily || 'Arial', type: 'select', options: FONT_OPTIONS }),
    field({ name: 'Размер шрифта', field: 'fontSize', value: node?.fontSize ?? 12, type: 'number', min: 8, max: 48 }),
    field({ name: 'Полужирный', field: 'fontBold', value: node?.fontBold ?? false, type: 'checkbox' }),
    field({ name: 'Курсив', field: 'fontItalic', value: node?.fontItalic ?? false, type: 'checkbox' }),
    field({ name: 'Цвет текста', field: 'textColor', value: node?.textColor || '#000000', type: 'color' }),
    group('7. Изображение'),
    field({ name: 'Изображение', value: '', type: 'actions', actionKind: 'image' }),
    field({ name: 'Режим отображения', field: 'imageMode', value: node?.imageMode || 'Масштабировать', type: 'select', options: IMAGE_MODE_OPTIONS }),
    group('8. Положение и размер'),
    field({ name: 'X', field: 'x', value: node ? Math.round(node.x) : 0, type: 'number', min: 0, max: 1300 }),
    field({ name: 'Y', field: 'y', value: node ? Math.round(node.y) : 0, type: 'number', min: 0, max: 640 }),
    field({ name: 'Ширина', field: 'width', value: node ? Math.round(node.width) : 160, type: 'number', min: 40, max: 800 }),
    field({ name: 'Высота', field: 'height', value: node ? Math.round(node.height) : 60, type: 'number', min: 28, max: 500 }),
  ];
}

/**
 * Filters the grid by property name or value; groups without matching rows are hidden.
 */
export function filterPropertyRows(rows: PropertyRow[], search: string): PropertyRow[] {
  const query = search.trim().toLowerCase();
  if (!query) {
    return rows;
  }

  const result: PropertyRow[] = [];
  let pendingGroup: PropertyGroupRow | null = null;

  for (const row of rows) {
    if (row.kind === 'group') {
      pendingGroup = row;
      continue;
    }

    if (`${row.name} ${row.value}`.toLowerCase().includes(query)) {
      if (pendingGroup) {
        result.push(pendingGroup);
        pendingGroup = null;
      }
      result.push(row);
    }
  }

  return result;
}

/** Parses a number typed with either decimal separator and clamps it into [min, max]. */
export function parseBoundedNumber(value: string, fallback: number, min = 0, max = 3000): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? Math.min(max, Math.max(min, parsed)) : fallback;
}
