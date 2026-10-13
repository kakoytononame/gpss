import { useMemo, useRef, useState } from 'react';
import runSimIcon from '../../../../shared/assets/icons/run-sim.png';
import saveIcon from '../../../../shared/assets/icons/save.png';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { collectNames } from '../../model/gpssSyntax';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { GpssCodeEditor, type GpssCodeEditorHandle } from './GpssCodeEditor';
import '../BaseDocument/BaseDocument.css';
import './ModelTextDocument.css';

const ERROR_LINE_PATTERN = /^Строка (\d+):/;

/** Full GPSS World model of the project; this is the text that is translated and simulated. */
export function ModelTextDocument() {
  const text = useTebEditorStore((state) => state.modelText);
  const modelFontSize = useTebEditorStore((state) => state.modelFontSize);
  const simulationBusy = useTebEditorStore((state) => state.simulationBusy);
  const issues = useTebEditorStore((state) => state.issues);
  const setModelText = useTebEditorStore((state) => state.setModelText);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const saveWorkspaceSnapshot = useTebEditorStore((state) => state.saveWorkspaceSnapshot);
  const validateModelText = useTebEditorStore((state) => state.validateModelText);
  const startSimulation = useTebEditorStore((state) => state.startSimulation);
  const editorRef = useRef<GpssCodeEditorHandle | null>(null);
  const [namesVisible, setNamesVisible] = useState(false);
  const [nameFilter, setNameFilter] = useState('');

  // Translation errors are reported as "Строка N: ..." issues pointing at this document.
  const errorLines = useMemo(
    () =>
      new Set(
        issues
          .filter((issue) => issue.documentId === 'model-text' && issue.type === 'error')
          .map((issue) => Number(ERROR_LINE_PATTERN.exec(issue.description)?.[1]))
          .filter((line) => line > 0),
      ),
    [issues],
  );
  const names = useMemo(() => (namesVisible ? collectNames(text) : []), [namesVisible, text]);
  const visibleNames = names.filter((entry) => entry.name.toLowerCase().includes(nameFilter.trim().toLowerCase()));
  const firstError = Math.min(...errorLines);

  return (
    <section className="placeholder-document model-text-document">
      <div className="placeholder-document__header">
        <h2>Текст модели</h2>
        <div className="placeholder-document__actions">
          <IconButton icon={saveIcon} label="Сохранить" title="Сохранить текст модели" onClick={() => void saveWorkspaceSnapshot()} />
          <IconButton label="Проверить" title="Оттранслировать модель и показать ошибки" disabled={simulationBusy} onClick={() => void validateModelText()} />
          <IconButton
            label="К ошибке"
            title="Перейти к первой строке с ошибкой"
            disabled={errorLines.size === 0}
            onClick={() => editorRef.current?.revealLine(firstError)}
          />
          <IconButton
            label="Таблица имён"
            title="Показать таблицу имён модели (переход к определению — F12)"
            onClick={() => setNamesVisible((visible) => !visible)}
          />
          <IconButton icon={runSimIcon} label="Запустить" title="Запустить моделирование" disabled={simulationBusy} onClick={() => void startSimulation()} />
        </div>
      </div>
      <div className={namesVisible ? 'model-text-document__body has-names' : 'model-text-document__body'}>
        <GpssCodeEditor
          ref={editorRef}
          value={text}
          fontSize={modelFontSize}
          label="Текст GPSS модели"
          placeholder="; Текст модели GPSS World. Пример загружается с сервера моделирования."
          errorLines={errorLines}
          onChange={setModelText}
          onDefinitionMissing={(name) => setStatusMessage(`Определение «${name}» в тексте модели не найдено.`, 'warning')}
        />
        {namesVisible ? (
          <aside className="names-table" aria-label="Таблица имён">
            <input
              type="search"
              placeholder="Поиск имени"
              aria-label="Поиск имени"
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
            />
            <table>
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Вид</th>
                  <th>Строка</th>
                  <th>Исп.</th>
                </tr>
              </thead>
              <tbody>
                {visibleNames.map((entry) => (
                  <tr key={`${entry.name}-${entry.line}`} onClick={() => editorRef.current?.revealLine(entry.line)}>
                    <td>{entry.name}</td>
                    <td>{entry.kind}</td>
                    <td>{entry.line}</td>
                    <td>{entry.uses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
