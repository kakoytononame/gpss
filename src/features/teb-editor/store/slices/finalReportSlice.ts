import type { StateCreator } from 'zustand';
import { createId, downloadTextFile, reorderItems } from '../../../../shared/lib/utils';
import type { ProjectReport, ReportFragment, StudioProject } from '../../../../shared/types/project';
import { withDocument } from '../../model/documents';
import { reportFileName, reportToHtml, reportToMhtml } from '../../model/finalReport';
import type { FinalReportSliceActions, TebEditorStore } from '../types';

export function projectReport(project: StudioProject): ProjectReport {
  return project.Report ?? { Title: '', Fragments: [] };
}

/** Title shown and exported when the report has none: "Отчёт по проекту «…»". */
export function reportTitle(project: StudioProject): string {
  return projectReport(project).Title.trim() || `Отчёт по проекту «${project.Name}»`;
}

/**
 * Final ("virtual") report of the project: fragments added from the tabs of simulation results, own headings
 * and texts, ordering and export to HTML / Word. The report is part of the project document.
 */
export const createFinalReportSlice: StateCreator<TebEditorStore, [], [], FinalReportSliceActions> = (set, get) => {
  /** Changes the report of the open project; without a project the user is asked to open one. */
  const updateReport = (update: (report: ProjectReport) => ProjectReport, message: string) => {
    const project = get().project;
    if (!project) {
      set({ syncStatus: 'warning', syncMessage: 'Итоговый отчёт хранится в проекте: откройте или создайте проект.' });
      return false;
    }

    set({ project: { ...project, Report: update(projectReport(project)) }, projectDirty: true, syncStatus: 'saved', syncMessage: message });
    return true;
  };

  const updateFragments = (update: (fragments: ReportFragment[]) => ReportFragment[], message: string) =>
    updateReport((report) => ({ ...report, Fragments: update(report.Fragments) }), message);

  return {
    openFinalReport() {
      set((state) => ({ openDocuments: withDocument(state.openDocuments, 'final-report'), activeDocument: 'final-report' }));
    },

    addReportFragments(drafts) {
      if (drafts.length === 0) {
        set({ syncStatus: 'warning', syncMessage: 'На вкладке нет таблиц, текста или графиков для отчёта.' });
        return;
      }

      updateFragments(
        (fragments) => [...fragments, ...drafts.map((draft) => ({ ...draft, Id: createId() }))],
        `В итоговый отчёт добавлено фрагментов: ${drafts.length}. Сохраните проект, чтобы сохранить отчёт.`,
      );
    },

    addReportText(kind) {
      updateFragments(
        (fragments) => [
          ...fragments,
          kind === 'heading' ? { Id: createId(), Kind: 'heading', Title: '', Text: 'Новый раздел' } : { Id: createId(), Kind: 'text', Title: '', Text: '' },
        ],
        kind === 'heading' ? 'В отчёт добавлен заголовок раздела.' : 'В отчёт добавлен текст.',
      );
    },

    updateReportFragment(id, patch) {
      updateFragments((fragments) => fragments.map((fragment) => (fragment.Id === id ? { ...fragment, ...patch } : fragment)), 'Фрагмент отчёта изменён.');
    },

    moveReportFragment(id, direction) {
      updateFragments(
        (fragments) =>
          reorderItems(
            fragments,
            fragments.findIndex((fragment) => fragment.Id === id),
            direction,
          ),
        'Порядок фрагментов отчёта изменён.',
      );
    },

    removeReportFragment(id) {
      updateFragments((fragments) => fragments.filter((fragment) => fragment.Id !== id), 'Фрагмент удалён из отчёта.');
    },

    setReportTitle(title) {
      updateReport((report) => ({ ...report, Title: title }), 'Заголовок отчёта изменён.');
    },

    exportFinalReport(format) {
      const project = get().project;
      const fragments = project ? projectReport(project).Fragments : [];
      if (!project || fragments.length === 0) {
        set({ syncStatus: 'warning', syncMessage: 'Итоговый отчёт пуст: добавьте в него фрагменты результатов.' });
        return;
      }

      const report = { Title: reportTitle(project), Fragments: fragments };
      if (format === 'word') {
        downloadTextFile(reportFileName(report.Title, 'doc'), reportToMhtml(report), 'application/msword');
      } else {
        downloadTextFile(reportFileName(report.Title, 'html'), reportToHtml(report), 'text/html;charset=utf-8');
      }

      set({ syncStatus: 'saved', syncMessage: `Отчёт «${report.Title}» выгружен${format === 'word' ? ' для Word' : ' в HTML'}.` });
    },
  };
};
