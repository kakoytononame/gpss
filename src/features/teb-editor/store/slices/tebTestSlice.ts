import type { StateCreator } from 'zustand';
import { createProjectApi } from '../../../../shared/api/projectApi';
import type { GenerationResult } from '../../../../shared/types/project';
import type { TebTestItem } from '../../../../shared/types/teb';
import { editorTebTests, projectTebTests } from '../../model/tebTests';
import { syncFailureMessage } from '../helpers';
import type { TebEditorStore, TebTestSliceActions, TebTestSliceState } from '../types';

/**
 * "Тесты ТЭБов": checks of every TEB of the project model (description, GPSS model, parameters, connections
 * reported by the model generator) or of the TEB class open in the editor.
 */
export const createTebTestSlice: StateCreator<TebEditorStore, [], [], TebTestSliceState & TebTestSliceActions> = (set, get) => {
  const finish = (tests: TebTestItem[], note = '') => {
    const failed = tests.filter((test) => test.status === 'failed').length;
    set({
      tebTests: tests,
      tebTestsBusy: false,
      syncStatus: failed > 0 || note ? 'warning' : 'saved',
      syncMessage: `Тесты ТЭБов: пройдено ${tests.length - failed} из ${tests.length}${failed > 0 ? `, с ошибками ${failed}` : ''}.${note}`,
    });
  };

  return {
    tebTestsBusy: false,

    async runTebTests() {
      if (get().tebTestsBusy) {
        return;
      }

      get().flushSchemeToProject();
      const { project, projectModelIndex, teb, apiBaseUrl } = get();
      const model = project?.Models[projectModelIndex];
      get().openRightPanel('teb-tests');

      if (!model) {
        if (teb) {
          finish(editorTebTests(teb));
        } else {
          set({ syncStatus: 'warning', syncMessage: 'Нет ТЭБа для проверки: откройте проект или класс ТЭБа.' });
        }

        return;
      }

      if (!model.Scheme?.Nodes.length) {
        set({ tebTests: [], syncStatus: 'warning', syncMessage: `В модели «${model.Name}» нет структурной схемы из ТЭБов: проверять нечего.` });
        return;
      }

      set({ tebTestsBusy: true, syncStatus: 'syncing', syncMessage: 'Выполняются тесты ТЭБов...' });
      let generation: GenerationResult | null = null;
      let note = '';
      try {
        generation = await createProjectApi(apiBaseUrl).generate(model.Scheme, model.Name);
      } catch (error) {
        note = ` Связи и трансляция не проверены: ${syncFailureMessage(error)}`;
      }

      finish(projectTebTests(model, generation), note);
    },

    clearTebTests() {
      set({ tebTests: [], syncStatus: 'saved', syncMessage: 'Результаты тестов ТЭБов очищены.' });
    },

    focusTebTest(test) {
      if (!get().project) {
        get().activateDocument('editor');
        return;
      }

      if (!test.sourceNodeId) {
        get().activateDocument('model-text');
        return;
      }

      get().leaveToSchemeLevel(0);
      for (const compositeId of test.schemePath ?? []) {
        get().enterComposite(compositeId);
      }

      get().setSchemeSelection({ type: 'node', id: test.sourceNodeId });
      get().activateDocument('scheme');
    },
  };
};
