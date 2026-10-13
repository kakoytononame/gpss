import { createTebApi, TebApiError } from '../../../shared/api/tebApi';
import { deepClone } from '../../../shared/lib/utils';
import type { TabId, TebDocument, WorkspaceSnapshot } from '../../../shared/types/teb';
import { visibleTabsForType } from '../model/constants';
import { nodeForDocument } from '../model/documents';
import type { TebEditorState, TebEditorStore } from './types';

export type SetState = (partial: Partial<TebEditorStore> | ((state: TebEditorStore) => Partial<TebEditorStore>)) => void;
export type GetState = () => TebEditorStore;

const HISTORY_LIMIT = 80;

export function createHistory(teb: TebDocument | null): Pick<TebEditorState, 'history' | 'historyIndex'> {
  return teb ? { history: [deepClone(teb)], historyIndex: 0 } : { history: [], historyIndex: -1 };
}

/**
 * Stores `nextTeb` as the current document and records it in the undo history
 * (dropping any redo branch). Identical consecutive snapshots are collapsed.
 */
export function historyAwareState(state: TebEditorState, nextTeb: TebDocument): Pick<TebEditorState, 'teb' | 'history' | 'historyIndex'> {
  const nextSnapshot = deepClone(nextTeb);
  const trimmedHistory = state.history.slice(0, state.historyIndex + 1);
  const previous = trimmedHistory.at(-1);

  if (previous && JSON.stringify(previous) === JSON.stringify(nextSnapshot)) {
    return { teb: nextTeb, history: trimmedHistory, historyIndex: state.historyIndex };
  }

  const history = [...trimmedHistory, nextSnapshot].slice(-HISTORY_LIMIT);
  return { teb: nextTeb, history, historyIndex: history.length - 1 };
}

/**
 * Applies `recipe` to a copy of the current TEB document and records the result in history.
 */
export function updateTeb(set: SetState, recipe: (teb: TebDocument) => void, syncMessage: string): void {
  set((state) => {
    if (!state.teb) {
      return {};
    }

    const teb = deepClone(state.teb);
    recipe(teb);
    return { ...historyAwareState(state, teb), syncMessage };
  });
}

/**
 * API client for the document currently being edited. In instance mode, class-level
 * mutations are applied to the class the instance belongs to.
 */
export function getApi(state: TebEditorState) {
  return createTebApi({
    apiBaseUrl: state.apiBaseUrl,
    libraryId: state.libraryId,
    classId: state.mode === 'instance' ? state.instanceClassId : state.classId,
    instanceClassId: state.instanceClassId,
    instanceId: state.instanceId,
    mode: state.mode,
  });
}

export function syncFailureMessage(error: unknown): string {
  if (error instanceof TebApiError && error.status === 404) {
    return 'Объект не найден на сервере. Изменение сохранено локально.';
  }

  if (error instanceof TebApiError) {
    return `Сервер вернул HTTP ${error.status}. Изменение сохранено локально.`;
  }

  return 'Сервер недоступен. Изменение сохранено локально.';
}

let mutationQueue: Promise<unknown> = Promise.resolve();

/**
 * Sends a change to the server. Mutations are queued so the server applies them in the order they
 * were made (e.g. "add row" must finish before "edit that row", otherwise the row does not exist yet).
 */
export function runRemoteMutation(set: SetState, mutation: () => Promise<unknown>, successMessage = 'Изменение отправлено на сервер.'): Promise<void> {
  set({ syncStatus: 'syncing', syncMessage: 'Отправка изменения...' });

  const result = mutationQueue.then(async () => {
    try {
      await mutation();
      set({ syncStatus: 'saved', syncMessage: successMessage });
    } catch (error) {
      set({ syncStatus: 'offline', syncMessage: syncFailureMessage(error) });
    }
  });

  mutationQueue = result;
  return result;
}

export function safeTabForDocument(tabId: TabId, type?: string): TabId {
  const tabs = visibleTabsForType(type);
  return tabs.includes(tabId) ? tabId : tabs[0];
}

export function snapshotFromState(state: TebEditorState): WorkspaceSnapshot {
  return {
    teb: state.teb ? deepClone(state.teb) : null,
    mode: state.mode,
    activeTab: state.activeTab,
    activeDocument: state.activeDocument,
    openDocuments: [...state.openDocuments],
    explorerVisible: state.explorerVisible,
    rightPanelVisible: state.rightPanelVisible,
    rightPanelTab: state.rightPanelTab,
    issuesPanelVisible: state.issuesPanelVisible,
    explorerMode: state.explorerMode,
    collapsedNodeIds: [...state.collapsedNodeIds],
    selectedNodeId: state.selectedNodeId,
    modelFontSize: state.modelFontSize,
    simulationState: state.simulationState,
    schemeNodes: deepClone(state.schemeNodes),
    schemeLinks: deepClone(state.schemeLinks),
    reportCellEdits: { ...state.reportCellEdits },
    modelLogText: state.modelLogText,
    issues: deepClone(state.issues),
    tebTests: deepClone(state.tebTests),
    modelText: state.modelText,
    simulationReport: state.simulationReport,
    projectId: state.project?.Id ?? null,
    breakpointLines: [...state.breakpointLines],
  };
}

/**
 * Restores the workspace layout from a snapshot. When the TEB document was loaded from the
 * API the server copy stays authoritative; the snapshot's document is only used offline.
 */
export function stateFromWorkspaceSnapshot(snapshot: WorkspaceSnapshot, state: TebEditorState, syncMessage: string): Partial<TebEditorState> {
  const useSnapshotDocument = state.source !== 'api' && Boolean(snapshot.teb);
  const teb = useSnapshotDocument ? snapshot.teb : state.teb;
  const mode = useSnapshotDocument ? snapshot.mode : state.mode;

  return {
    teb,
    mode,
    activeTab: safeTabForDocument(snapshot.activeTab ?? state.activeTab, teb?.type),
    // null means "all documents closed"; a missing field keeps the current document.
    activeDocument: snapshot.activeDocument === undefined ? state.activeDocument : snapshot.activeDocument,
    openDocuments: snapshot.openDocuments ?? state.openDocuments,
    explorerVisible: snapshot.explorerVisible ?? state.explorerVisible,
    rightPanelVisible: snapshot.rightPanelVisible ?? state.rightPanelVisible,
    rightPanelTab: snapshot.rightPanelTab ?? state.rightPanelTab,
    issuesPanelVisible: snapshot.issuesPanelVisible ?? state.issuesPanelVisible,
    explorerMode: snapshot.explorerMode ?? state.explorerMode,
    selectedNodeId: snapshot.selectedNodeId ?? (snapshot.activeDocument ? nodeForDocument(snapshot.activeDocument) : state.selectedNodeId),
    collapsedNodeIds: snapshot.collapsedNodeIds ?? state.collapsedNodeIds,
    modelFontSize: snapshot.modelFontSize ?? state.modelFontSize,
    // Sessions live in server memory; a restored workspace starts without one.
    simulationState:
      snapshot.simulationState === 'running' || snapshot.simulationState === 'paused' ? 'idle' : (snapshot.simulationState ?? state.simulationState),
    schemeNodes: snapshot.schemeNodes ? deepClone(snapshot.schemeNodes) : state.schemeNodes,
    schemeLinks: snapshot.schemeLinks ? deepClone(snapshot.schemeLinks) : state.schemeLinks,
    reportCellEdits: snapshot.reportCellEdits ?? state.reportCellEdits,
    modelLogText: snapshot.modelLogText ?? state.modelLogText,
    issues: snapshot.issues ? deepClone(snapshot.issues) : state.issues,
    // Demo tests of older snapshots have no TEB group; real test results always have one.
    tebTests: snapshot.tebTests ? deepClone(snapshot.tebTests.filter((test) => test.group)) : state.tebTests,
    modelText: snapshot.modelText || state.modelText,
    simulationSessionId: snapshot.modelText && snapshot.modelText !== state.modelText ? null : state.simulationSessionId,
    simulationReport: snapshot.simulationReport ?? state.simulationReport,
    breakpointLines: snapshot.breakpointLines ?? state.breakpointLines,
    syncStatus: 'saved',
    syncMessage,
    ...(teb === state.teb ? {} : createHistory(teb)),
  };
}
