import type { StateCreator } from 'zustand';
import { createExperimentApi } from '../../../../shared/api/experimentApi';
import { downloadTextFile } from '../../../../shared/lib/utils';
import { experimentToCsv, suggestFactors, suggestIndicators, toRequestFactors, toRequestIndicators, type ExperimentPlan } from '../../model/experimentPlan';
import type { ExperimentSliceActions, ExperimentSliceState, TebEditorStore } from '../types';

export const DEFAULT_EXPERIMENT_PLAN: ExperimentPlan = {
  factors: [],
  indicators: [],
  replications: 3,
  startCount: 1,
  objective: -1,
  maximize: false,
};

/** Series of simulation runs over a factor plan (GPSS Studio "Серия экспериментов" and optimisation). */
export const createExperimentSlice: StateCreator<TebEditorStore, [], [], ExperimentSliceState & ExperimentSliceActions> = (set, get) => ({
  experimentPlan: DEFAULT_EXPERIMENT_PLAN,
  experimentResult: null,
  experimentBusy: false,

  setExperimentPlan(update) {
    set((state) => ({ experimentPlan: { ...state.experimentPlan, ...update(state.experimentPlan) } }));
  },

  suggestExperimentPlan() {
    const text = get().modelText;
    const factors = suggestFactors(text);
    const indicators = suggestIndicators(text);
    set((state) => ({
      experimentPlan: {
        ...state.experimentPlan,
        factors: factors.length > 0 ? factors : state.experimentPlan.factors,
        indicators: indicators.length > 0 ? indicators : state.experimentPlan.indicators,
        objective: indicators.length > 0 ? 0 : state.experimentPlan.objective,
      },
      syncStatus: 'saved',
      syncMessage: `Из текста модели предложено факторов: ${factors.length}, показателей: ${indicators.length}. Задайте уровни факторов.`,
    }));
  },

  async runExperiment() {
    const { experimentPlan: plan, modelText, apiBaseUrl } = get();
    const indicators = toRequestIndicators(plan.indicators);
    if (!modelText.trim() || indicators.length === 0) {
      set({ syncStatus: 'warning', syncMessage: 'Для эксперимента нужны текст модели и хотя бы один показатель.' });
      return;
    }

    set({ experimentBusy: true, syncStatus: 'syncing', syncMessage: 'Выполняется серия экспериментов...' });
    try {
      const result = await createExperimentApi(apiBaseUrl).run({
        ModelText: modelText,
        Factors: toRequestFactors(plan.factors),
        Indicators: indicators,
        Replications: Math.max(1, plan.replications),
        StartCount: Math.max(1, plan.startCount),
        ObjectiveIndicator: plan.objective >= 0 && plan.objective < indicators.length ? plan.objective : null,
        Maximize: plan.maximize,
      });
      const failed = result.Runs.filter((run) => run.Error).length;
      set({
        experimentResult: result,
        experimentBusy: false,
        syncStatus: failed > 0 ? 'warning' : 'saved',
        syncMessage: `Серия выполнена: ${result.Runs.length} прогонов за ${result.ElapsedSeconds.toFixed(1)} с${failed > 0 ? `, с ошибками: ${failed}` : ''}.`,
      });
    } catch (error) {
      set({ experimentBusy: false, syncStatus: 'offline', syncMessage: `Эксперимент не выполнен: ${error instanceof Error ? error.message : String(error)}` });
    }
  },

  exportExperiment() {
    const result = get().experimentResult;
    if (result) {
      downloadTextFile('серия экспериментов.csv', `${String.fromCharCode(0xfeff)}${experimentToCsv(result)}`, 'text/csv;charset=utf-8');
    }
  },
});
