import type { StateCreator } from 'zustand';
import { deepClone } from '../../../../shared/lib/utils';
import { appendLogLine, buildInitialModelLog } from '../../model/modelLog';
import { reportCellKey } from '../../model/report';
import { INITIAL_ISSUES, INITIAL_TEB_TESTS } from '../../model/workspaceData';
import type { DiagnosticsSliceActions, DiagnosticsSliceState, TebEditorStore } from '../types';

export function initialDiagnosticsState(): DiagnosticsSliceState {
  return {
    reportCellEdits: {},
    modelLogText: '',
    issues: deepClone(INITIAL_ISSUES),
    issueFilter: 'all',
    tebTests: deepClone(INITIAL_TEB_TESTS),
  };
}

export const createDiagnosticsSlice: StateCreator<TebEditorStore, [], [], DiagnosticsSliceState & DiagnosticsSliceActions> = (set) => ({
  ...initialDiagnosticsState(),

  setReportCellEdit(sectionId, rowIndex, columnIndex, value) {
    set((state) => ({
      reportCellEdits: { ...state.reportCellEdits, [reportCellKey(sectionId, rowIndex, columnIndex)]: value },
      syncStatus: 'saved',
      syncMessage: 'Ячейка стандартного отчета изменена.',
    }));
  },

  setModelLogText(text, message = 'Журнал моделирования изменен.') {
    set({ modelLogText: text, syncStatus: 'saved', syncMessage: message });
  },

  appendModelLog(line) {
    set((state) => ({
      modelLogText: appendLogLine(state.modelLogText || buildInitialModelLog(state.teb, state.simulationState), line),
      syncStatus: 'saved',
      syncMessage: 'В журнал добавлена запись.',
    }));
  },

  clearModelLog() {
    set({ modelLogText: '', syncStatus: 'saved', syncMessage: 'Журнал моделирования очищен.' });
  },

  setIssueFilter(filter) {
    set({ issueFilter: filter, syncStatus: 'saved', syncMessage: 'Фильтр замечаний и ошибок изменен.' });
  },

  setTebTestStatus(id, status, message) {
    set((state) => ({
      tebTests: state.tebTests.map((test) => (test.id === id ? { ...test, status, message } : test)),
      syncStatus: status === 'failed' ? 'warning' : 'saved',
      syncMessage: message,
    }));
  },
});
