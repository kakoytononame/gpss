import type { StateCreator } from 'zustand';
import { DEFAULT_OPEN_DOCUMENTS, documentLabel, nodeForDocument, nodeToDocument, withDocument } from '../../model/documents';
import type { SyncActions, SyncState, TebEditorStore, WorkspaceLayoutActions, WorkspaceLayoutState } from '../types';

export const initialLayoutState: WorkspaceLayoutState = {
  activeDocument: 'editor',
  openDocuments: DEFAULT_OPEN_DOCUMENTS,
  explorerVisible: true,
  rightPanelVisible: true,
  rightPanelTab: 'properties',
  issuesPanelVisible: true,
  explorerMode: 'project',
  selectedNodeId: 'library',
  collapsedNodeIds: [],
  projectSearchQuery: '',
  projectSearchFocusRequest: 0,
};

export const createLayoutSlice: StateCreator<TebEditorStore, [], [], WorkspaceLayoutState & WorkspaceLayoutActions & SyncState & SyncActions> = (set) => ({
  ...initialLayoutState,
  syncStatus: 'idle',
  syncMessage: 'Ожидание изменений.',

  setStatusMessage(message, status = 'idle') {
    set({ syncMessage: message, syncStatus: status });
  },

  activateDocument(documentId) {
    set((state) => ({
      activeDocument: documentId,
      openDocuments: withDocument(state.openDocuments, documentId),
      selectedNodeId: nodeForDocument(documentId),
      syncMessage: `Открыт документ: ${documentLabel(documentId)}.`,
    }));
  },

  closeDocument(documentId) {
    set((state) => {
      const openDocuments = state.openDocuments.filter((item) => item !== documentId);
      const activeDocument = state.activeDocument === documentId ? (openDocuments.at(-1) ?? null) : state.activeDocument;

      return {
        openDocuments,
        activeDocument,
        selectedNodeId: activeDocument ? nodeForDocument(activeDocument) : state.selectedNodeId,
        syncStatus: 'saved',
        syncMessage: `Окно закрыто: ${documentLabel(documentId)}.`,
      };
    });
  },

  focusProjectNode(nodeId) {
    set({ selectedNodeId: nodeId, syncStatus: 'saved', syncMessage: `Выбран раздел: ${nodeId}.` });
  },

  selectProjectNode(nodeId) {
    set((state) => {
      const nextDocument = nodeToDocument(nodeId);
      return {
        selectedNodeId: nodeId,
        activeDocument: nextDocument,
        openDocuments: withDocument(state.openDocuments, nextDocument),
        syncMessage: `Выбран раздел: ${nodeId}.`,
      };
    });
  },

  toggleExplorer() {
    set((state) => ({
      explorerVisible: !state.explorerVisible,
      syncMessage: state.explorerVisible ? 'Панель проекта скрыта.' : 'Панель проекта открыта.',
    }));
  },

  showExplorer() {
    set({ explorerVisible: true });
  },

  toggleRightPanel() {
    set((state) => ({
      rightPanelVisible: !state.rightPanelVisible,
      syncMessage: state.rightPanelVisible ? 'Правая панель скрыта.' : 'Правая панель открыта.',
    }));
  },

  openRightPanel(tab = 'properties') {
    set({
      rightPanelVisible: true,
      rightPanelTab: tab,
      syncStatus: 'saved',
      syncMessage: tab === 'properties' ? 'Открыта панель свойств.' : 'Открыта панель тестов ТЭБов.',
    });
  },

  setRightPanelTab(tab) {
    set({
      rightPanelTab: tab,
      rightPanelVisible: true,
      syncStatus: 'saved',
      syncMessage: tab === 'properties' ? 'Активна вкладка свойств.' : 'Активна вкладка тестов ТЭБов.',
    });
  },

  toggleIssuesPanel() {
    set((state) => ({
      issuesPanelVisible: !state.issuesPanelVisible,
      syncStatus: 'saved',
      syncMessage: state.issuesPanelVisible ? 'Панель замечаний и ошибок скрыта.' : 'Панель замечаний и ошибок открыта.',
    }));
  },

  openIssuesPanel() {
    set({ issuesPanelVisible: true, syncStatus: 'saved', syncMessage: 'Открыта панель замечаний и ошибок.' });
  },

  setExplorerMode(mode) {
    set({
      explorerMode: mode,
      projectSearchQuery: '',
      syncStatus: 'saved',
      syncMessage: mode === 'libraries' ? 'Открыта панель библиотек ТЭБов.' : 'Открыта панель текущего проекта.',
    });
  },

  toggleTreeNode(nodeId) {
    set((state) => {
      const isCollapsed = state.collapsedNodeIds.includes(nodeId);
      return {
        collapsedNodeIds: isCollapsed ? state.collapsedNodeIds.filter((item) => item !== nodeId) : [...state.collapsedNodeIds, nodeId],
        syncStatus: 'saved',
        syncMessage: isCollapsed ? `Узел развернут: ${nodeId}.` : `Узел свернут: ${nodeId}.`,
      };
    });
  },

  expandTreeNodes(nodeIds) {
    set((state) => ({ collapsedNodeIds: state.collapsedNodeIds.filter((item) => !nodeIds.includes(item)) }));
  },

  setProjectSearchQuery(query) {
    set({ projectSearchQuery: query, syncMessage: query ? `Поиск по проекту: "${query}".` : 'Поиск по проекту очищен.' });
  },

  requestProjectSearchFocus() {
    set((state) => ({ explorerVisible: true, projectSearchFocusRequest: state.projectSearchFocusRequest + 1 }));
  },
});
