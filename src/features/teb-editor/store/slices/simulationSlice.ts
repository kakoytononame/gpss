import type { StateCreator } from 'zustand';
import { createSimulationApi } from '../../../../shared/api/simulationApi';
import { TebApiError } from '../../../../shared/api/tebApi';
import type { SimulationResult } from '../../../../shared/types/simulation';
import type { IssueItem, SimulationCommand, SimulationState } from '../../../../shared/types/teb';
import { withDocument } from '../../model/documents';
import { appendLogLines, journalLine } from '../../model/modelLog';
import { syncFailureMessage } from '../helpers';
import type { SimulationSliceActions, SimulationSliceState, TebEditorStore } from '../types';

const MODEL_NAME = 'Столовая';
const DEFAULT_EXAMPLE_ID = 'canteen';
const SIMULATION_ISSUE_PREFIX = 'sim-';
const DEMO_NO_ERRORS_ISSUE_ID = 'issue-no-errors';

/** Ribbon commands and the GPSS statements they send. */
const COMMAND_TEXT: Partial<Record<SimulationCommand, string>> = {
  start: 'START 1',
  step: 'STEP 1',
  halt: 'HALT',
  continue: 'CONTINUE',
  clear: 'CLEAR',
  reset: 'RESET',
};

const RUN_STATE: Record<SimulationResult['State'], SimulationState> = {
  idle: 'idle',
  paused: 'paused',
  completed: 'completed',
  error: 'error',
};

function simulationIssues(result: SimulationResult): IssueItem[] {
  const translationIssues = result.Errors.map<IssueItem>((error, index) => ({
    id: `${SIMULATION_ISSUE_PREFIX}translation-${index}`,
    type: 'error',
    description: error.Line > 0 ? `Строка ${error.Line}: ${error.Message}` : error.Message,
    library: MODEL_NAME,
    className: 'Текст модели',
    instance: error.Line > 0 ? `Строка ${error.Line}` : 'Модель',
    documentId: 'model-text',
  }));

  if (result.RuntimeError && result.Errors.length === 0) {
    translationIssues.push({
      id: `${SIMULATION_ISSUE_PREFIX}runtime`,
      type: 'error',
      description: result.RuntimeError,
      library: MODEL_NAME,
      className: 'Моделирование',
      instance: `Время ${result.Clock.toFixed(3)}`,
      documentId: 'model-log',
    });
  }

  if (result.Success && result.State === 'completed') {
    translationIssues.push({
      id: `${SIMULATION_ISSUE_PREFIX}completed`,
      type: 'info',
      description: `Моделирование завершено. Модельное время ${result.Clock.toFixed(3)}.`,
      library: MODEL_NAME,
      className: 'Моделирование',
      instance: 'Стандартный отчёт',
      documentId: 'std-report',
    });
  }

  return translationIssues;
}

export const createSimulationSlice: StateCreator<TebEditorStore, [], [], SimulationSliceState & SimulationSliceActions> = (set, get) => {
  const api = () => createSimulationApi(get().apiBaseUrl);

  /** Applies a server response: journal, state, report, issues and TEB test status. */
  const applyResult = (result: SimulationResult, successMessage: string) => {
    set((state) => {
      const failed = !result.Success;
      const reportChanged = result.Report !== null && result.Report.EndTime !== state.simulationReport?.EndTime;

      return {
        simulationBusy: false,
        simulationSessionId: result.SessionId ?? state.simulationSessionId,
        simulationState: RUN_STATE[result.State],
        simulationReport: result.Report ?? state.simulationReport,
        modelState: result.BlockLines
          ? {
              clock: result.Clock,
              terminationCount: result.TerminationCount,
              transactions: result.Transactions ?? [],
              blockLines: result.BlockLines,
              stopReason: result.StopReason ?? null,
            }
          : state.modelState,
        reportCellEdits: reportChanged ? {} : state.reportCellEdits,
        modelLogText: appendLogLines(
          state.modelLogText,
          result.Journal.map((line) => journalLine(line)),
        ),
        // Real simulation results replace the demo "no errors" notice; errors are listed first.
        issues: [
          ...simulationIssues(result),
          ...state.issues.filter((issue) => !issue.id.startsWith(SIMULATION_ISSUE_PREFIX) && issue.id !== DEMO_NO_ERRORS_ISSUE_ID),
        ],
        tebTests: state.tebTests.map((test) =>
          test.id === 'test-gpss-model'
            ? { ...test, status: failed ? 'failed' : 'passed', message: failed ? 'Модель содержит ошибки' : 'Модель успешно оттранслирована и выполнена' }
            : test,
        ),
        syncStatus: failed ? 'warning' : 'saved',
        syncMessage: failed
          ? (result.RuntimeError ?? `Ошибки трансляции: ${result.Errors.length}. См. панель замечаний.`)
          : (result.StopReason ?? successMessage),
      };
    });
  };

  const failRequest = (error: unknown) => {
    set((state) => ({
      simulationBusy: false,
      simulationState: 'error',
      syncStatus: 'offline',
      syncMessage: error instanceof TebApiError ? `Симулятор: ${error.message}` : `Сервер моделирования недоступен. ${syncFailureMessage(error)}`,
      modelLogText: appendLogLines(state.modelLogText, [journalLine('Сервер моделирования недоступен.')]),
    }));
  };

  const createSession = async () => {
    const { project, projectModelIndex, modelText, breakpointLines } = get();
    const modelName = project?.Models[projectModelIndex]?.Name ?? MODEL_NAME;
    const result = await api().createSession(modelText, modelName, breakpointLines);
    applyResult(result, result.State === 'completed' ? 'Моделирование завершено.' : 'Модель оттранслирована.');
    return result;
  };

  /** Runs a command in the current session, re-creating it if the server forgot it (restart / expiry). */
  const execute = async (commandText: string) => {
    let sessionId = get().simulationSessionId;
    if (!sessionId) {
      const created = await createSession();
      if (!created.SessionId) {
        return;
      }

      sessionId = created.SessionId;
    }

    try {
      applyResult(await api().execute(sessionId, commandText), `Команда ${commandText} выполнена.`);
    } catch (error) {
      if (error instanceof TebApiError && error.status === 404) {
        set({ simulationSessionId: null });
        const created = await createSession();
        if (created.SessionId) {
          applyResult(await api().execute(created.SessionId, commandText), `Команда ${commandText} выполнена.`);
        }

        return;
      }

      throw error;
    }
  };

  /** Opens a document / panel without replacing the simulation status message. */
  const navigateKeepingStatus = (navigate: () => void) => {
    const { syncStatus, syncMessage } = get();
    navigate();
    set({ syncStatus, syncMessage });
  };

  const withBusy = async (action: () => Promise<void>) => {
    if (get().simulationBusy) {
      return;
    }

    if (!get().modelText.trim()) {
      set({ syncStatus: 'warning', syncMessage: 'Текст модели пуст. Откройте документ "Текст модели" и введите GPSS-модель.' });
      get().activateDocument('model-text');
      return;
    }

    set({ simulationBusy: true, simulationState: 'running', syncStatus: 'syncing', syncMessage: 'Выполняется моделирование...' });
    try {
      await action();
    } catch (error) {
      failRequest(error);
    } finally {
      set({ simulationBusy: false });
    }
  };

  return {
    simulationState: 'idle',
    modelText: '',
    simulationSessionId: null,
    simulationReport: null,
    simulationBusy: false,
    commandLineFocusRequest: 0,
    breakpointLines: [],
    modelState: null,

    async loadExampleModel() {
      if (get().modelText.trim()) {
        return;
      }

      try {
        const example = await api().getExample(DEFAULT_EXAMPLE_ID);
        if (!get().modelText.trim()) {
          set({ modelText: example.Text });
        }
      } catch {
        // Offline: the model text stays empty until the server is reachable.
      }
    },

    setModelText(text) {
      // A changed model invalidates the translated session.
      set({ modelText: text, simulationSessionId: null, modelState: null, syncMessage: 'Текст модели изменен.' });
    },

    async validateModelText() {
      await withBusy(async () => {
        const result = await api().translate(get().modelText);
        applyResult({ ...result, State: result.Success ? 'idle' : 'error' }, 'Трансляция модели выполнена без ошибок.');
        if (!result.Success) {
          navigateKeepingStatus(() => get().openIssuesPanel());
        }
      });
    },

    async startSimulation() {
      await withBusy(async () => {
        set((state) => ({ simulationSessionId: null, openDocuments: withDocument(state.openDocuments, 'model-log') }));
        const created = await createSession();

        if (created.SessionId && created.State === 'idle') {
          // The model has no START statement: run it for one termination.
          await execute('START 1');
        }

        const { simulationState } = get();
        if (simulationState === 'completed') {
          navigateKeepingStatus(() => get().activateDocument('std-report'));
        } else if (!created.Success) {
          navigateKeepingStatus(() => {
            get().activateDocument(created.Errors.length ? 'model-text' : 'model-log');
            get().openIssuesPanel();
          });
        }
      });
    },

    async stopSimulation() {
      if (!get().simulationSessionId) {
        set({ simulationState: 'stopped', syncStatus: 'saved', syncMessage: 'Моделирование не выполняется.' });
        return;
      }

      await withBusy(() => execute('HALT'));
      set({ simulationState: 'stopped' });
    },

    async runSimulationCommand(command) {
      switch (command) {
        case 'conduct':
          await withBusy(async () => {
            set({ simulationSessionId: null });
            await createSession();
          });
          return;
        case 'show':
        case 'custom':
          get().activateDocument('model-log');
          get().requestCommandLineFocus();
          return;
        default:
          await get().executeSimulationCommand(COMMAND_TEXT[command] ?? command.toUpperCase());
          if (command === 'step') {
            get().activateDocument('model-state');
          }
      }
    },

    async executeSimulationCommand(commandText) {
      const text = commandText.trim();
      if (!text) {
        return;
      }

      set((state) => ({ modelLogText: appendLogLines(state.modelLogText, [journalLine(`> ${text}`)]) }));
      await withBusy(() => execute(text));
    },

    requestCommandLineFocus() {
      set((state) => ({ commandLineFocusRequest: state.commandLineFocusRequest + 1 }));
    },

    async toggleBreakpoint(line) {
      const { breakpointLines, modelState, simulationSessionId } = get();
      const block = modelState ? modelState.blockLines.indexOf(line) + 1 : 0;
      if (modelState && block === 0) {
        set({ syncStatus: 'warning', syncMessage: `В строке ${line} нет блока: точку останова поставить нельзя.` });
        return;
      }

      const enabled = !breakpointLines.includes(line);
      set({
        breakpointLines: enabled ? [...breakpointLines, line].sort((a, b) => a - b) : breakpointLines.filter((item) => item !== line),
        syncStatus: 'saved',
        syncMessage: enabled ? `Точка останова в строке ${line}.` : `Точка останова в строке ${line} снята.`,
      });

      // The running session gets the stop condition at once; new sessions receive all breakpoint lines.
      if (simulationSessionId && block > 0) {
        try {
          await execute(enabled ? `STOP ,${block}` : `STOP ,${block},OFF`);
        } catch (error) {
          failRequest(error);
        }
      }
    },

    async clearBreakpoints() {
      set({ breakpointLines: [], syncStatus: 'saved', syncMessage: 'Все точки останова сняты.' });
      if (get().simulationSessionId) {
        try {
          await execute('STOP');
        } catch (error) {
          failRequest(error);
        }
      }
    },
  };
};
