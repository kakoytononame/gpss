import type { SimulationState, TebDocument } from '../../../shared/types/teb';

const MAX_MODEL_LINES_IN_LOG = 10;

/**
 * Demo journal shown until GPSS World Core produces a real one.
 */
export function buildInitialModelLog(teb: TebDocument | null, simulationState: SimulationState): string {
  const commands =
    teb?.gpssModel.text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, MAX_MODEL_LINES_IN_LOG) ?? [];

  return [
    `[08:59:12] Проект "${teb?.header || teb?.nameInModel || 'Столовая'}" открыт.`,
    `[08:59:14] Загружено параметров: ${teb?.parameters.length ?? 0}.`,
    `[08:59:18] Загружено GPSS-объектов: ${teb?.gpssEntities.length ?? 0}.`,
    `[08:59:21] Состояние моделирования: ${simulationState}.`,
    ...commands.map((command, index) => `[08:59:${String(24 + index).padStart(2, '0')}] GPSS: ${command}`),
  ].join('\n');
}

export function appendLogLine(text: string, line: string): string {
  return text ? `${text}\n${line}` : line;
}
