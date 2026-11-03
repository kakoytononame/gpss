import type { StateCreator } from 'zustand';
import { createQueueingApi } from '../../../../shared/api/queueingApi';
import type { QueueingAnalysis, QueueingModel, QueueingPreset, QueueingRunResult } from '../../../../shared/types/queueing';
import { withDocument } from '../../model/documents';
import { DEFAULT_QUEUEING_MODEL, quickChecks } from '../../model/queueing';
import type { TebEditorStore } from '../types';

const STORAGE_KEY = 'gpss.queueing.model';

export interface QueueingSliceState {
  queueingModel: QueueingModel;
  queueingPresets: QueueingPreset[];
  /** Theory for the current description (recomputed after every change). */
  queueingAnalysis: QueueingAnalysis | null;
  /** Last simulation with the comparison to theory. */
  queueingRun: QueueingRunResult | null;
  /** The run was made for an earlier version of the description. */
  queueingRunStale: boolean;
  queueingErrors: string[];
  queueingBusy: 'analyze' | 'simulate' | null;
}

export interface QueueingSliceActions {
  loadQueueingPresets: () => Promise<void>;
  applyQueueingPreset: (id: string) => void;
  setQueueingModel: (update: (model: QueueingModel) => QueueingModel) => void;
  analyzeQueueing: () => Promise<void>;
  simulateQueueing: () => Promise<void>;
  /** Generates the GPSS model and opens it in "Текст модели". */
  openQueueingModelText: () => Promise<void>;
  resetQueueingModel: () => void;
}

function readModel(): QueueingModel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueueingModel) : DEFAULT_QUEUEING_MODEL;
  } catch {
    return DEFAULT_QUEUEING_MODEL;
  }
}

function writeModel(model: QueueingModel) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // The description is kept in memory when storage is unavailable.
  }
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Queueing systems constructor: description of classes and nodes, theory, simulation and the GPSS model text. */
export const createQueueingSlice: StateCreator<TebEditorStore, [], [], QueueingSliceState & QueueingSliceActions> = (set, get) => {
  const api = () => createQueueingApi(get().apiBaseUrl);
  let analysisRequest = 0;

  return {
    queueingModel: readModel(),
    queueingPresets: [],
    queueingAnalysis: null,
    queueingRun: null,
    queueingRunStale: false,
    queueingErrors: [],
    queueingBusy: null,

    async loadQueueingPresets() {
      if (get().queueingPresets.length > 0) {
        return;
      }

      try {
        set({ queueingPresets: await api().presets() });
      } catch (error) {
        set({ syncStatus: 'offline', syncMessage: `Каталог систем массового обслуживания не загружен: ${message(error)}` });
      }
    },

    applyQueueingPreset(id) {
      const preset = get().queueingPresets.find((item) => item.Id === id);
      if (!preset) {
        return;
      }

      const model = structuredClone(preset.Model);
      writeModel(model);
      set({ queueingModel: model, queueingRun: null, queueingRunStale: false, queueingAnalysis: null, syncStatus: 'saved', syncMessage: `Загружен пример «${preset.Title}».` });
      void get().analyzeQueueing();
    },

    setQueueingModel(update) {
      const model = update(get().queueingModel);
      writeModel(model);
      set((state) => ({ queueingModel: model, queueingRunStale: state.queueingRun !== null }));
    },

    async analyzeQueueing() {
      const model = get().queueingModel;
      const local = quickChecks(model);
      if (local.length > 0) {
        set({ queueingErrors: local, queueingAnalysis: null });
        return;
      }

      const request = ++analysisRequest;
      try {
        const problems = await api().validate(model);
        if (request !== analysisRequest) {
          return;
        }

        if (problems.length > 0) {
          set({ queueingErrors: problems, queueingAnalysis: null });
          return;
        }

        const analysis = await api().analyze(model);
        if (request === analysisRequest) {
          set({ queueingErrors: [], queueingAnalysis: analysis });
        }
      } catch (error) {
        if (request === analysisRequest) {
          set({ queueingErrors: [message(error)], queueingAnalysis: null });
        }
      }
    },

    async simulateQueueing() {
      const model = get().queueingModel;
      set({ queueingBusy: 'simulate', syncStatus: 'syncing', syncMessage: `Моделирование: ${model.Replications} прогонов по ${model.Duration} ед. времени...` });
      try {
        const run = await api().simulate(model);
        set({
          queueingRun: run,
          queueingRunStale: false,
          queueingAnalysis: run.Analysis,
          queueingErrors: [],
          queueingBusy: null,
          syncStatus: run.Messages.length > 0 ? 'warning' : 'saved',
          syncMessage: `Моделирование выполнено: ${run.Replications} прогонов за ${run.ElapsedSeconds.toFixed(1)} с.${run.Messages.length > 0 ? ` ${run.Messages.join(' ')}` : ''}`,
        });
      } catch (error) {
        set({ queueingBusy: null, queueingErrors: [message(error)], syncStatus: 'offline', syncMessage: `Моделирование не выполнено: ${message(error)}` });
      }
    },

    async openQueueingModelText() {
      try {
        const generated = await api().generate(get().queueingModel);
        get().setModelText(generated.Text);
        set((state) => ({
          openDocuments: withDocument(state.openDocuments, 'model-text'),
          activeDocument: 'model-text',
          syncStatus: 'saved',
          syncMessage: 'Текст модели GPSS сформирован конструктором СМО. Его можно запустить, отлаживать и использовать в экспериментах.',
        }));
      } catch (error) {
        set({ queueingErrors: [message(error)], syncStatus: 'offline', syncMessage: `Текст модели не сформирован: ${message(error)}` });
      }
    },

    resetQueueingModel() {
      writeModel(DEFAULT_QUEUEING_MODEL);
      set({ queueingModel: DEFAULT_QUEUEING_MODEL, queueingRun: null, queueingRunStale: false, queueingAnalysis: null, queueingErrors: [] });
      void get().analyzeQueueing();
    },
  };
};
