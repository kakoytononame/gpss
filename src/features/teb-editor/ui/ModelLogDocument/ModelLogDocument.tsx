import { useEffect, useRef, useState } from 'react';
import { clamp } from '../../../../shared/lib/utils';
import type { SyncStatus } from '../../../../shared/types/teb';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { subscribeToJournalCommands, type JournalCommand } from '../../model/journalCommands';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { FindReplaceDialog, type SearchDialogMode } from './FindReplaceDialog';
import { JournalCommandLine } from './JournalCommandLine';
import { ERROR_PATTERN, findWrapped, indentLines, lineRange, outdentLines, replaceAllIgnoreCase } from './journalText';
import '../BaseDocument/BaseDocument.css';
import './ModelLogDocument.css';

const HISTORY_LIMIT = 80;
const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 22;

export function ModelLogDocument() {
  const text = useTebEditorStore((state) => state.modelLogText);
  const setModelLogText = useTebEditorStore((state) => state.setModelLogText);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [history, setHistory] = useState(() => [text]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [searchDialogMode, setSearchDialogMode] = useState<SearchDialogMode | null>(null);
  const [searchUp, setSearchUp] = useState(false);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  const notify = (message: string, status: SyncStatus = 'saved') => setStatusMessage(message, status);
  const focusEditor = () => editorRef.current?.focus();

  function selectRange(start: number, end: number) {
    const editor = editorRef.current;
    editor?.focus();
    editor?.setSelectionRange(start, end);
  }

  function selectedText(): string {
    const editor = editorRef.current;
    return editor ? text.slice(editor.selectionStart, editor.selectionEnd) : '';
  }

  /** Records a new journal version in the local undo history. */
  function pushText(nextText: string, message?: string) {
    setModelLogText(nextText, message);
    setHistory((current) => [...current.slice(0, historyIndex + 1), nextText].slice(-HISTORY_LIMIT));
    setHistoryIndex((current) => Math.min(current + 1, HISTORY_LIMIT - 1));
  }

  function replaceSelection(nextValue: string, message: string) {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const start = editor.selectionStart;
    pushText(`${text.slice(0, start)}${nextValue}${text.slice(editor.selectionEnd)}`, message);
    window.setTimeout(() => selectRange(start, start + nextValue.length));
  }

  async function copySelection() {
    const selected = selectedText();
    if (!selected) {
      notify('В журнале нет выделенного текста для копирования.', 'warning');
      focusEditor();
      return;
    }

    await navigator.clipboard?.writeText(selected);
    notify('Фрагмент журнала скопирован.');
    focusEditor();
  }

  async function cutSelection() {
    const selected = selectedText();
    if (!selected) {
      notify('В журнале нет выделенного текста для вырезания.', 'warning');
      focusEditor();
      return;
    }

    await navigator.clipboard?.writeText(selected);
    replaceSelection('', 'Фрагмент журнала вырезан.');
  }

  async function pasteFromClipboard() {
    try {
      const pasted = (await navigator.clipboard?.readText()) ?? '';
      replaceSelection(pasted, 'Текст вставлен в журнал.');
    } catch {
      notify('Браузер запретил доступ к буферу обмена. Используйте Ctrl+V.', 'warning');
    }
  }

  function goToHistory(nextIndex: number, message: string) {
    setHistoryIndex(nextIndex);
    setModelLogText(history[nextIndex], message);
    focusEditor();
  }

  function undoLog() {
    if (historyIndex <= 0) {
      notify('Нет изменений журнала для отмены.', 'warning');
      return;
    }

    goToHistory(historyIndex - 1, 'Изменение журнала отменено.');
  }

  function redoLog() {
    if (historyIndex >= history.length - 1) {
      notify('Нет изменений журнала для возврата.', 'warning');
      return;
    }

    goToHistory(historyIndex + 1, 'Изменение журнала возвращено.');
  }

  function findNext() {
    const editor = editorRef.current;
    if (!editor || !query) {
      setSearchDialogMode((mode) => mode ?? 'find');
      notify('Введите строку поиска по журналу.', 'warning');
      return;
    }

    const from = searchUp ? editor.selectionStart - 1 : editor.selectionEnd;
    const index = findWrapped(text, query, from, searchUp);

    if (index === -1) {
      notify('Совпадений в журнале не найдено.', 'warning');
      return;
    }

    selectRange(index, index + query.length);
    notify('Найдено совпадение в журнале.');
  }

  function replaceCurrent() {
    if (!query) {
      setSearchDialogMode('replace');
      notify('Введите строку для замены в журнале.', 'warning');
      return;
    }

    if (selectedText().toLowerCase() !== query.toLowerCase()) {
      findNext();
      return;
    }

    replaceSelection(replacement, 'Фрагмент журнала заменён.');
  }

  function replaceAll() {
    if (!query) {
      setSearchDialogMode('replace');
      notify('Введите строку для замены в журнале.', 'warning');
      return;
    }

    const result = replaceAllIgnoreCase(text, query, replacement);
    if (!result.count) {
      notify('Совпадений для замены не найдено.', 'warning');
      return;
    }

    pushText(result.text, `Заменено совпадений: ${result.count}.`);
    focusEditor();
  }

  function transformSelectedLines(transform: (lines: string) => string, message: string) {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const { lineStart, lineEnd } = lineRange(text, editor.selectionStart, editor.selectionEnd);
    const nextLines = transform(text.slice(lineStart, lineEnd));
    pushText(`${text.slice(0, lineStart)}${nextLines}${text.slice(lineEnd)}`, message);
    window.setTimeout(() => selectRange(lineStart, lineStart + nextLines.length));
  }

  function goToError() {
    const match = ERROR_PATTERN.exec(text);
    if (!match) {
      notify('Ошибок в журнале не найдено.', 'warning');
      focusEditor();
      return;
    }

    selectRange(match.index, match.index + match[0].length);
    notify('Выполнен переход к ошибке в журнале.');
  }

  function runCommand(command: JournalCommand) {
    switch (command) {
      case 'cut':
        return void cutSelection();
      case 'copy':
        return void copySelection();
      case 'paste':
        return void pasteFromClipboard();
      case 'undo':
        return undoLog();
      case 'redo':
        return redoLog();
      case 'find':
      case 'replace':
        return setSearchDialogMode(command);
      case 'group':
        return transformSelectedLines(indentLines, 'Строки журнала сгруппированы.');
      case 'ungroup':
        return transformSelectedLines(outdentLines, 'Строки журнала разгруппированы.');
      case 'go-error':
        return goToError();
      case 'zoom-in':
        return setFontSize((current) => clamp(current + 1, MIN_FONT_SIZE, MAX_FONT_SIZE));
      case 'zoom-reset':
        return setFontSize(DEFAULT_FONT_SIZE);
      case 'zoom-out':
        return setFontSize((current) => clamp(current - 1, MIN_FONT_SIZE, MAX_FONT_SIZE));
    }
  }

  // Ribbon commands must see the latest text and selection, so the subscription calls through a ref.
  const runCommandRef = useRef(runCommand);
  useEffect(() => {
    runCommandRef.current = runCommand;
  });
  useEffect(() => subscribeToJournalCommands((command) => runCommandRef.current(command)), []);

  return (
    <section className="model-log-document">
      <div className="model-log-document__titlebar">
        <span>Столовая - Журнал моделирования</span>
        <div className="model-log-document__actions">
          <IconButton
            label="Очистить"
            title="Очистить журнал"
            onClick={() => {
              pushText('', 'Журнал моделирования очищен.');
              focusEditor();
            }}
          />
          <IconButton label="К тексту" title="Открыть текст модели" onClick={() => activateDocument('model-text')} />
        </div>
      </div>

      <textarea
        ref={editorRef}
        className="log-editor"
        style={{ fontSize }}
        spellCheck={false}
        value={text}
        onChange={(event) => pushText(event.target.value)}
        onKeyDown={(event) => {
          const key = event.key.toLowerCase();
          if (event.ctrlKey && (key === 'f' || key === 'h')) {
            event.preventDefault();
            setSearchDialogMode(key === 'f' ? 'find' : 'replace');
          }
        }}
        aria-label="Редактор журнала моделирования"
      />

      <JournalCommandLine />

      {searchDialogMode ? (
        <FindReplaceDialog
          mode={searchDialogMode}
          query={query}
          replacement={replacement}
          searchUp={searchUp}
          onModeChange={setSearchDialogMode}
          onQueryChange={setQuery}
          onReplacementChange={setReplacement}
          onSearchUpChange={setSearchUp}
          onFindNext={findNext}
          onReplace={replaceCurrent}
          onReplaceAll={replaceAll}
          onClose={() => setSearchDialogMode(null)}
        />
      ) : null}
    </section>
  );
}
