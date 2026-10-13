import type { StateCreator } from 'zustand';
import { createProjectApi } from '../../../../shared/api/projectApi';
import { createSimulationApi } from '../../../../shared/api/simulationApi';
import type { StudioForm } from '../../../../shared/types/project';
import { withDocument } from '../../model/documents';
import {
  formMonitoring,
  indicatorsById,
  layoutIndicatorIds,
  modelForms,
  planFromForm,
  replaceForm,
  withDefaultInputs,
  withInputValue,
} from '../../model/userForms';
import { syncFailureMessage } from '../helpers';
import type { FormSliceActions, FormSliceState, TebEditorStore } from '../types';

/**
 * User forms of GPSS Studio models: the entry form edits input data bound to operands of the form's
 * model text, the dynamic form shows indicators of the running model, the form plan fills experiments.
 */
export const createFormSlice: StateCreator<TebEditorStore, [], [], FormSliceState & FormSliceActions> = (set, get) => {
  const currentForm = (): StudioForm | undefined => modelForms(get().project, get().projectModelIndex)[get().projectFormIndex];

  const updateForm = (update: (form: StudioForm) => StudioForm, message: string) => {
    const { project, projectModelIndex, projectFormIndex } = get();
    const form = currentForm();
    if (!project || !form) {
      return;
    }

    set({ project: replaceForm(project, projectModelIndex, projectFormIndex, update(form)), projectDirty: true, syncStatus: 'saved', syncMessage: message });
  };

  return {
    formIndicatorValues: {},
    formBusy: false,

    openForm(formIndex, documentId) {
      const form = modelForms(get().project, get().projectModelIndex)[formIndex];
      if (!form) {
        return;
      }

      set((state) => ({
        projectFormIndex: formIndex,
        formIndicatorValues: formIndex === state.projectFormIndex ? state.formIndicatorValues : {},
        openDocuments: withDocument(state.openDocuments, documentId),
        activeDocument: documentId,
        syncStatus: 'saved',
        syncMessage: `Открыта форма «${form.Name}».`,
      }));
    },

    setFormInputValue(inputNumber, operand, value) {
      updateForm((form) => withInputValue(form, inputNumber, operand, value), 'Исходные данные формы изменены.');
    },

    resetFormInputs() {
      updateForm(withDefaultInputs, 'Восстановлены значения исходных данных по умолчанию.');
    },

    async applyFormToModel() {
      const form = currentForm();
      if (!form) {
        return false;
      }

      set({ formBusy: true, syncStatus: 'syncing', syncMessage: 'Формирование текста модели по форме...' });
      try {
        const result = await createProjectApi(get().apiBaseUrl).applyForm(form.ModelText || get().modelText, form.Inputs);
        get().setModelText(result.Text);
        set({
          formBusy: false,
          simulationMonitoring: formMonitoring(form),
          simulationStartCount: Math.max(1, form.Run.StartCount),
          syncStatus: result.Messages.length > 0 ? 'warning' : 'saved',
          syncMessage: result.Messages.length > 0 ? result.Messages.join(' ') : `Текст модели сформирован по форме «${form.Name}».`,
        });
        return true;
      } catch (error) {
        set({ formBusy: false, syncStatus: 'offline', syncMessage: `Текст модели не сформирован. ${syncFailureMessage(error)}` });
        return false;
      }
    },

    async runForm() {
      if (!(await get().applyFormToModel())) {
        return;
      }

      await get().startSimulation();
      const completed = get().simulationState === 'completed';
      const form = currentForm();
      if (form?.DynamicForm && get().simulationSessionId) {
        get().openForm(get().projectFormIndex, 'dynamic-form');
        await get().refreshFormIndicators();
      }

      // A completed run is kept as a single experiment of the project ("Результаты моделирования").
      if (completed) {
        await get().saveSimulationResult({ auto: true });
      }
    },

    async refreshFormIndicators() {
      const { simulationSessionId, apiBaseUrl } = get();
      const form = currentForm();
      if (!form || !simulationSessionId) {
        return;
      }

      const byId = indicatorsById(form);
      const ids = layoutIndicatorIds(form.DynamicForm).filter((id) => byId.get(id)?.Expression);
      if (ids.length === 0) {
        return;
      }

      try {
        const values = await createSimulationApi(apiBaseUrl).evaluate(
          simulationSessionId,
          ids.map((id) => byId.get(id)!.Expression!),
        );
        set({ formIndicatorValues: Object.fromEntries(ids.map((id, index) => [id, values[index] ?? null])) });
      } catch (error) {
        set({ syncStatus: 'warning', syncMessage: `Показатели формы не получены. ${syncFailureMessage(error)}` });
      }
    },

    async planExperimentFromForm() {
      const form = currentForm();
      const plan = form ? planFromForm(form) : null;
      if (!form || !plan) {
        set({ syncStatus: 'warning', syncMessage: 'У формы нет плана эксперимента (факторов и целевых показателей).' });
        return;
      }

      if (!(await get().applyFormToModel())) {
        return;
      }

      set((state) => ({
        experimentPlan: { ...state.experimentPlan, ...plan },
        openDocuments: withDocument(state.openDocuments, 'experiments'),
        activeDocument: 'experiments',
        syncStatus: 'saved',
        syncMessage: `План эксперимента формы «${form.Name}»: факторов ${plan.factors?.length ?? 0}, показателей ${plan.indicators?.length ?? 0}.`,
      }));
    },
  };
};
