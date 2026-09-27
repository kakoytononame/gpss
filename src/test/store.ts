import { useTebEditorStore, type TebEditorStore } from '../features/teb-editor/store/useTebEditorStore';

const initialState = useTebEditorStore.getState();

/** Restores the store to its initial state (all actions included). */
export function resetStore(overrides: Partial<TebEditorStore> = {}) {
  useTebEditorStore.setState({ ...initialState, ...overrides }, true);
}

export const store = () => useTebEditorStore.getState();
