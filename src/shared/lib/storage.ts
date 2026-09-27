import type { WorkspaceSnapshot } from '../types/teb';

const WORKSPACE_STORAGE_KEY = 'gpss.teb-editor.workspace';

/**
 * Persists the snapshot locally. Returns false when storage is unavailable or full
 * (large TEB images are stored as data URLs), so callers can rely on the server copy.
 */
export function writeWorkspaceSnapshot(snapshot: WorkspaceSnapshot): boolean {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function readWorkspaceSnapshot(): WorkspaceSnapshot | null {
  try {
    const rawValue = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return rawValue ? (JSON.parse(rawValue) as WorkspaceSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearWorkspaceSnapshot(): void {
  try {
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // Storage is optional.
  }
}
