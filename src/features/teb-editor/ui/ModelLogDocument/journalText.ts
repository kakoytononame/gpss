/** Pure text helpers for the journal editor. */

export function lineRange(text: string, start: number, end: number) {
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return { lineStart, lineEnd };
}

export const INDENT = '  ';

export function indentLines(lines: string): string {
  return lines
    .split('\n')
    .map((line) => `${INDENT}${line}`)
    .join('\n');
}

export function outdentLines(lines: string): string {
  return lines
    .split('\n')
    .map((line) => line.replace(/^\s{2}/, ''))
    .join('\n');
}

/**
 * Case-insensitive search from `from`, wrapping around the text. Returns -1 when absent.
 */
export function findWrapped(text: string, query: string, from: number, backwards: boolean): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = backwards ? lowerText.lastIndexOf(lowerQuery, Math.max(0, from)) : lowerText.indexOf(lowerQuery, from);

  if (index !== -1) {
    return index;
  }

  return backwards ? lowerText.lastIndexOf(lowerQuery) : lowerText.indexOf(lowerQuery);
}

export function replaceAllIgnoreCase(text: string, query: string, replacement: string): { text: string; count: number } {
  const expression = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const count = text.match(expression)?.length ?? 0;
  return { text: count ? text.replace(expression, () => replacement) : text, count };
}

export const ERROR_PATTERN = /(ошибка|error|failed|exception)/i;
