import type { StateCreator } from 'zustand';
import { deepClone } from '../../../../shared/lib/utils';
import type { SchemeSelection } from '../../../../shared/types/teb';
import { INITIAL_SCHEME_LINKS, INITIAL_SCHEME_NODES } from '../../model/workspaceData';
import type { SchemeSliceActions, SchemeSliceState, TebEditorStore } from '../types';

export const DEFAULT_SCHEME_SELECTION: SchemeSelection = { type: 'node', id: 'kitchen-choice' };

export function initialSchemeState(): SchemeSliceState {
  return {
    schemeNodes: deepClone(INITIAL_SCHEME_NODES),
    schemeLinks: deepClone(INITIAL_SCHEME_LINKS),
    schemeSelection: DEFAULT_SCHEME_SELECTION,
  };
}

export const createSchemeSlice: StateCreator<TebEditorStore, [], [], SchemeSliceState & SchemeSliceActions> = (set) => ({
  ...initialSchemeState(),

  setSchemeNodes(updater, message = 'Структурная схема обновлена.') {
    set((state) => ({
      schemeNodes: typeof updater === 'function' ? updater(state.schemeNodes) : updater,
      syncStatus: 'saved',
      syncMessage: message,
    }));
  },

  setSchemeLinks(updater, message = 'Связи структурной схемы обновлены.') {
    set((state) => ({
      schemeLinks: typeof updater === 'function' ? updater(state.schemeLinks) : updater,
      syncStatus: 'saved',
      syncMessage: message,
    }));
  },

  setSchemeSelection(selection) {
    set({ schemeSelection: selection });
  },

  resetScheme() {
    set({ ...initialSchemeState(), syncStatus: 'saved', syncMessage: 'Структурная схема восстановлена.' });
  },
});
