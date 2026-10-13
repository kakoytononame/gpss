import type { StateCreator } from 'zustand';
import { readWorkspaceSnapshot, writeWorkspaceSnapshot } from '../../../../shared/lib/storage';
import { DEFAULT_OPEN_DOCUMENTS } from '../../model/documents';
import { createHistory, getApi, safeTabForDocument, snapshotFromState, stateFromWorkspaceSnapshot, syncFailureMessage } from '../helpers';
import type { PersistenceActions, TebEditorStore } from '../types';
import { initialDiagnosticsState } from './diagnosticsSlice';
import { initialLayoutState } from './layoutSlice';
import { initialSchemeState } from './schemeSlice';
import { sampleDocument } from './tebSlice';

export const createPersistenceSlice: StateCreator<TebEditorStore, [], [], PersistenceActions> = (set, get) => ({
  resetWorkspace() {
    const fallback = sampleDocument(get().mode);
    set({
      ...initialLayoutState,
      ...initialSchemeState(),
      ...initialDiagnosticsState(),
      explorerVisible: get().explorerVisible,
      openDocuments: [...DEFAULT_OPEN_DOCUMENTS],
      teb: fallback,
      activeTab: safeTabForDocument('general', fallback.type),
      simulationState: 'idle',
      simulationSessionId: null,
      simulationReport: null,
      syncStatus: 'idle',
      syncMessage: 'Рабочая область сброшена к демонстрационному состоянию.',
      ...createHistory(fallback),
    });
  },

  async saveWorkspaceSnapshot() {
    const state = get();
    const snapshot = snapshotFromState(state);
    writeWorkspaceSnapshot(snapshot);
    set({ syncStatus: 'syncing', syncMessage: 'Снимок рабочей области сохраняется в базе данных...' });

    try {
      await getApi(state).saveWorkspaceSnapshot(snapshot);
      set({ syncStatus: 'saved', syncMessage: 'Снимок рабочей области сохранен в базе данных.' });
    } catch (error) {
      set({ syncStatus: 'offline', syncMessage: syncFailureMessage(error) });
    }
  },

  async loadWorkspaceSnapshot({ quiet = false } = {}) {
    const localSnapshot = readWorkspaceSnapshot();
    const reopenProject = async (projectId?: string | null) => {
      if (projectId && get().project?.Id !== projectId) {
        await get().openProject(projectId, { keepLayout: true });
      }
    };

    if (localSnapshot) {
      set((state) =>
        stateFromWorkspaceSnapshot(localSnapshot, state, 'Рабочая область восстановлена из локального снимка. Проверяется версия в базе данных...'),
      );
    } else if (!quiet) {
      set({ syncStatus: 'syncing', syncMessage: 'Загрузка снимка рабочей области из базы данных...' });
    }

    try {
      const remoteSnapshot = await getApi(get()).getWorkspaceSnapshot();

      if (remoteSnapshot) {
        writeWorkspaceSnapshot(remoteSnapshot);
        set((state) => stateFromWorkspaceSnapshot(remoteSnapshot, state, 'Рабочая область восстановлена из базы данных.'));
        await reopenProject(remoteSnapshot.projectId);
      } else if (localSnapshot) {
        await reopenProject(localSnapshot.projectId);
      } else if (!quiet) {
        set({ syncStatus: 'idle', syncMessage: 'Сохраненный снимок рабочей области не найден.' });
      }
    } catch (error) {
      // With a local copy the workspace is already restored; an unreachable server is not worth an alert.
      if (localSnapshot) {
        await reopenProject(localSnapshot.projectId).catch(() => undefined);
      } else if (!quiet) {
        set({ syncStatus: 'offline', syncMessage: syncFailureMessage(error) });
      }
    }
  },
});
