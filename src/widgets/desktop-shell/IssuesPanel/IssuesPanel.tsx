import { useMemo } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import arrowDownIcon from '../../../shared/assets/icons/gpss-native/arrowdown_16.png';
import closeIcon from '../../../shared/assets/icons/gpss-native/closeblack_13.png';
import errorIcon from '../../../shared/assets/icons/gpss-native/error16.png';
import gotoIcon from '../../../shared/assets/icons/gpss-native/gotoerror_32.png';
import infoIcon from '../../../shared/assets/icons/gpss-native/info_16.png';
import warningIcon from '../../../shared/assets/icons/gpss-native/warning16.png';
import type { IssueItem, IssueType } from '../../../shared/types/teb';
import './IssuesPanel.css';

const FILTERS: Array<{ type: IssueType; label: string; icon: string }> = [
  { type: 'error', label: 'Ошибки', icon: errorIcon },
  { type: 'warning', label: 'Предупреждения', icon: warningIcon },
  { type: 'info', label: 'Сообщения', icon: infoIcon },
];

/** Failed server synchronisation is surfaced as an error row next to model issues. */
function useIssueRows(): IssueItem[] {
  const syncStatus = useTebEditorStore((state) => state.syncStatus);
  const syncMessage = useTebEditorStore((state) => state.syncMessage);
  const issues = useTebEditorStore((state) => state.issues);

  return useMemo(() => {
    if (syncStatus !== 'offline') {
      return issues;
    }

    const syncIssue: IssueItem = {
      id: 'sync-offline',
      type: 'error',
      description: syncMessage,
      library: 'База данных',
      className: 'WorkspaceSnapshot',
      instance: 'Текущая рабочая область',
      documentId: 'start',
    };
    return [syncIssue, ...issues];
  }, [issues, syncMessage, syncStatus]);
}

export function IssuesPanel() {
  const toggleIssuesPanel = useTebEditorStore((state) => state.toggleIssuesPanel);
  const issueFilter = useTebEditorStore((state) => state.issueFilter);
  const setIssueFilter = useTebEditorStore((state) => state.setIssueFilter);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const focusProjectNode = useTebEditorStore((state) => state.focusProjectNode);
  const allRows = useIssueRows();
  const rows = issueFilter === 'all' ? allRows : allRows.filter((row) => row.type === issueFilter);

  function goToIssue(row: IssueItem | undefined = rows[0]) {
    if (row?.documentId) {
      activateDocument(row.documentId);
    }

    if (row?.sourceNodeId) {
      focusProjectNode(row.sourceNodeId);
    }
  }

  return (
    <section className="issues-panel" aria-label="Замечания и ошибки">
      <div className="issues-caption">
        <span>Замечания и ошибки</span>
        <span className="issues-caption__grip" aria-hidden="true">
          ........................................................................................................
        </span>
        <button type="button" title="Меню панели" aria-label="Меню панели">
          <img src={arrowDownIcon} alt="" aria-hidden="true" />
        </button>
        <button type="button" title="Закрыть панель" aria-label="Закрыть панель" onClick={toggleIssuesPanel}>
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>
      <div className="issues-toolbar">
        {FILTERS.map(({ type, label, icon }) => (
          <button
            className={`issues-filter ${issueFilter === type ? 'is-active' : ''}`}
            key={type}
            type="button"
            aria-pressed={issueFilter === type}
            onClick={() => setIssueFilter(issueFilter === type ? 'all' : type)}
          >
            <img src={icon} alt="" aria-hidden="true" /> {label} ({allRows.filter((row) => row.type === type).length})
          </button>
        ))}
        <button className="issues-go-source" type="button" disabled={!rows.length} onClick={() => goToIssue()}>
          <img src={gotoIcon} alt="" aria-hidden="true" /> Перейти к источнику замечания
        </button>
      </div>
      <div className="issues-table" role="table">
        <div className="issues-row issues-row--head" role="row">
          <span>Описание</span>
          <span>Библиотека</span>
          <span>Класс тэбов</span>
          <span>Экземпляр тэба</span>
        </div>
        {rows.map((row) => (
          <button className="issues-row" type="button" role="row" key={row.id} onClick={() => goToIssue(row)}>
            <span>{row.description}</span>
            <span>{row.library}</span>
            <span>{row.className}</span>
            <span>{row.instance}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
