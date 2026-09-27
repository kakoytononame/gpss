/**
 * Commands issued by the "Журнал моделирования" ribbon tab and executed by the
 * journal editor, which owns the textarea selection and clipboard access.
 */
export type JournalCommand =
  'cut' | 'copy' | 'paste' | 'undo' | 'redo' | 'find' | 'replace' | 'group' | 'ungroup' | 'go-error' | 'zoom-in' | 'zoom-reset' | 'zoom-out';

const JOURNAL_COMMAND_EVENT = 'gpss:journal-command';

export function dispatchJournalCommand(command: JournalCommand): void {
  window.dispatchEvent(new CustomEvent<JournalCommand>(JOURNAL_COMMAND_EVENT, { detail: command }));
}

export function subscribeToJournalCommands(handler: (command: JournalCommand) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<JournalCommand>).detail);
  window.addEventListener(JOURNAL_COMMAND_EVENT, listener);
  return () => window.removeEventListener(JOURNAL_COMMAND_EVENT, listener);
}
