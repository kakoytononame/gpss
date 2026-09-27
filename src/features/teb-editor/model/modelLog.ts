import type { TebDocument } from '../../../shared/types/teb';

/** "[HH:MM:SS] message" — the journal line format of GPSS Studio. */
export function journalLine(message: string, date: Date = new Date()): string {
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
  return `[${time}] ${message}`;
}

/** First journal entry after a project is opened. */
export function buildInitialModelLog(teb: TebDocument | null, date: Date = new Date()): string {
  return journalLine(`Проект "${teb?.header || teb?.nameInModel || 'Столовая'}" открыт.`, date);
}

export function appendLogLine(text: string, line: string): string {
  return text ? `${text}\n${line}` : line;
}

export function appendLogLines(text: string, lines: string[]): string {
  return lines.reduce(appendLogLine, text);
}
