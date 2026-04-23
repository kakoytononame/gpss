import { create } from 'zustand';
import { createTebApi, readEditorQueryFromUrl } from '../api/tebApi.js';
import { SAMPLE_TEB_CLASS, SAMPLE_TEB_INSTANCE } from '../data/sampleTeb.js';
import {
  createBlankGpssEntity,
  createBlankParameter,
  createBlankPort,
  createBlankState,
  normalizeTebPayload,
  reorder,
  visibleTabsForType,
} from '../model/tebEditorModel.js';

const initialQuery = readEditorQueryFromUrl();

function clone(value) {
  return structuredClone(value);
}

function getApi(state) {
  return createTebApi({
    apiBaseUrl: state.apiBaseUrl,
    libraryId: state.libraryId,
    classId: state.mode === 'instance' ? state.instanceClassId : state.classId,
    instanceClassId: state.instanceClassId,
    instanceId: state.instanceId,
  });
}

function syncFailureMessage(error) {
  if (error?.status === 404) {
    return 'Эндпоинт команды пока не найден на сервере. Изменение сохранено локально.';
  }

  if (error?.status) {
    return `Сервер вернул HTTP ${error.status}. Изменение сохранено локально.`;
  }

  return 'Сервер недоступен. Изменение сохранено локально.';
}

async function runMutation(set, mutation, successMessage = 'Изменение отправлено на сервер.') {
  set({ syncStatus: 'syncing', syncMessage: 'Отправка изменения...' });

  try {
    await mutation();
    set({ syncStatus: 'saved', syncMessage: successMessage });
  } catch (error) {
    set({ syncStatus: 'offline', syncMessage: syncFailureMessage(error) });
  }
}

function updateTeb(set, updater) {
  set((state) => {
    if (!state.teb) {
      return state;
    }

    const teb = clone(state.teb);
    updater(teb);

    return { teb };
  });
}

function ensureActiveTab(set, teb, activeTab) {
  const visibleTabs = visibleTabsForType(teb.type);

  if (visibleTabs.includes(activeTab)) {
    return activeTab;
  }

  const nextActiveTab = visibleTabs[0] || 'general';
  set({ activeTab: nextActiveTab });

  return nextActiveTab;
}

export const useTebEditorStore = create((set, get) => ({
  ...initialQuery,
  activeTab: 'general',
  teb: null,
  loading: false,
  loadError: '',
  source: 'idle',
  syncStatus: 'idle',
  syncMessage: 'Ожидание изменений.',

  async load() {
    const state = get();
    const api = getApi(state);

    set({
      loading: true,
      loadError: '',
      source: 'api',
      syncStatus: 'idle',
      syncMessage: 'Ожидание изменений.',
    });

    try {
      const payload = state.mode === 'instance' ? await api.getInstance() : await api.getClass();
      const teb = normalizeTebPayload(payload, state.mode);
      ensureActiveTab(set, teb, get().activeTab);

      set({
        teb,
        loading: false,
        source: 'api',
        mode: teb.mode,
      });
    } catch (error) {
      const fallback = state.mode === 'instance' ? SAMPLE_TEB_INSTANCE : SAMPLE_TEB_CLASS;
      const teb = normalizeTebPayload(fallback, state.mode);
      ensureActiveTab(set, teb, get().activeTab);

      set({
        teb,
        loading: false,
        source: 'sample',
        loadError: 'Не удалось получить данные с локального API. Открыты демонстрационные данные.',
        syncStatus: 'offline',
        syncMessage: 'Работа в локальном режиме до восстановления API.',
      });
    }
  },

  setActiveTab(tabId) {
    set({ activeTab: tabId });
  },

  setMode(mode) {
    set({ mode, activeTab: 'general' });
    get().load();
  },

  updateGeneralField(field, value) {
    updateTeb(set, (teb) => {
      teb[field] = value;
    });
  },

  commitGeneralField(field) {
    const state = get();
    const value = state.teb?.[field] ?? '';
    const api = getApi(state);

    return runMutation(set, () => api.updateClassProperty(field, value));
  },

  updateGpssModelText(text) {
    updateTeb(set, (teb) => {
      teb.gpssModel.text = text;
    });
  },

  commitGpssModelText() {
    const state = get();
    const text = state.teb?.gpssModel?.text ?? '';
    const api = getApi(state);

    return runMutation(set, () => api.updateGpssModel(text), 'Текст GPSS модели отправлен на сервер.');
  },

  addParameter() {
    const parameter = createBlankParameter();
    const api = getApi(get());

    updateTeb(set, (teb) => {
      teb.parameters.push(parameter);
    });

    return runMutation(set, () => api.addParameter(parameter), 'Параметр добавлен на сервере.');
  },

  removeParameter(index) {
    const api = getApi(get());

    updateTeb(set, (teb) => {
      teb.parameters.splice(index, 1);
    });

    return runMutation(set, () => api.deleteParameter(index), 'Параметр удален на сервере.');
  },

  moveParameter(index, direction) {
    const api = getApi(get());

    updateTeb(set, (teb) => {
      teb.parameters = reorder(teb.parameters, index, direction);
    });

    return runMutation(set, () => api.moveParameter(index, direction));
  },

  updateParameter(index, field, value) {
    updateTeb(set, (teb) => {
      teb.parameters[index][field] = value;
    });
  },

  commitParameter(index) {
    const state = get();
    const api = getApi(state);
    const parameter = state.teb?.parameters?.[index];

    if (!parameter) {
      return Promise.resolve();
    }

    return runMutation(set, () => api.updateParameter(index, parameter));
  },

  commitParameterValue(index) {
    const state = get();
    const api = getApi(state);
    const value = state.teb?.parameters?.[index]?.currentValue ?? '';

    return runMutation(set, () => api.setParameterValue(index, value), 'Текущее значение параметра отправлено на сервер.');
  },

  addCollectionRow(collection) {
    updateTeb(set, (teb) => {
      const factories = {
        gpssEntities: createBlankGpssEntity,
        inputs: createBlankPort,
        outputs: createBlankPort,
        states: createBlankState,
      };

      teb[collection].push(factories[collection]());
    });
  },

  removeCollectionRow(collection, index) {
    updateTeb(set, (teb) => {
      teb[collection].splice(index, 1);
    });
  },

  moveCollectionRow(collection, index, direction) {
    updateTeb(set, (teb) => {
      teb[collection] = reorder(teb[collection], index, direction);
    });
  },

  updateCollectionField(collection, index, field, value) {
    updateTeb(set, (teb) => {
      teb[collection][index][field] = value;
    });
  },

  commitCollectionField(collection, index) {
    const state = get();
    const row = state.teb?.[collection]?.[index];
    const api = getApi(state);

    if (!row) {
      return Promise.resolve();
    }

    return runMutation(set, () => api.updateClassProperty(`${collection}[${index}]`, row));
  },
}));
