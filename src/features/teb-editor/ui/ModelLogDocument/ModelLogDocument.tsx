import { useEffect, useMemo, useRef, useState } from 'react';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import appLogoIcon from '../../../../shared/assets/icons/gpss-native/elinalogo_20x22.png';
import closeIcon from '../../../../shared/assets/icons/gpss-native/closeblack_13.png';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import '../BaseDocument/BaseDocument.css';
import './ModelLogDocument.css';

type JournalCommand =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'undo'
  | 'redo'
  | 'find'
  | 'replace'
  | 'group'
  | 'ungroup'
  | 'go-error'
  | 'zoom-in'
  | 'zoom-reset'
  | 'zoom-out';
type SearchDialogMode = 'find' | 'replace';

interface JournalCommandEvent extends CustomEvent {
  detail: {
    command: JournalCommand;
  };
}

function buildInitialLog(teb: ReturnType<typeof useTebEditorStore.getState>['teb'], simulationState: string): string {
  const commands =
    teb?.gpssModel.text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10) ?? [];

  return [
    `[08:59:12] Проект "${teb?.header || teb?.nameInModel || 'Столовая'}" открыт.`,
    `[08:59:14] Загружено параметров: ${teb?.parameters.length ?? 0}.`,
    `[08:59:18] Загружено GPSS-объектов: ${teb?.gpssEntities.length ?? 0}.`,
    `[08:59:21] Состояние моделирования: ${simulationState}.`,
    ...commands.map((command, index) => `[08:59:${String(24 + index).padStart(2, '0')}] GPSS: ${command}`),
    '[08:59:40] Предупреждение: демонстрационный журнал доступен для редактирования.',
  ].join('\n');
}

function lineRange(text: string, start: number, end: number) {
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return { lineStart, lineEnd };
}

export function ModelLogDocument() {
  const teb = useTebEditorStore((state) => state.teb);
  const simulationState = useTebEditorStore((state) => state.simulationState);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const modelLogText = useTebEditorStore((state) => state.modelLogText);
  const setModelLogText = useTebEditorStore((state) => state.setModelLogText);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const initialLog = useMemo(() => buildInitialLog(teb, simulationState), [teb, simulationState]);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const didInitializeLogRef = useRef(false);
  const text = modelLogText;
  const [history, setHistory] = useState([modelLogText || initialLog]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [searchDialogMode, setSearchDialogMode] = useState<SearchDialogMode | null>(null);
  const [searchUp, setSearchUp] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [dialogPosition, setDialogPosition] = useState({ x: Math.max(80, window.innerWidth / 2 - 230), y: 260 });

  useEffect(() => {
    if (!didInitializeLogRef.current && !modelLogText && initialLog) {
      didInitializeLogRef.current = true;
      setModelLogText(initialLog, 'Журнал моделирования загружен.');
      setHistory([initialLog]);
      setHistoryIndex(0);
    }
  }, [initialLog, modelLogText, setModelLogText]);

  function focusEditor() {
    editorRef.current?.focus();
  }

  function pushText(nextText: string, message?: string) {
    setModelLogText(nextText, message);
    setHistory((current) => [...current.slice(0, historyIndex + 1), nextText].slice(-80));
    setHistoryIndex((current) => Math.min(current + 1, 79));
    if (message) {
      setStatusMessage(message, 'saved');
    }
  }

  function replaceSelection(nextValue: string, message: string) {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const nextText = `${text.slice(0, start)}${nextValue}${text.slice(end)}`;
    pushText(nextText, message);
    window.setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start, start + nextValue.length);
    });
  }

  async function copySelection() {
    const editor = editorRef.current;
    const selected = editor ? text.slice(editor.selectionStart, editor.selectionEnd) : '';
    if (!selected) {
      setStatusMessage('В журнале нет выделенного текста для копирования.', 'offline');
      focusEditor();
      return;
    }

    await navigator.clipboard?.writeText(selected);
    setStatusMessage('Фрагмент журнала скопирован.', 'saved');
    focusEditor();
  }

  async function cutSelection() {
    const editor = editorRef.current;
    const selected = editor ? text.slice(editor.selectionStart, editor.selectionEnd) : '';
    if (!editor || !selected) {
      setStatusMessage('В журнале нет выделенного текста для вырезания.', 'offline');
      focusEditor();
      return;
    }

    await navigator.clipboard?.writeText(selected);
    replaceSelection('', 'Фрагмент журнала вырезан.');
  }

  async function pasteFromClipboard() {
    const pasted = (await navigator.clipboard?.readText()) ?? '';
    replaceSelection(pasted, 'Текст вставлен в журнал.');
  }

  function undoLog() {
    if (historyIndex <= 0) {
      setStatusMessage('Нет изменений журнала для отмены.', 'offline');
      return;
    }

    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setModelLogText(history[nextIndex], 'Изменение журнала отменено.');
    setStatusMessage('Изменение журнала отменено.', 'saved');
    focusEditor();
  }

  function redoLog() {
    if (historyIndex >= history.length - 1) {
      setStatusMessage('Нет изменений журнала для возврата.', 'offline');
      return;
    }

    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setModelLogText(history[nextIndex], 'Изменение журнала возвращено.');
    setStatusMessage('Изменение журнала возвращено.', 'saved');
    focusEditor();
  }

  function findNext(value = query) {
    const editor = editorRef.current;
    if (!editor || !value) {
      setSearchDialogMode('find');
      setStatusMessage('Введите строку поиска по журналу.', 'offline');
      return;
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = value.toLowerCase();
    const start = searchUp ? editor.selectionStart - 1 : editor.selectionEnd;
    const index = searchUp ? lowerText.lastIndexOf(lowerQuery, Math.max(0, start)) : lowerText.indexOf(lowerQuery, start);
    const wrappedIndex = index === -1 ? (searchUp ? lowerText.lastIndexOf(lowerQuery) : lowerText.indexOf(lowerQuery, 0)) : index;

    if (wrappedIndex === -1) {
      setStatusMessage('Совпадений в журнале не найдено.', 'offline');
      return;
    }

    editor.focus();
    editor.setSelectionRange(wrappedIndex, wrappedIndex + value.length);
    setStatusMessage('Найдено совпадение в журнале.', 'saved');
  }

  function replaceCurrent() {
    const editor = editorRef.current;
    if (!editor || !query) {
      setSearchDialogMode('replace');
      setStatusMessage('Введите строку для замены в журнале.', 'offline');
      return;
    }

    const selected = text.slice(editor.selectionStart, editor.selectionEnd);
    if (selected.toLowerCase() !== query.toLowerCase()) {
      findNext();
      return;
    }

    replaceSelection(replacement, 'Фрагмент журнала заменён.');
  }

  function replaceAll() {
    if (!query) {
      setSearchDialogMode('replace');
      setStatusMessage('Введите строку для замены в журнале.', 'offline');
      return;
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escapedQuery, 'gi');
    const matches = text.match(expression);

    if (!matches?.length) {
      setStatusMessage('Совпадений для замены не найдено.', 'offline');
      return;
    }

    pushText(text.replace(expression, replacement), `Заменено совпадений: ${matches.length}.`);
    focusEditor();
  }

  function groupSelectedLines(prefix: string, message: string) {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const { lineStart, lineEnd } = lineRange(text, editor.selectionStart, editor.selectionEnd);
    const selectedLines = text.slice(lineStart, lineEnd);
    const nextLines = selectedLines
      .split('\n')
      .map((line) => (prefix ? `${prefix}${line}` : line.replace(/^\s{2}/, '')))
      .join('\n');
    const nextText = `${text.slice(0, lineStart)}${nextLines}${text.slice(lineEnd)}`;
    pushText(nextText, message);
    window.setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(lineStart, lineStart + nextLines.length);
    });
  }

  function goToError() {
    const match = /(ошибка|error|failed|exception)/i.exec(text);
    if (!match || match.index === undefined) {
      setStatusMessage('Ошибок в журнале не найдено.', 'offline');
      focusEditor();
      return;
    }

    editorRef.current?.focus();
    editorRef.current?.setSelectionRange(match.index, match.index + match[0].length);
    setStatusMessage('Выполнен переход к ошибке в журнале.', 'saved');
  }

  function handleDialogDragStart(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }

    const dialog = event.currentTarget.closest<HTMLElement>('.find-replace-dialog');
    if (!dialog) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const dialogRect = dialog.getBoundingClientRect();
    const offsetX = event.clientX - dialogRect.left;
    const offsetY = event.clientY - dialogRect.top;

    function handleMove(moveEvent: PointerEvent) {
      const maxX = Math.max(8, window.innerWidth - dialogRect.width - 8);
      const maxY = Math.max(8, window.innerHeight - dialogRect.height - 8);
      const nextX = Math.min(Math.max(8, moveEvent.clientX - offsetX), maxX);
      const nextY = Math.min(Math.max(8, moveEvent.clientY - offsetY), maxY);
      setDialogPosition({ x: nextX, y: nextY });
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  useEffect(() => {
    async function handleJournalCommand(event: Event) {
      const command = (event as JournalCommandEvent).detail.command;

      if (command === 'cut') await cutSelection();
      if (command === 'copy') await copySelection();
      if (command === 'paste') await pasteFromClipboard();
      if (command === 'undo') undoLog();
      if (command === 'redo') redoLog();
      if (command === 'find') {
        setSearchDialogMode('find');
        window.setTimeout(() => document.querySelector<HTMLInputElement>('.find-replace-dialog__field')?.focus());
      }
      if (command === 'replace') {
        setSearchDialogMode('replace');
        window.setTimeout(() => document.querySelector<HTMLInputElement>('.find-replace-dialog__field')?.focus());
      }
      if (command === 'group') groupSelectedLines('  ', 'Строки журнала сгруппированы.');
      if (command === 'ungroup') groupSelectedLines('', 'Строки журнала разгруппированы.');
      if (command === 'go-error') goToError();
      if (command === 'zoom-in') setFontSize((current) => Math.min(current + 1, 22));
      if (command === 'zoom-reset') setFontSize(14);
      if (command === 'zoom-out') setFontSize((current) => Math.max(current - 1, 10));
    }

    window.addEventListener('gpss:journal-command', handleJournalCommand);
    return () => window.removeEventListener('gpss:journal-command', handleJournalCommand);
  });

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
          if (event.ctrlKey && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            setSearchDialogMode('find');
          }

          if (event.ctrlKey && event.key.toLowerCase() === 'h') {
            event.preventDefault();
            setSearchDialogMode('replace');
          }
        }}
        aria-label="Редактор журнала моделирования"
      />

      {searchDialogMode ? (
        <div className="find-replace-dialog" role="dialog" aria-modal="false" aria-label="Поиск и замена" style={{ left: dialogPosition.x, top: dialogPosition.y }}>
          <div className="find-replace-dialog__titlebar" onPointerDown={handleDialogDragStart}>
            <img src={appLogoIcon} alt="" aria-hidden="true" />
            <span>Поиск и замена</span>
            <button type="button" aria-label="Закрыть" title="Закрыть" onClick={() => setSearchDialogMode(null)}>
              <img src={closeIcon} alt="" aria-hidden="true" />
            </button>
          </div>

          <div className="find-replace-dialog__tabs" role="tablist" aria-label="Режим поиска">
            <button className={searchDialogMode === 'find' ? 'is-active' : ''} type="button" role="tab" aria-selected={searchDialogMode === 'find'} onClick={() => setSearchDialogMode('find')}>
              Поиск
            </button>
            <button className={searchDialogMode === 'replace' ? 'is-active' : ''} type="button" role="tab" aria-selected={searchDialogMode === 'replace'} onClick={() => setSearchDialogMode('replace')}>
              Замена
            </button>
          </div>

          <div className="find-replace-dialog__body">
            <label>
              <span>Найти:</span>
              <input className="find-replace-dialog__field" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && findNext()} />
            </label>

            {searchDialogMode === 'replace' ? (
              <label>
                <span>Заменить на:</span>
                <input value={replacement} onChange={(event) => setReplacement(event.target.value)} />
              </label>
            ) : null}

            <div className="find-replace-dialog__options">
              <span>Опции:</span>
              <label>
                <input type="checkbox" checked={searchUp} onChange={(event) => setSearchUp(event.target.checked)} />
                <span>Искать вверх</span>
              </label>
            </div>

            <div className="find-replace-dialog__actions">
              <button type="button" onClick={() => findNext()}>
                Искать далее
              </button>
              {searchDialogMode === 'replace' ? (
                <>
                  <button type="button" onClick={replaceCurrent}>
                    Заменить
                  </button>
                  <button type="button" onClick={replaceAll}>
                    Заменить все
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
