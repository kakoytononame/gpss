import { useEffect, useMemo, useRef, useState } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import type { ActiveDocument } from '../../../shared/types/teb';
import arrowDownIcon from '../../../shared/assets/icons/gpss-native/arrowdown_16.png';
import closeIcon from '../../../shared/assets/icons/gpss-native/closeblack_13.png';
import csProjectIcon from '../../../shared/assets/icons/gpss-native/csproject_16.png';
import folderIcon from '../../../shared/assets/icons/gpss-native/folder_16.png';
import folderOpenedIcon from '../../../shared/assets/icons/gpss-native/folderopened_16.png';
import formCollectionIcon from '../../../shared/assets/icons/gpss-native/formcollection_16.png';
import formIcon from '../../../shared/assets/icons/gpss-native/form_16.png';
import modelTextIcon from '../../../shared/assets/icons/gpss-native/simmodeltext_16.png';
import pinIcon from '../../../shared/assets/icons/gpss-native/ribbonpin.png';
import projectModelsIcon from '../../../shared/assets/icons/gpss-native/simmodelscollection_16.png';
import schemeIcon from '../../../shared/assets/icons/gpss-native/simmodeldiagram_16.png';
import simModelCurrentIcon from '../../../shared/assets/icons/gpss-native/simmodelcur_16.png';
import simulationIcon from '../../../shared/assets/icons/gpss-native/simmodeltasks_16.png';
import stdJournalIcon from '../../../shared/assets/icons/gpss-native/stdjournal_16.png';
import stdReportIcon from '../../../shared/assets/icons/gpss-native/stdreport_16.png';
import tebsLibraryCollectionIcon from '../../../shared/assets/icons/gpss-native/tebslibrarycollection_16.png';
import tebsLibraryIcon from '../../../shared/assets/icons/gpss-native/tebslibrary_16.png';
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
    iconAsset: tebsLibraryCollectionIcon,
    children: [
      {
        id: 'standard-libraries',
        label: 'Стандартные',
        icon: 'folder',
        iconAsset: folderOpenedIcon,
        children: [
          { id: 'mining-library', label: 'Горнодобывающее пр-во', icon: 'library', iconAsset: tebsLibraryIcon },
          { id: 'standard-tebs', label: 'Стандартные ТЭБы', icon: 'library', iconAsset: tebsLibraryIcon },
        ],
      },
      {
        id: 'current-project-library',
        label: 'Текущий проект',
        icon: 'folder',
        iconAsset: folderOpenedIcon,
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
        iconAsset: folderOpenedIcon,
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'F3') {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        <div className="explorer-auto-tabs" role="tablist" aria-label="Скрытые панели проекта">
          <button
            className={`explorer-auto-tab ${explorerMode === 'project' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={explorerMode === 'project'}
            onFocus={() => setExplorerMode('project')}
            onPointerEnter={() => setExplorerMode('project')}
            onClick={() => setExplorerMode('project')}
          >
            Текущий проект
          </button>
          <button
            className={`explorer-auto-tab ${explorerMode === 'libraries' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={explorerMode === 'libraries'}
            onFocus={() => setExplorerMode('libraries')}
            onPointerEnter={() => setExplorerMode('libraries')}
            onClick={() => setExplorerMode('libraries')}
          >
            Библиотеки ТЭБов
          </button>
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
              <img src={arrowDownIcon} alt="" aria-hidden="true" />
            </button>
            <button
              className={`panel-caption__button panel-caption__button--pin ${autoHide ? 'is-auto-hide' : ''}`}
              type="button"
              title={autoHide ? 'Закрепить панель' : 'Скрывать автоматически'}
              aria-label={autoHide ? 'Закрепить панель' : 'Скрывать автоматически'}
              aria-pressed={autoHide}
              onClick={onToggleAutoHide}
            >
              <img src={pinIcon} alt="" aria-hidden="true" />
            </button>
            <button className="panel-caption__button" type="button" title="Закрыть панель" aria-label="Закрыть панель" onClick={toggleExplorer}>
              <img src={closeIcon} alt="" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="project-search">
          <input
            ref={searchInputRef}
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
