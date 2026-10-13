import type { ReportFragment, ReportFragmentKind } from '../../../../shared/types/project';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { projectReport, reportTitle } from '../../store/slices/finalReportSlice';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import '../BaseDocument/BaseDocument.css';
import '../ExperimentsDocument/ExperimentsDocument.css';
import './FinalReportDocument.css';

const KIND_LABELS: Record<ReportFragmentKind, string> = {
  heading: 'Заголовок раздела',
  text: 'Текст',
  code: 'Текст модели',
  table: 'Таблица',
  image: 'График',
};

function FragmentContent({ fragment }: { fragment: ReportFragment }) {
  const updateFragment = useTebEditorStore((state) => state.updateReportFragment);

  switch (fragment.Kind) {
    case 'heading':
      return (
        <input
          className="final-report-fragment__heading"
          aria-label="Текст заголовка"
          value={fragment.Text ?? ''}
          onChange={(event) => updateFragment(fragment.Id, { Text: event.target.value })}
        />
      );
    case 'text':
      return (
        <textarea
          aria-label="Текст фрагмента"
          rows={4}
          placeholder="Выводы, пояснения к результатам..."
          value={fragment.Text ?? ''}
          onChange={(event) => updateFragment(fragment.Id, { Text: event.target.value })}
        />
      );
    case 'code':
      return <pre>{fragment.Text}</pre>;
    case 'table':
      return (
        <table className="experiment-table">
          {fragment.Columns?.length ? (
            <thead>
              <tr>
                {fragment.Columns.map((column, index) => (
                  <th key={index}>{column}</th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {(fragment.Rows ?? []).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'image':
      return fragment.Image ? <img src={fragment.Image} alt={fragment.Title} /> : null;
  }
}

/** "Итоговый отчёт": fragments of simulation results collected for the final report, ordering and export. */
export function FinalReportDocument() {
  const project = useTebEditorStore((state) => state.project);
  const projectDirty = useTebEditorStore((state) => state.projectDirty);
  const projectBusy = useTebEditorStore((state) => state.projectBusy);
  const addReportText = useTebEditorStore((state) => state.addReportText);
  const updateFragment = useTebEditorStore((state) => state.updateReportFragment);
  const moveFragment = useTebEditorStore((state) => state.moveReportFragment);
  const removeFragment = useTebEditorStore((state) => state.removeReportFragment);
  const setReportTitle = useTebEditorStore((state) => state.setReportTitle);
  const exportReport = useTebEditorStore((state) => state.exportFinalReport);
  const saveProject = useTebEditorStore((state) => state.saveProject);

  if (!project) {
    return (
      <section className="placeholder-document final-report-document">
        <div className="placeholder-document__header">
          <h2>Итоговый отчёт</h2>
        </div>
        <p className="final-report-document__empty">Итоговый отчёт хранится в проекте. Откройте проект в документе «Проекты».</p>
      </section>
    );
  }

  const report = projectReport(project);
  const fragments = report.Fragments;

  return (
    <section className="placeholder-document final-report-document">
      <div className="placeholder-document__header">
        <h2>Итоговый отчёт: {project.Name}</h2>
        <div className="placeholder-document__actions">
          <IconButton label="Заголовок" title="Добавить заголовок раздела" onClick={() => addReportText('heading')} />
          <IconButton label="Текст" title="Добавить текст (выводы, пояснения)" onClick={() => addReportText('text')} />
          <IconButton label="Выгрузить HTML" title="Сохранить отчёт как веб-страницу" disabled={fragments.length === 0} onClick={() => exportReport('html')} />
          <IconButton
            label="Выгрузить в Word"
            title="Сохранить отчёт как документ Word (.doc) с графиками"
            disabled={fragments.length === 0}
            onClick={() => exportReport('word')}
          />
          <IconButton
            label="Сохранить проект"
            title="Сохранить проект вместе с отчётом"
            disabled={!projectDirty || projectBusy}
            onClick={() => void saveProject()}
          />
        </div>
      </div>

      <div className="final-report-document__body">
        <label className="final-report-document__title">
          Заголовок отчёта
          <input value={report.Title} placeholder={reportTitle(project)} onChange={(event) => setReportTitle(event.target.value)} />
        </label>

        {fragments.length === 0 ? (
          <p className="final-report-document__empty">
            Отчёт пуст. Откройте результат в «Результатах моделирования» и нажмите «Добавить в отчёт» на нужной вкладке: таблицы, текст модели и графики вкладки
            попадут сюда. Заголовки разделов и выводы добавляются кнопками «Заголовок» и «Текст».
          </p>
        ) : (
          <ol className="final-report-fragments">
            {fragments.map((fragment, index) => (
              <li key={fragment.Id} className={`final-report-fragment final-report-fragment--${fragment.Kind}`} aria-label={`Фрагмент ${index + 1}`}>
                <header>
                  <span className="final-report-fragment__kind">{KIND_LABELS[fragment.Kind]}</span>
                  {fragment.Kind === 'heading' ? null : (
                    <input
                      aria-label="Заголовок фрагмента"
                      placeholder={fragment.Kind === 'text' ? 'Без заголовка' : ''}
                      value={fragment.Title}
                      onChange={(event) => updateFragment(fragment.Id, { Title: event.target.value })}
                    />
                  )}
                  <span className="final-report-fragment__tools">
                    <button type="button" aria-label="Выше" title="Выше" disabled={index === 0} onClick={() => moveFragment(fragment.Id, 'up')}>
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Ниже"
                      title="Ниже"
                      disabled={index === fragments.length - 1}
                      onClick={() => moveFragment(fragment.Id, 'down')}
                    >
                      ↓
                    </button>
                    <button type="button" aria-label="Удалить из отчёта" title="Удалить из отчёта" onClick={() => removeFragment(fragment.Id)}>
                      ×
                    </button>
                  </span>
                </header>
                {fragment.Source ? <p className="final-report-fragment__source">{fragment.Source}</p> : null}
                <FragmentContent fragment={fragment} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
