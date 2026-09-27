import type { StateCreator } from 'zustand';
import type { IssueItem, SimulationCommand } from '../../../../shared/types/teb';
import { withDocument } from '../../model/documents';
import { appendLogLine, buildInitialModelLog } from '../../model/modelLog';
import type { SimulationSliceActions, SimulationSliceState, TebEditorStore } from '../types';

const COMMAND_NAMES: Record<SimulationCommand, string> = {
  conduct: 'CONDUCT',
  start: 'START',
  step: 'STEP',
  halt: 'HALT',
  continue: 'CONTINUE',
  clear: 'CLEAR',
  reset: 'RESET',
  show: 'SHOW',
  custom: 'CUSTOM',
};

const SIMULATION_RUNNING_ISSUE: IssueItem = {
  id: 'issue-simulation-running',
  type: 'info',
  description: 'Моделирование запущено, журнал и отчет обновлены.',
  library: 'Столовая',
  className: 'Simulation',
  instance: 'Моделирование от 10.08.2018 10:59',
  documentId: 'model-log',
};

export const createSimulationSlice: StateCreator<TebEditorStore, [], [], SimulationSliceState & SimulationSliceActions> = (set, get) => ({
  simulationState: 'idle',

  startSimulation() {
    set((state) => ({
      simulationState: 'running',
      activeDocument: 'scheme',
      openDocuments: withDocument(state.openDocuments, 'scheme'),
      selectedNodeId: 'scheme',
      modelLogText: appendLogLine(state.modelLogText || buildInitialModelLog(state.teb, 'idle'), '[10:59:11] Model Translation Begun.'),
      tebTests: state.tebTests.map((test) =>
        test.id === 'test-gpss-model' ? { ...test, status: 'passed', message: 'Модель успешно подготовлена к запуску' } : test,
      ),
      issues: [...state.issues.filter((issue) => issue.id !== SIMULATION_RUNNING_ISSUE.id), SIMULATION_RUNNING_ISSUE],
      syncStatus: 'saved',
      syncMessage: 'Имитационное моделирование запущено.',
    }));
  },

  stopSimulation() {
    set((state) => ({
      simulationState: 'stopped',
      modelLogText: appendLogLine(state.modelLogText || buildInitialModelLog(state.teb, 'running'), '[10:59:12] Simulation has ended. Clock is 1440.000000.'),
      syncStatus: 'saved',
      syncMessage: 'Имитационное моделирование остановлено.',
    }));
  },

  runSimulationCommand(command) {
    switch (command) {
      case 'start':
      case 'continue':
        get().startSimulation();
        break;
      case 'halt':
        get().stopSimulation();
        break;
      case 'conduct':
      case 'step':
        set((state) => ({ simulationState: 'running', activeDocument: 'scheme', openDocuments: withDocument(state.openDocuments, 'scheme') }));
        break;
      case 'clear':
        set({ modelLogText: '' });
        break;
      case 'reset':
        set({ simulationState: 'idle', schemeSelection: { type: 'node', id: 'kitchen-choice' } });
        break;
      case 'show':
        get().activateDocument('std-report');
        break;
      case 'custom':
        get().activateDocument('model-log');
        break;
    }

    set((state) => {
      // CLEAR empties the journal, so its own record must not bring the demo log back.
      const currentLog = command === 'clear' ? '' : state.modelLogText || buildInitialModelLog(state.teb, state.simulationState);
      return {
        modelLogText: appendLogLine(currentLog, `[10:59:12] Command ${COMMAND_NAMES[command]} executed.`),
        syncStatus: 'saved',
        syncMessage: `Команда ${COMMAND_NAMES[command]} выполнена и записана в журнал.`,
      };
    });
  },
});
