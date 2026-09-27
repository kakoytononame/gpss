import { useEffect, useMemo, useRef } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import arrowDownIcon from '../../../shared/assets/icons/gpss-native/arrowdown_16.png';
import closeIcon from '../../../shared/assets/icons/gpss-native/closeblack_13.png';
import pinIcon from '../../../shared/assets/icons/gpss-native/ribbonpin.png';
import type { ExplorerMode } from '../../../shared/types/teb';
import { filterTree, LIBRARIES_TREE, PROJECT_TREE, type TreeNode } from './explorerTrees';
import { TreeBranch } from './TreeBranch';
import './ProjectExplorer.css';

interface ProjectExplorerProps {
  autoHide: boolean;
  onToggleAutoHide: () => void;
}

const EXPLORER_VIEWS: Record<ExplorerMode, { title: string; searchPlaceholder: string; tree: TreeNode[] }> = {
  project: { title: 'Текущий проект', searchPlaceholder: 'Поиск в проекте (F3)', tree: PROJECT_TREE },
  libraries: { title: 'Библиотеки ТЭБов', searchPlaceholder: 'Поиск по библиотекам ТЭБов (F3)', tree: LIBRARIES_TREE },
};

const EXPLORER_MODES: Array<{ mode: ExplorerMode; label: string }> = [
  { mode: 'project', label: 'Текущий проект' },
  { mode: 'libraries', label: 'Библиотеки ТЭБов' },
];

/** Path to the project TEB library inside {@link LIBRARIES_TREE}. */
const PROJECT_LIBRARY_PATH = ['teb-libraries-root', 'current-project-library', 'project-tebs-library'];

export function ProjectExplorer({ autoHide, onToggleAutoHide }: ProjectExplorerProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedNodeId = useTebEditorStore((state) => state.selectedNodeId);
  const collapsedNodeIds = useTebEditorStore((state) => state.collapsedNodeIds);
  const projectSearchQuery = useTebEditorStore((state) => state.projectSearchQuery);
  const projectSearchFocusRequest = useTebEditorStore((state) => state.projectSearchFocusRequest);
  const explorerMode = useTebEditorStore((state) => state.explorerMode);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const focusProjectNode = useTebEditorStore((state) => state.focusProjectNode);
  const toggleExplorer = useTebEditorStore((state) => state.toggleExplorer);
  const toggleTreeNode = useTebEditorStore((state) => state.toggleTreeNode);
  const expandTreeNodes = useTebEditorStore((state) => state.expandTreeNodes);
  const setProjectSearchQuery = useTebEditorStore((state) => state.setProjectSearchQuery);
  const setExplorerMode = useTebEditorStore((state) => state.setExplorerMode);

  const view = EXPLORER_VIEWS[explorerMode];
  const filteredTree = useMemo(() => filterTree(view.tree, projectSearchQuery), [view.tree, projectSearchQuery]);
  const forceExpanded = projectSearchQuery.trim().length > 0;

  function focusSearch() {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'F3') {
        event.preventDefault();
        focusSearch();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (projectSearchFocusRequest > 0) {
      focusSearch();
    }
  }, [projectSearchFocusRequest]);

  function handleOpenNode(node: TreeNode) {
    if (node.id === 'library') {
      setExplorerMode('libraries');
      focusProjectNode('project-tebs-library');
      expandTreeNodes(PROJECT_LIBRARY_PATH);
      return;
    }

    if (node.documentId) {
      activateDocument(node.documentId);
    }
  }

  function renderModeTabs(className: string, extraProps: (mode: ExplorerMode) => object = () => ({})) {
    return EXPLORER_MODES.map(({ mode, label }) => (
      <button
        className={`${className} ${explorerMode === mode ? 'is-active' : ''}`}
        key={mode}
        type="button"
        role="tab"
        aria-selected={explorerMode === mode}
        onClick={() => setExplorerMode(mode)}
        {...extraProps(mode)}
      >
        {label}
      </button>
    ));
  }

  return (
    <aside className={`project-explorer ${autoHide ? 'project-explorer--auto-hide' : ''}`}>
      {autoHide ? (
        <div className="explorer-auto-tabs" role="tablist" aria-label="Скрытые панели проекта">
          {renderModeTabs('explorer-auto-tab', (mode) => ({ onFocus: () => setExplorerMode(mode), onPointerEnter: () => setExplorerMode(mode) }))}
        </div>
      ) : null}

      <div className="project-explorer__panel">
        <div className="panel-caption">
          <span className="panel-caption__title">{view.title}</span>
          <div className="panel-caption__tools">
            <span className="panel-caption__grip" aria-hidden="true">
              ................................
            </span>
            <button
              className="panel-caption__button"
              type="button"
              title="Сбросить поиск"
              aria-label="Сбросить поиск"
              onClick={() => setProjectSearchQuery('')}
            >
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
            placeholder={view.searchPlaceholder}
            aria-label={view.searchPlaceholder}
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
          {renderModeTabs('explorer-tab')}
        </div>
      </div>
    </aside>
  );
}
