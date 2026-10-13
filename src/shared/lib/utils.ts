import type { Direction } from '../types/teb';

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Swaps an item with its neighbour. Returns a copy; out-of-range moves are no-ops.
 */
export function reorderItems<T>(items: readonly T[], index: number, direction: Direction): T[] {
  const next = [...items];
  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (index < 0 || index >= next.length || targetIndex < 0 || targetIndex >= next.length) {
    return next;
  }

  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

/**
 * Index an item ends up at after {@link reorderItems}.
 */
export function movedIndex(index: number, direction: Direction, length: number): number {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  return targetIndex < 0 || targetIndex >= length ? index : targetIndex;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * RFC 4122 v4 identifier. `crypto.randomUUID` only exists in secure contexts,
 * so opening the app by LAN IP over plain HTTP needs the fallback.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Saves text as a file through a temporary download link. */
export function downloadTextFile(fileName: string, content: string, mimeType = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
