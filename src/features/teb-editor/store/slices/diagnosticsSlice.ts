import type { StateCreator } from 'zustand';
import { deepClone } from '../../../../shared/lib/utils';
import { appendLogLine, buildInitialModelLog } from '../../model/modelLog';
import { downloadTextFile } from '../../../../shared/lib/utils';
import { reportCellKey, reportToCsv, reportToTsv, type ReportTable } from '../../model/report';
import { DEMO_REPORT_SECTIONS } from '../../ui/StandardReportDocument/reportData';
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

/** Tables of the last simulation report, or of the demo report before the first run. */
function reportTables(state: TebEditorStore): { modelName: string; tables: ReportTable[] } {
  const report = state.simulationReport;
  return report
    ? {
        modelName: report.ModelName,
        tables: report.Sections.map((section) => ({ id: section.Id, label: section.Label, columns: section.Columns, rows: section.Rows })),
      }
    : { modelName: 'Демонстрационный отчёт', tables: DEMO_REPORT_SECTIONS };
}

export const createDiagnosticsSlice: StateCreator<TebEditorStore, [], [], DiagnosticsSliceState & DiagnosticsSliceActions> = (set, get) => ({
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
      modelLogText: appendLogLine(state.modelLogText || buildInitialModelLog(state.teb), line),
      syncStatus: 'saved',
      syncMessage: 'В журнал добавлена запись.',
    }));
  },

  exportReport() {
    const { modelName, tables } = reportTables(get());
    const safeName = modelName.replace(/[\\/:*?"<>|]+/g, '_') || 'report';
    downloadTextFile(`${safeName} - стандартный отчёт.csv`, reportToCsv(modelName, tables, get().reportCellEdits), 'text/csv;charset=utf-8');
    set({ syncStatus: 'saved', syncMessage: 'Стандартный отчёт выгружен в CSV для Excel.' });
  },

  async copyReport() {
    const { tables } = reportTables(get());
    try {
      await navigator.clipboard.writeText(reportToTsv(tables, get().reportCellEdits));
      set({ syncStatus: 'saved', syncMessage: 'Таблицы отчёта скопированы в буфер обмена.' });
    } catch {
      set({ syncStatus: 'warning', syncMessage: 'Браузер не разрешил доступ к буферу обмена.' });
    }
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
