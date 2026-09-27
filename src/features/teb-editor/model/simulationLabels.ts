import type { SimulationState } from '../../../shared/types/teb';

export const SIMULATION_STATE_LABELS: Record<SimulationState, string> = {
  idle: 'не запущено',
  running: 'выполняется',
  paused: 'приостановлено',
  completed: 'завершено',
  stopped: 'остановлено',
  error: 'ошибка',
};
