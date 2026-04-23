import { IconButton } from '../../../shared/ui/IconButton';
import { useTebEditorStore } from '../store/useTebEditorStore';

export function ModelLogDocument() {
  const teb = useTebEditorStore((state) => state.teb);
  const simulationState = useTebEditorStore((state) => state.simulationState);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);

  const commands = teb?.gpssModel.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10) ?? [];

  const logEntries = [
    `[08:59:12] Проект "${teb?.header || teb?.nameInModel || 'Столовая'}" открыт.`,
    `[08:59:14] Загружено параметров: ${teb?.parameters.length ?? 0}.`,
    `[08:59:18] Загружено GPSS-объектов: ${teb?.gpssEntities.length ?? 0}.`,
    `[08:59:21] Состояние моделирования: ${simulationState}.`,
    ...commands.map((command, index) => `[08:59:${String(24 + index).padStart(2, '0')}] GPSS: ${command}`),
  ];

  return (
    <section className="placeholder-document">
      <div className="placeholder-document__header">
        <h2>Журнал моделирования</h2>
        <div className="placeholder-document__actions">
          <IconButton label="Очистить" title="Очистить журнал" onClick={() => setStatusMessage('Журнал моделирования очищен локально.', 'saved')} />
          <IconButton label="К тексту" title="Открыть текст модели" onClick={() => activateDocument('model-text')} />
        </div>
      </div>

      <div className="log-document">
        {logEntries.map((entry) => (
          <div className="log-document__line" key={entry}>
            {entry}
          </div>
        ))}
      </div>
    </section>
  );
}
