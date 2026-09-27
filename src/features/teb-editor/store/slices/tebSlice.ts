import type { StateCreator } from 'zustand';
import { readEditorQueryFromUrl } from '../../../../shared/api/tebApi';
import { clamp, deepClone, readFileAsDataUrl, reorderItems } from '../../../../shared/lib/utils';
import type { CollectionKey, CollectionRow, TebDocument } from '../../../../shared/types/teb';
import { createBlankGpssEntity, createBlankParameter, createBlankPort, createBlankState } from '../../model/factories';
import { buildInitialModelLog } from '../../model/modelLog';
import { normalizeTebPayload } from '../../model/normalizeTeb';
import { SAMPLE_TEB_CLASS, SAMPLE_TEB_INSTANCE } from '../../model/sampleData';
import { createHistory, getApi, runRemoteMutation, safeTabForDocument, updateTeb } from '../helpers';
import type { TebEditorDataActions, TebEditorDataState, TebEditorStore } from '../types';

const MIN_MODEL_FONT_SIZE = 11;
const MAX_MODEL_FONT_SIZE = 24;
const DEFAULT_MODEL_FONT_SIZE = 14;
const GPSS_BLOCK_PATTERN = /QUEUE|SEIZE|ADVANCE|TRANSFER|RELEASE/;

const BLANK_ROW_FACTORIES: { [K in CollectionKey]: () => CollectionRow<K> } = {
  gpssEntities: createBlankGpssEntity,
  inputs: createBlankPort,
  outputs: createBlankPort,
  states: createBlankState,
};

function rowsOf(teb: TebDocument, collection: CollectionKey): CollectionRow[] {
  return teb[collection];
}

export function sampleDocument(mode: TebDocument['mode']): TebDocument {
  return deepClone(mode === 'instance' ? SAMPLE_TEB_INSTANCE : SAMPLE_TEB_CLASS);
}

export const initialTebState: TebEditorDataState = {
  ...readEditorQueryFromUrl(),
  teb: null,
  loading: false,
  loadError: '',
  source: 'idle',
  activeTab: 'general',
  modelFontSize: DEFAULT_MODEL_FONT_SIZE,
  history: [],
  historyIndex: -1,
};

export const createTebSlice: StateCreator<TebEditorStore, [], [], TebEditorDataState & TebEditorDataActions> = (set, get) => {
  /** Sends the whole collection after structural changes (add / remove / reorder). */
  const syncCollection = (collection: CollectionKey, successMessage: string) =>
    runRemoteMutation(set, () => getApi(get()).updateClassProperty(collection, get().teb?.[collection] ?? []), successMessage);

  const setModelFontSize = (size: number, message: string) =>
    set({ modelFontSize: clamp(size, MIN_MODEL_FONT_SIZE, MAX_MODEL_FONT_SIZE), syncMessage: message });

  return {
    ...initialTebState,

    async load() {
      const state = get();
      const api = getApi(state);

      set({ loading: true, loadError: '', source: 'api', syncStatus: 'idle', syncMessage: 'Загрузка данных...' });

      try {
        const payload = state.mode === 'instance' ? await api.getInstance() : await api.getClass();
        const teb = normalizeTebPayload(payload, state.mode);
        set({
          teb,
          loading: false,
          source: 'api',
          mode: teb.mode,
          activeTab: safeTabForDocument(get().activeTab, teb.type),
          modelLogText: get().modelLogText || buildInitialModelLog(teb, get().simulationState),
          ...createHistory(teb),
          syncMessage: 'Данные загружены с локального API.',
        });
      } catch {
        const fallback = sampleDocument(state.mode);
        set({
          teb: fallback,
          loading: false,
          source: 'sample',
          loadError: 'Не удалось получить данные с локального API. Открыты демонстрационные данные.',
          syncStatus: 'offline',
          syncMessage: 'Работа в локальном режиме до восстановления API.',
          modelLogText: get().modelLogText || buildInitialModelLog(fallback, get().simulationState),
          ...createHistory(fallback),
        });
      }
    },

    async refresh() {
      await get().load();
    },

    setActiveTab(tabId) {
      set({ activeTab: safeTabForDocument(tabId, get().teb?.type) });
    },

    async setMode(mode) {
      set({ mode, activeTab: 'general' });
      await get().load();
    },

    undo() {
      const { history, historyIndex } = get();
      if (historyIndex <= 0) {
        set({ syncMessage: 'Больше нечего отменять.' });
        return;
      }

      set({ teb: deepClone(history[historyIndex - 1]), historyIndex: historyIndex - 1, syncMessage: 'Последнее изменение отменено.' });
    },

    redo() {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) {
        set({ syncMessage: 'Больше нечего повторять.' });
        return;
      }

      set({ teb: deepClone(history[historyIndex + 1]), historyIndex: historyIndex + 1, syncMessage: 'Изменение повторено.' });
    },

    zoomInModel() {
      const size = clamp(get().modelFontSize + 1, MIN_MODEL_FONT_SIZE, MAX_MODEL_FONT_SIZE);
      setModelFontSize(size, `Масштаб текста модели: ${size} pt.`);
    },

    zoomOutModel() {
      const size = clamp(get().modelFontSize - 1, MIN_MODEL_FONT_SIZE, MAX_MODEL_FONT_SIZE);
      setModelFontSize(size, `Масштаб текста модели: ${size} pt.`);
    },

    resetModelZoom() {
      setModelFontSize(DEFAULT_MODEL_FONT_SIZE, 'Масштаб текста модели сброшен.');
    },

    validateModel() {
      const text = get().teb?.gpssModel.text.trim() ?? '';

      if (!text) {
        set({ syncStatus: 'warning', syncMessage: 'Текст GPSS модели пуст.' });
        return;
      }

      const commands = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const hasBlock = commands.some((line) => GPSS_BLOCK_PATTERN.test(line));
      set({
        syncStatus: hasBlock ? 'saved' : 'warning',
        syncMessage: hasBlock
          ? `Проверка модели прошла: ${commands.length} строк, базовые GPSS-команды найдены.`
          : 'Проверка модели завершена: не найдено типовых GPSS-команд.',
      });
    },

    updateGeneralField(field, value) {
      updateTeb(set, (teb) => (teb[field] = value), 'Локальные изменения обновлены.');
    },

    async commitGeneralField(field) {
      const value = get().teb?.[field] ?? '';
      await runRemoteMutation(set, () => getApi(get()).updateClassProperty(field, value), 'Свойство отправлено на сервер.');
    },

    updateGpssModelText(text) {
      updateTeb(set, (teb) => (teb.gpssModel.text = text), 'Текст модели изменен локально.');
    },

    async commitGpssModelText() {
      const text = get().teb?.gpssModel.text ?? '';
      await runRemoteMutation(set, () => getApi(get()).updateGpssModel(text), 'Текст GPSS модели отправлен на сервер.');
    },

    async attachImage(file) {
      const imageUrl = await readFileAsDataUrl(file);
      const imageName = file.name;

      updateTeb(
        set,
        (teb) => {
          teb.imageName = imageName;
          teb.imageUrl = imageUrl;
        },
        `Изображение "${imageName}" загружено.`,
      );

      await runRemoteMutation(set, () => getApi(get()).updateClassProperty('image', { imageName, imageUrl }), 'Изображение отправлено на сервер.');
    },

    async removeImage() {
      updateTeb(
        set,
        (teb) => {
          teb.imageName = '';
          delete teb.imageUrl;
        },
        'Изображение удалено.',
      );

      await runRemoteMutation(set, () => getApi(get()).updateClassProperty('image', { imageName: '', imageUrl: '' }), 'Изображение удалено на сервере.');
    },

    async addParameter() {
      const parameter = createBlankParameter();
      updateTeb(set, (teb) => teb.parameters.push(parameter), 'Параметр добавлен локально.');
      await runRemoteMutation(set, () => getApi(get()).addParameter(parameter), 'Параметр добавлен на сервере.');
    },

    async removeParameter(index) {
      if (!get().teb?.parameters[index]) {
        return;
      }

      updateTeb(set, (teb) => teb.parameters.splice(index, 1), 'Параметр удален локально.');
      await runRemoteMutation(set, () => getApi(get()).deleteParameter(index), 'Параметр удален на сервере.');
    },

    async moveParameter(index, direction) {
      if (!get().teb?.parameters[index]) {
        return;
      }

      updateTeb(set, (teb) => (teb.parameters = reorderItems(teb.parameters, index, direction)), 'Параметры переупорядочены.');
      await runRemoteMutation(set, () => getApi(get()).moveParameter(index, direction), 'Порядок параметров отправлен на сервер.');
    },

    updateParameter(index, field, value) {
      updateTeb(
        set,
        (teb) => {
          const parameter = teb.parameters[index];
          if (parameter) {
            Object.assign(parameter, { [field]: value });
          }
        },
        'Параметр изменен локально.',
      );
    },

    async commitParameter(index) {
      const parameter = get().teb?.parameters[index];
      if (parameter) {
        await runRemoteMutation(set, () => getApi(get()).updateParameter(index, parameter), 'Параметр отправлен на сервер.');
      }
    },

    async commitParameterValue(index) {
      const value = get().teb?.parameters[index]?.currentValue ?? '';
      await runRemoteMutation(set, () => getApi(get()).setParameterValue(index, value), 'Текущее значение параметра отправлено на сервер.');
    },

    async addCollectionRow(collection) {
      if (!get().teb) {
        return;
      }

      updateTeb(set, (teb) => rowsOf(teb, collection).push(BLANK_ROW_FACTORIES[collection]()), 'Строка добавлена.');
      await syncCollection(collection, 'Коллекция обновлена на сервере.');
    },

    async removeCollectionRow(collection, index) {
      if (!get().teb?.[collection][index]) {
        return;
      }

      updateTeb(set, (teb) => rowsOf(teb, collection).splice(index, 1), 'Строка удалена.');
      await syncCollection(collection, 'Коллекция обновлена на сервере.');
    },

    async moveCollectionRow(collection, index, direction) {
      if (!get().teb?.[collection][index]) {
        return;
      }

      updateTeb(
        set,
        (teb) => {
          const rows = rowsOf(teb, collection);
          rows.splice(0, rows.length, ...reorderItems(rows, index, direction));
        },
        'Строка перемещена.',
      );
      await syncCollection(collection, 'Порядок элементов обновлен на сервере.');
    },

    updateCollectionField(collection, index, field, value) {
      updateTeb(
        set,
        (teb) => {
          const row = rowsOf(teb, collection)[index];
          if (row) {
            Object.assign(row, { [field]: value });
          }
        },
        'Табличные данные обновлены.',
      );
    },

    async commitCollectionField(collection, index) {
      const row = get().teb?.[collection][index];
      if (row) {
        await runRemoteMutation(set, () => getApi(get()).updateClassProperty(`${collection}[${index}]`, row), 'Изменение строки отправлено на сервер.');
      }
    },
  };
};
