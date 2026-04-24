import { useMemo, useState } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import type { ActiveDocument } from '../../../shared/types/teb';
import csProjectIcon from '../../../shared/assets/icons/cs-project.png';
import folderIcon from '../../../shared/assets/icons/folder.png';
import libraryIcon from '../../../shared/assets/icons/library.png';
import modelTextIcon from '../../../shared/assets/icons/model-text.png';
import schemeIcon from '../../../shared/assets/icons/scheme.png';
import stdReportIcon from '../../../shared/assets/icons/std-report.png';
import tebsLibraryIcon from '../../../shared/assets/icons/tebs-library.png';
import './ProjectExplorer.css';

interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  iconAsset?: string;
  documentId?: ActiveDocument;
  children?: TreeNode[];
}

type ExplorerMode = 'project' | 'libraries';

interface ExplorerConfig {
  title: string;
  searchPlaceholder: string;
  tree: TreeNode[];
}

interface ProjectExplorerProps {
  autoHide: boolean;
  onToggleAutoHide: () => void;
}

const librariesTree: TreeNode[] = [
  {
    id: 'teb-libraries-root',
    label: 'Библиотеки ТЭБов',
    icon: 'library',
    iconAsset: libraryIcon,
    children: [
      {
        id: 'standard-libraries',
        label: 'Стандартные',
        icon: 'folder',
        iconAsset: folderIcon,
        children: [
          { id: 'mining-library', label: 'Горнодобывающее пр-во', icon: 'library', iconAsset: tebsLibraryIcon },
          { id: 'standard-tebs', label: 'Стандартные ТЭБы', icon: 'library', iconAsset: tebsLibraryIcon },
        ],
      },
      {
        id: 'current-project-library',
        label: 'Текущий проект',
        icon: 'folder',
        iconAsset: folderIcon,
        children: [
          {
            id: 'canteen-library-category',
            label: 'Столовая',
            icon: 'library',
            iconAsset: tebsLibraryIcon,
            children: [{ id: 'library', label: 'Обслуживание посетителя. Касса 1', icon: 'library', iconAsset: tebsLibraryIcon, documentId: 'editor' }],
          },
        ],
      },
      {
        id: 'user-libraries',
        label: 'Пользовательские',
        icon: 'folder',
        iconAsset: folderIcon,
        children: [{ id: 'user-mining-library', label: 'Горнодобывающее пр-во', icon: 'library', iconAsset: tebsLibraryIcon }],
      },
    ],
  },
];

const projectTree: TreeNode[] = [
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
        children: [
          {
            id: 'current-model',
            label: 'Столовая (текущая модель)',
            icon: 'model',
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
            children: [
              { id: 'std-report', label: 'Стандартный отчёт', icon: 'table', iconAsset: stdReportIcon, documentId: 'std-report' },
              { id: 'model-log', label: 'Журнал моделирования', icon: 'text', iconAsset: modelTextIcon, documentId: 'model-log' },
            ],
          },
          {
            id: 'forms-root',
            label: 'Формы',
            icon: 'form',
            children: [
              {
                id: 'forms-canteen',
                label: 'Столовая',
                icon: 'form',
                children: [
                  { id: 'input-form', label: 'Форма ввода данных', icon: 'form' },
                  { id: 'report-templates', label: 'Шаблоны отчётов', icon: 'form' },
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
        iconAsset: libraryIcon,
        children: [{ id: 'library', label: 'Библиотека ТЭБов', icon: 'library', iconAsset: tebsLibraryIcon, documentId: 'editor' }],
      },
      { id: 'csharp-libraries', label: 'Библиотеки C#', icon: 'code', iconAsset: csProjectIcon },
    ],
  },
];

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query.trim()) {
    return nodes;
  }

  const normalizedQuery = query.trim().toLowerCase();

  return nodes.flatMap((node) => {
    const children = filterTree(node.children ?? [], query);
    const isMatch = node.label.toLowerCase().includes(normalizedQuery);

    if (!isMatch && !children.length) {
      return [];
    }

    return [{ ...node, children }];
  });
}

interface TreeBranchProps {
  node: TreeNode;
  level: number;
  selectedNodeId: string;
  collapsedNodeIds: string[];
  forceExpanded: boolean;
  onFocus: (nodeId: string) => void;
  onOpen: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
}

function TreeBranch({ node, level, selectedNodeId, collapsedNodeIds, forceExpanded, onFocus, onOpen, onToggle }: TreeBranchProps) {
  const hasChildren = Boolean(node.children?.length);
  const isCollapsed = hasChildren && !forceExpanded && collapsedNodeIds.includes(node.id);
  const isActive = selectedNodeId === node.id;

  function handleRowClick() {
    onFocus(node.id);

    if (hasChildren && !forceExpanded) {
      onToggle(node.id);
      return;
    }

    if (node.documentId) {
      onOpen(node.id);
    }
  }

  return (
    <div>
      <button className={`tree-row ${isActive ? 'is-active' : ''}`} style={{ ['--level' as string]: level }} type="button" onClick={handleRowClick}>
        <span
          className={`tree-row__chevron ${hasChildren ? 'is-clickable' : ''} ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`}
          aria-hidden="true"
          onClick={(event) => {
            if (!hasChildren) {
              return;
            }

            event.stopPropagation();
            onFocus(node.id);
            onToggle(node.id);
          }}
        />
        {node.iconAsset ? <img className="tree-row__img" src={node.iconAsset} alt="" aria-hidden="true" /> : <span className={`tree-row__icon tree-row__icon--${node.icon}`} />}
        <span className="tree-row__label" title={node.label}>
          {node.label}
        </span>
      </button>

      {!isCollapsed &&
        node.children?.map((child) => (
          <TreeBranch
            key={child.id}
            node={child}
            level={level + 1}
            selectedNodeId={selectedNodeId}
            collapsedNodeIds={collapsedNodeIds}
            forceExpanded={forceExpanded}
            onFocus={onFocus}
            onOpen={onOpen}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

export function ProjectExplorer({ autoHide, onToggleAutoHide }: ProjectExplorerProps) {
  const selectedNodeId = useTebEditorStore((state) => state.selectedNodeId);
  const collapsedNodeIds = useTebEditorStore((state) => state.collapsedNodeIds);
  const projectSearchQuery = useTebEditorStore((state) => state.projectSearchQuery);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const focusProjectNode = useTebEditorStore((state) => state.focusProjectNode);
  const toggleExplorer = useTebEditorStore((state) => state.toggleExplorer);
  const toggleTreeNode = useTebEditorStore((state) => state.toggleTreeNode);
  const setProjectSearchQuery = useTebEditorStore((state) => state.setProjectSearchQuery);
  const [explorerMode, setExplorerMode] = useState<ExplorerMode>('project');

  const explorerConfig = useMemo<ExplorerConfig>(() => {
    if (explorerMode === 'libraries') {
      return {
        title: 'Библиотеки ТЭБов',
        searchPlaceholder: 'Поиск по библиотекам ТЭБов (F3)',
        tree: librariesTree,
      };
    }

    return {
      title: 'Текущий проект',
      searchPlaceholder: 'Поиск в проекте (F3)',
      tree: projectTree,
    };
  }, [explorerMode]);

  const filteredTree = useMemo(() => filterTree(explorerConfig.tree, projectSearchQuery), [explorerConfig.tree, projectSearchQuery]);
  const forceExpanded = projectSearchQuery.trim().length > 0;

  function handleOpenNode(nodeId: string) {
    const documentId =
      nodeId === 'scheme'
        ? 'scheme'
        : nodeId === 'model-text'
          ? 'model-text'
          : nodeId === 'std-report'
            ? 'std-report'
            : nodeId === 'model-log'
              ? 'model-log'
              : nodeId === 'library'
                ? 'editor'
                : nodeId === 'project-home'
                  ? 'start'
                  : null;

    if (documentId) {
      activateDocument(documentId);
    }
  }

  return (
    <aside className={`project-explorer ${autoHide ? 'project-explorer--auto-hide' : ''}`}>
      {autoHide ? (
        <div className="explorer-auto-tabs" aria-hidden="true">
          <span className={`explorer-auto-tab ${explorerMode === 'project' ? 'is-active' : ''}`}>Текущий проект</span>
          <span className={`explorer-auto-tab ${explorerMode === 'libraries' ? 'is-active' : ''}`}>Библиотеки ТЭБов</span>
        </div>
      ) : null}

      <div className="project-explorer__panel">
        <div className="panel-caption">
          <span className="panel-caption__title">{explorerConfig.title}</span>
          <div className="panel-caption__tools">
            <span className="panel-caption__grip" aria-hidden="true">
              ................................
            </span>
            <button className="panel-caption__button" type="button" title="Сбросить поиск" aria-label="Сбросить поиск" onClick={() => setProjectSearchQuery('')}>
              <span aria-hidden="true">▾</span>
            </button>
            <button
              className={`panel-caption__button panel-caption__button--pin ${autoHide ? 'is-auto-hide' : ''}`}
              type="button"
              title={autoHide ? 'Закрепить панель' : 'Скрывать автоматически'}
              aria-label={autoHide ? 'Закрепить панель' : 'Скрывать автоматически'}
              aria-pressed={autoHide}
              onClick={onToggleAutoHide}
            >
              <span aria-hidden="true">⌖</span>
            </button>
            <button className="panel-caption__button" type="button" title="Закрыть панель" aria-label="Закрыть панель" onClick={toggleExplorer}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        <div className="project-search">
          <input
            className="project-search__input"
            type="search"
            value={projectSearchQuery}
            placeholder={explorerConfig.searchPlaceholder}
            aria-label={explorerConfig.searchPlaceholder}
            onChange={(event) => setProjectSearchQuery(event.target.value)}
          />
        </div>

        <div className="tree-view">
          <div className="tree-view__content">
            {filteredTree.length ? (
              filteredTree.map((node) => (
                <TreeBranch
                  key={node.id}
                  node={node}
                  level={0}
                  selectedNodeId={selectedNodeId}
                  collapsedNodeIds={collapsedNodeIds}
                  forceExpanded={forceExpanded}
                  onFocus={focusProjectNode}
                  onOpen={handleOpenNode}
                  onToggle={toggleTreeNode}
                />
              ))
            ) : (
              <div className="tree-empty">Совпадений не найдено.</div>
            )}
          </div>
          <div className="tree-view__scrollbar" aria-hidden="true">
            <span className="tree-view__scroll-arrow">‹</span>
            <span className="tree-view__scroll-thumb" />
            <span className="tree-view__scroll-arrow">›</span>
          </div>
        </div>

        <div className="explorer-tabs" role="tablist" aria-label="Разделы панели проекта">
          <button className={`explorer-tab ${explorerMode === 'project' ? 'is-active' : ''}`} type="button" role="tab" aria-selected={explorerMode === 'project'} onClick={() => setExplorerMode('project')}>
            Текущий проект
          </button>
          <button
            className={`explorer-tab ${explorerMode === 'libraries' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={explorerMode === 'libraries'}
            onClick={() => setExplorerMode('libraries')}
          >
            Библиотеки ТЭБов
          </button>
        </div>
      </div>
    </aside>
  );
}
