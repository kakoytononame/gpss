/** Drag-and-drop contract between the TEB library tree and the structural scheme. */
export const LIBRARY_ITEM_MIME = 'application/x-gpss-teb';

export interface LibraryDropPayload {
  id: string;
  label: string;
  icon?: string;
  iconShape?: string;
  kind: 'entity' | 'block';
}

export function writeLibraryPayload(dataTransfer: DataTransfer, payload: LibraryDropPayload): void {
  dataTransfer.effectAllowed = 'copy';
  dataTransfer.setData(LIBRARY_ITEM_MIME, JSON.stringify(payload));
  dataTransfer.setData('text/plain', payload.label);
}

export function readLibraryPayload(dataTransfer: DataTransfer): LibraryDropPayload | null {
  const rawPayload = dataTransfer.getData(LIBRARY_ITEM_MIME);

  if (!rawPayload) {
    return null;
  }

  try {
    return JSON.parse(rawPayload) as LibraryDropPayload;
  } catch {
    return null;
  }
}
