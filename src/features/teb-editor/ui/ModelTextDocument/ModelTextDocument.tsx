import runSimIcon from '../../../../shared/assets/icons/run-sim.png';
import saveIcon from '../../../../shared/assets/icons/save.png';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import '../BaseDocument/BaseDocument.css';
import './ModelTextDocument.css';

/** Full GPSS World model of the project; this is the text that is translated and simulated. */
export function ModelTextDocument() {
  const text = useTebEditorStore((state) => state.modelText);
  const modelFontSize = useTebEditorStore((state) => state.modelFontSize);
  const simulationBusy = useTebEditorStore((state) => state.simulationBusy);
  const setModelText = useTebEditorStore((state) => state.setModelText);
  const saveWorkspaceSnapshot = useTebEditorStore((state) => state.saveWorkspaceSnapshot);
  const validateModelText = useTebEditorStore((state) => state.validateModelText);
  const startSimulation = useTebEditorStore((state) => state.startSimulation);

  return (
    <section className="placeholder-document">
      <div className="placeholder-document__header">
        <h2>Текст модели</h2>
        <div className="placeholder-document__actions">
          <IconButton icon={saveIcon} label="Сохранить" title="Сохранить текст модели" onClick={() => void saveWorkspaceSnapshot()} />
          <IconButton label="Проверить" title="Оттранслировать модель и показать ошибки" disabled={simulationBusy} onClick={() => void validateModelText()} />
          <IconButton icon={runSimIcon} label="Запустить" title="Запустить моделирование" disabled={simulationBusy} onClick={() => void startSimulation()} />
        </div>
      </div>
      <textarea
        className="gpss-textarea gpss-textarea--document"
        aria-label="Текст GPSS модели"
        spellCheck={false}
        style={{ fontSize: `${modelFontSize}px` }}
        value={text}
        placeholder="; Текст модели GPSS World. Пример загружается с сервера моделирования."
        onChange={(event) => setModelText(event.target.value)}
      />
    </section>
  );
}
