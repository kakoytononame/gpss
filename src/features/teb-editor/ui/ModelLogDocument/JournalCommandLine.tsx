import { useEffect, useRef, useState } from 'react';
import { useTebEditorStore } from '../../store/useTebEditorStore';

const HISTORY_LIMIT = 50;

/** GPSS command window: START, STEP, HALT, CONTINUE, RESET, CLEAR, SHOW, INITIAL... */
export function JournalCommandLine() {
  const executeSimulationCommand = useTebEditorStore((state) => state.executeSimulationCommand);
  const simulationBusy = useTebEditorStore((state) => state.simulationBusy);
  const focusRequest = useTebEditorStore((state) => state.commandLineFocusRequest);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (focusRequest > 0) {
      inputRef.current?.focus();
    }
  }, [focusRequest]);

  function submit() {
    const text = command.trim();
    if (!text || simulationBusy) {
      return;
    }

    setHistory((current) => [text, ...current.filter((item) => item !== text)].slice(0, HISTORY_LIMIT));
    setHistoryIndex(-1);
    setCommand('');
    void executeSimulationCommand(text);
  }

  function browseHistory(step: number) {
    const nextIndex = Math.min(history.length - 1, Math.max(-1, historyIndex + step));
    setHistoryIndex(nextIndex);
    setCommand(nextIndex < 0 ? '' : history[nextIndex]);
  }

  return (
    <form
      className="journal-command-line"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor="journal-command">Команда GPSS:</label>
      <input
        id="journal-command"
        ref={inputRef}
        value={command}
        list="journal-command-suggestions"
        placeholder="START 1, STEP 1, CONTINUE, SHOW Q$BUF1, RESET, CLEAR..."
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setCommand(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            browseHistory(1);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            browseHistory(-1);
          }
        }}
      />
      <datalist id="journal-command-suggestions">
        {['START 1', 'STEP 1', 'STEP 10', 'HALT', 'CONTINUE', 'RESET', 'CLEAR', 'SHOW AC1', 'SHOW TG1'].map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <button type="submit" disabled={simulationBusy || !command.trim()}>
        Выполнить
      </button>
    </form>
  );
}
