import type { WorkspaceSnapshot } from '../types/teb';

const WORKSPACE_STORAGE_KEY = 'gpss.teb-editor.workspace';

export function writeWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
}

export function readWorkspaceSnapshot(): WorkspaceSnapshot | null {
  const rawValue = localStorage.getItem(WORKSPACE_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as WorkspaceSnapshot;
  } catch {
    return null;
  }
}
