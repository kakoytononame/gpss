import type { ActiveDocument } from '../../../shared/types/teb';
import csProjectIcon from '../../../shared/assets/icons/gpss-native/csproject_16.png';
import entityIcon from '../../../shared/assets/icons/gpss-native/entity_16.png';
import folderIcon from '../../../shared/assets/icons/gpss-native/folder_16.png';
import folderOpenedIcon from '../../../shared/assets/icons/gpss-native/folderopened_16.png';
import formCollectionIcon from '../../../shared/assets/icons/gpss-native/formcollection_16.png';
import formIcon from '../../../shared/assets/icons/gpss-native/form_16.png';
import gpssLogicSwitchIcon from '../../../shared/assets/icons/gpss-native/gpsslogicswitch_16.png';
import gpssMatrixIcon from '../../../shared/assets/icons/gpss-native/gpssmatrix_16.png';
import gpssObjectTableIcon from '../../../shared/assets/icons/gpss-native/gpssobjstable_16.png';
import gpssQueueIcon from '../../../shared/assets/icons/gpss-native/gpssequ_16.png';
import gpssSaveValueIcon from '../../../shared/assets/icons/gpss-native/gpsssavevalue_16.png';
import modelTextIcon from '../../../shared/assets/icons/gpss-native/simmodeltext_16.png';
import projectModelsIcon from '../../../shared/assets/icons/gpss-native/simmodelscollection_16.png';
import schemeIcon from '../../../shared/assets/icons/gpss-native/simmodeldiagram_16.png';
import simModelCurrentIcon from '../../../shared/assets/icons/gpss-native/simmodelcur_16.png';
import simulationIcon from '../../../shared/assets/icons/gpss-native/simmodeltasks_16.png';
import timelineIcon from '../../../shared/assets/icons/gpss-native/timeline_16.png';
import stdJournalIcon from '../../../shared/assets/icons/gpss-native/stdjournal_16.png';
import stdReportIcon from '../../../shared/assets/icons/gpss-native/stdreport_16.png';
import simpleTebIcon from '../../../shared/assets/icons/gpss-native/simpleteb16.png';
import tebsLibraryCollectionIcon from '../../../shared/assets/icons/gpss-native/tebslibrarycollection_16.png';
import tebsLibraryIcon from '../../../shared/assets/icons/gpss-native/tebslibrary_16.png';
import { getGpssBlockIconShape } from '../../../shared/lib/gpssBlockShapes';

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  iconAsset?: string;
  tebIconShape?: string;
  documentId?: ActiveDocument;
  children?: TreeNode[];
}

const standardGpssEntities = ['Устройство', 'Очередь', 'Многоканальное устройство', 'Логический ключ', 'Сохраняемая величина', 'Матрица'];

const standardAdditionalTebs = [
  'Внешняя анимация',
  'Генератор XN-потоков',
  'Начало события временной шкалы',
  'Событие временной шкалы',
  'Окончание события временной шкалы',
];

interface LibraryCategory {
  id: string;
  label: string;
  children: TreeNode[];
}

type IconAssetResolver = string | ((label: string, index: number) => string);

const gpssEntityIconAssets = [entityIcon, gpssQueueIcon, gpssObjectTableIcon, gpssLogicSwitchIcon, gpssSaveValueIcon, gpssMatrixIcon];

function createLibraryItems(prefix: string, labels: string[], iconAsset: IconAssetResolver = simpleTebIcon): TreeNode[] {
  return labels.map((label, index) => ({
    id: `${prefix}-${label.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-')}`,
    label,
    icon: 'library',
    iconAsset: typeof iconAsset === 'function' ? iconAsset(label, index) : iconAsset,
    tebIconShape: prefix.startsWith('standard-block') || prefix.startsWith('standard-additional') ? getGpssBlockIconShape(label) : undefined,
    documentId: 'editor',
  }));
}

function createLibraryFolder(id: string, label: string, children: TreeNode[]): TreeNode {
  return {
    id,
    label,
    icon: 'folder',
    iconAsset: folderOpenedIcon,
    children,
  };
}

const transactionCategories: LibraryCategory[] = [
  { id: 'generation', label: 'Генерация', children: createLibraryItems('standard-block-generation', ['GENERATE', 'SPLIT', 'Поток транзактов']) },
  {
    id: 'modification',
    label: 'Изменение',
    children: createLibraryItems('standard-block-modification', ['ADOPT', 'ASSIGN', 'COUNT', 'INDEX', 'MARK', 'PRIORITY', 'SELECT']),
  },
  { id: 'waiting', label: 'Ожидание', children: createLibraryItems('standard-block-waiting', ['ASSEMBLE', 'GATHER']) },
  { id: 'movement', label: 'Перемещение', children: createLibraryItems('standard-block-movement', ['DISPLACE', 'GATE', 'LOOP', 'TEST', 'TRANSFER']) },
  { id: 'removal', label: 'Удаление', children: createLibraryItems('standard-block-removal', ['TERMINATE']) },
];

const standardTebCategoryFolders: TreeNode[] = [
  createLibraryFolder(
    'standard-category-transactions',
    'Транзакты',
    transactionCategories.map((category) => createLibraryFolder(`standard-transactions-${category.id}`, category.label, category.children)),
  ),
  createLibraryFolder('standard-category-time-control', 'Управление временем', createLibraryItems('standard-block-time', ['ADVANCE', 'BUFFER'])),
  createLibraryFolder('standard-category-queues', 'Очереди', createLibraryItems('standard-block-queues', ['DEPART', 'QUEUE'])),
  createLibraryFolder('standard-category-user-lists', 'Списки пользователя', createLibraryItems('standard-block-user-lists', ['LINK', 'UNLINK'])),
  createLibraryFolder('standard-category-memory', 'Памяти', createLibraryItems('standard-block-memory', ['ENTER', 'LEAVE', 'SAVAIL', 'SUNAVAIL'])),
  createLibraryFolder(
    'standard-category-facilities',
    'Устройства',
    createLibraryItems('standard-block-facilities', ['FAVAIL', 'FUNAVAIL', 'PREEMPT', 'RELEASE', 'RETURN', 'SEIZE']),
  ),
  createLibraryFolder('standard-category-cells', 'Ячейки', createLibraryItems('standard-block-cells', ['SAVEVALUE'])),
  createLibraryFolder('standard-category-logic', 'Логические ключи', createLibraryItems('standard-block-logic', ['LOGIC'])),
  createLibraryFolder('standard-category-matrices', 'Матрицы', [
    ...createLibraryItems('standard-block-matrices', ['MSAVEVALUE']),
    ...createLibraryItems('standard-entity-matrix', ['Матрица'], gpssMatrixIcon),
  ]),
  createLibraryFolder('standard-category-groups', 'Группы', createLibraryItems('standard-block-groups', ['ALTER', 'EXAMINE', 'JOIN', 'REMOVE', 'SCAN'])),
  createLibraryFolder('standard-category-tables', 'Таблицы', createLibraryItems('standard-block-tables', ['TABULATE'])),
  createLibraryFolder('standard-category-files', 'Файлы', createLibraryItems('standard-block-files', ['CLOSE', 'OPEN', 'READ', 'SEEK', 'WRITE'])),
  createLibraryFolder(
    'standard-category-external-animation',
    'Внешняя анимация',
    createLibraryItems('standard-additional-external-animation', ['API внешней анимации'], simpleTebIcon),
  ),
  createLibraryFolder(
    'standard-category-timeline',
    'Временная диаграмма',
    createLibraryItems('standard-additional-timeline', ['Завершение задачи', 'Начало задачи'], timelineIcon),
  ),
];

export const LIBRARIES_TREE: TreeNode[] = [
  {
    id: 'teb-libraries-root',
    label: 'Библиотеки ТЭБов',
    icon: 'library',
    iconAsset: tebsLibraryCollectionIcon,
    children: [
      {
        id: 'standard-libraries',
        label: 'Стандартные',
        icon: 'folder',
        iconAsset: folderOpenedIcon,
        children: [
          {
            id: 'standard-mining-library',
            label: 'Горнодобывающее пр-во',
            icon: 'library',
            iconAsset: tebsLibraryIcon,
            children: [{ id: 'standard-mine-field-block', label: 'Блок шахтного поля', icon: 'library', iconAsset: simpleTebIcon, documentId: 'editor' }],
          },
          {
            id: 'standard-tebs',
            label: 'Стандартные ТЭБы',
            icon: 'library',
            iconAsset: tebsLibraryIcon,
            children: [
              ...standardTebCategoryFolders,
              createLibraryFolder(
                'standard-gpss-entities',
                'Объекты GPSS',
                createLibraryItems('standard-entity', standardGpssEntities, (_label, index) => gpssEntityIconAssets[index] ?? entityIcon),
              ),
              createLibraryFolder('standard-gpss-additional', 'Дополнительные ТЭБы', createLibraryItems('standard-additional', standardAdditionalTebs)),
            ],
          },
        ],
      },
      {
        id: 'current-project-library',
        label: 'Текущий проект',
        icon: 'folder',
        iconAsset: folderOpenedIcon,
        children: [
          {
            id: 'project-tebs-library',
            label: 'Библиотека ТЭБов',
            icon: 'library',
            iconAsset: tebsLibraryIcon,
            children: [
              { id: 'project-transactions', label: 'Транзакты', icon: 'folder', iconAsset: folderOpenedIcon },
              { id: 'project-canteen-library', label: 'Столовая', icon: 'folder', iconAsset: folderIcon },
            ],
          },
        ],
      },
      {
        id: 'user-libraries',
        label: 'Пользовательские',
        icon: 'folder',
        iconAsset: folderOpenedIcon,
        children: [
          {
            id: 'user-mining-library',
            label: 'Горнодобывающее пр-во',
            icon: 'library',
            iconAsset: tebsLibraryIcon,
            children: [{ id: 'mine-field-block', label: 'Блок шахтного поля', icon: 'library', iconAsset: simpleTebIcon, documentId: 'editor' }],
          },
        ],
      },
    ],
  },
];

export const PROJECT_TREE: TreeNode[] = [
  {
    id: 'project-home',
    label: 'Столовая',
    icon: 'none',
    documentId: 'start',
    children: [
      {
        id: 'models-root',
        label: 'Модели',
        icon: 'model',
        iconAsset: projectModelsIcon,
        children: [
          {
            id: 'current-model',
            label: 'Столовая (текущая модель)',
            icon: 'model',
            iconAsset: simModelCurrentIcon,
            children: [
              { id: 'scheme', label: 'Структурная схема', icon: 'scheme', iconAsset: schemeIcon, documentId: 'scheme' },
              { id: 'model-text', label: 'Текст модели', icon: 'text', iconAsset: modelTextIcon, documentId: 'model-text' },
              { id: 'data-files', label: 'Файлы с данными', icon: 'folder', iconAsset: folderIcon },
            ],
          },
          {
            id: 'model-run',
            label: 'Моделирование от 10.08.2018 10:59',
            icon: 'run',
            iconAsset: simulationIcon,
            children: [
              { id: 'std-report', label: 'Стандартный отчёт', icon: 'table', iconAsset: stdReportIcon, documentId: 'std-report' },
              { id: 'model-log', label: 'Журнал моделирования', icon: 'text', iconAsset: stdJournalIcon, documentId: 'model-log' },
            ],
          },
          {
            id: 'forms-root',
            label: 'Формы',
            icon: 'form',
            iconAsset: formCollectionIcon,
            children: [
              {
                id: 'forms-canteen',
                label: 'Столовая',
                icon: 'form',
                iconAsset: formIcon,
                children: [
                  { id: 'input-form', label: 'Форма ввода данных', icon: 'form', iconAsset: formIcon },
                  { id: 'report-templates', label: 'Шаблоны отчётов', icon: 'form', iconAsset: formCollectionIcon },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'libraries-root',
        label: 'Библиотеки ТЭБов проекта',
        icon: 'library',
        iconAsset: tebsLibraryCollectionIcon,
        children: [{ id: 'library', label: 'Библиотека ТЭБов', icon: 'library', iconAsset: tebsLibraryIcon }],
      },
      { id: 'csharp-libraries', label: 'Библиотеки C#', icon: 'code', iconAsset: csProjectIcon },
    ],
  },
];

/** Library items that can be dragged onto the structural scheme and open the TEB editor. */
export function isLibraryItem(nodeId: string): boolean {
  return (
    nodeId.startsWith('standard-block-') ||
    nodeId.startsWith('standard-entity-') ||
    nodeId.startsWith('standard-additional-') ||
    nodeId === 'mine-field-block' ||
    nodeId === 'standard-mine-field-block'
  );
}

export function isGpssEntityItem(nodeId: string): boolean {
  return nodeId.startsWith('standard-entity-');
}

/**
 * Keeps nodes whose label matches the query, together with their ancestors.
 */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const children = filterTree(node.children ?? [], normalizedQuery);
    const isMatch = node.label.toLowerCase().includes(normalizedQuery);
    return isMatch || children.length ? [{ ...node, children }] : [];
  });
}
