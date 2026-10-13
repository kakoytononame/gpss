import type { StateCreator } from 'zustand';
import { createResultApi, type CreateResultRequest } from '../../../../shared/api/resultApi';
import { withDocument } from '../../model/documents';
import { toRequestFactors, toRequestIndicators } from '../../model/experimentPlan';
import { defaultResultName, formInputValues } from '../../model/simulationResults';
import { modelForms } from '../../model/userForms';
import { syncFailureMessage } from '../helpers';
import type { ResultSliceActions, ResultSliceState, TebEditorStore } from '../types';

export const initialResultState: ResultSliceState = {
  simulationResults: [],
  selectedResult: null,
  resultsBusy: false,
};

/**
 * Database of simulation results ("Результаты моделирования" of GPSS Studio): single experiments saved after
 * a form run and series saved after an experiment, kept on the server per project.
 */
export const createResultSlice: StateCreator<TebEditorStore, [], [], ResultSliceState & ResultSliceActions> = (set, get) => {
  const api = () => createResultApi(get().apiBaseUrl);

  const modelName = () => {
    const { project, projectModelIndex, simulationReport } = get();
    return project?.Models[projectModelIndex]?.Name ?? simulationReport?.ModelName ?? 'Модель';
  };

  /** Saves a result and adds it to the tree; after an automatic save the run's status message is kept and completed. */
  const save = async (request: Omit<CreateResultRequest, 'ProjectId'>, auto = false) => {
    try {
      const created = await api().create({ ...request, ProjectId: get().project?.Id ?? null });
      set((state) => ({
        simulationResults: [
          ...state.simulationResults.filter((item) => item.Id !== created.Id),
          { Id: created.Id, ProjectId: created.ProjectId, Kind: created.Kind, Name: created.Name, CreatedAt: created.CreatedAt },
        ],
        syncStatus: auto ? state.syncStatus : 'saved',
        syncMessage: `${auto ? `${state.syncMessage} ` : ''}Результат «${created.Name}» сохранён.`.trim(),
      }));
    } catch (error) {
      set({ syncStatus: 'warning', syncMessage: `Результат моделирования не сохранён. ${syncFailureMessage(error)}` });
    }
  };

  return {
    ...initialResultState,

    async loadResults() {
      const projectId = get().project?.Id ?? null;
      try {
        const results = await api().list(projectId);
        if ((get().project?.Id ?? null) === projectId) {
          set({ simulationResults: results });
        }
      } catch {
        // Offline: the tree shows no results until the server is reachable.
      }
    },

    async openResult(id) {
      set({ resultsBusy: true });
      try {
        const result = await api().get(id);
        set((state) => ({
          selectedResult: result,
          resultsBusy: false,
          openDocuments: withDocument(state.openDocuments, 'results'),
          activeDocument: 'results',
          syncStatus: 'saved',
          syncMessage: `Открыт результат «${result.Name}».`,
        }));
      } catch (error) {
        set({ resultsBusy: false, syncStatus: 'offline', syncMessage: `Результат не открыт. ${syncFailureMessage(error)}` });
      }
    },

    async saveSimulationResult({ auto = false } = {}) {
      const { simulationReport: report, modelText, project, projectModelIndex, projectFormIndex, simulationMonitoring, simulationStartCount } = get();
      if (!report) {
        set({ syncStatus: 'warning', syncMessage: 'Нет результатов моделирования для сохранения.' });
        return;
      }

      // The form is part of the result only when the run used its settings (monitors of the form).
      const form = simulationMonitoring ? modelForms(project, projectModelIndex)[projectFormIndex] : undefined;
      await save(
        {
          Kind: 'single',
          Name: defaultResultName('single', new Date(), form?.Name),
          Payload: {
            ModelName: modelName(),
            ModelText: modelText,
            FormName: form?.Name ?? null,
            Inputs: formInputValues(form),
            StartCount: form ? simulationStartCount : null,
            Report: report,
          },
        },
        auto,
      );
    },

    async saveExperimentResult({ auto = false } = {}) {
      const { experimentResult: result, experimentPlan: plan, modelText } = get();
      if (!result) {
        set({ syncStatus: 'warning', syncMessage: 'Нет результатов серии экспериментов для сохранения.' });
        return;
      }

      await save(
        {
          Kind: 'series',
          Name: defaultResultName('series', new Date()),
          Payload: {
            ModelName: modelName(),
            ModelText: modelText,
            Factors: toRequestFactors(plan.factors),
            Indicators: toRequestIndicators(plan.indicators),
            Replications: Math.max(1, plan.replications),
            StartCount: Math.max(1, plan.startCount),
            Maximize: plan.maximize,
            Result: result,
          },
        },
        auto,
      );
    },

    async renameResult(id, name) {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      try {
        const renamed = await api().rename(id, trimmed);
        set((state) => ({
          simulationResults: state.simulationResults.map((item) => (item.Id === id ? { ...item, Name: renamed.Name } : item)),
          selectedResult: state.selectedResult?.Id === id ? { ...state.selectedResult, Name: renamed.Name } : state.selectedResult,
          syncStatus: 'saved',
          syncMessage: `Результат переименован в «${renamed.Name}».`,
        }));
      } catch (error) {
        set({ syncStatus: 'offline', syncMessage: `Результат не переименован. ${syncFailureMessage(error)}` });
      }
    },

    async deleteResult(id) {
      try {
        await api().remove(id);
        set((state) => ({
          simulationResults: state.simulationResults.filter((item) => item.Id !== id),
          selectedResult: state.selectedResult?.Id === id ? null : state.selectedResult,
          syncStatus: 'saved',
          syncMessage: 'Результат удалён.',
        }));
      } catch (error) {
        set({ syncStatus: 'offline', syncMessage: `Результат не удалён. ${syncFailureMessage(error)}` });
      }
    },
  };
};
