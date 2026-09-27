import type { WorkspaceSnapshot } from '../types/teb';
import { clearWorkspaceSnapshot, readWorkspaceSnapshot, writeWorkspaceSnapshot } from './storage';

const snapshot = { activeTab: 'general', modelFontSize: 14 } as WorkspaceSnapshot;

describe('workspace storage', () => {
  it('round-trips a snapshot', () => {
    expect(writeWorkspaceSnapshot(snapshot)).toBe(true);
    expect(readWorkspaceSnapshot()).toEqual(snapshot);
    clearWorkspaceSnapshot();
    expect(readWorkspaceSnapshot()).toBeNull();
  });

  it('survives corrupted data and a full storage quota', () => {
    localStorage.setItem('gpss.teb-editor.workspace', '{not json');
    expect(readWorkspaceSnapshot()).toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(writeWorkspaceSnapshot(snapshot)).toBe(false);
  });
});
