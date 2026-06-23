import { useMemo } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import arrowDownIcon from '../../../shared/assets/icons/gpss-native/arrowdown_16.png';
import closeIcon from '../../../shared/assets/icons/gpss-native/closeblack_13.png';
import errorIcon from '../../../shared/assets/icons/gpss-native/error16.png';
import gotoIcon from '../../../shared/assets/icons/gpss-native/gotoerror_32.png';
import infoIcon from '../../../shared/assets/icons/gpss-native/info_16.png';
import warningIcon from '../../../shared/assets/icons/gpss-native/warning16.png';
import './IssuesPanel.css';

export function IssuesPanel() {
  const syncMessage = useTebEditorStore((state) => state.syncMessage);
  const syncStatus = useTebEditorStore((state) => state.syncStatus);
  const toggleIssuesPanel = useTebEditorStore((state) => state.toggleIssuesPanel);
  const issues = useTebEditorStore((state) => state.issues);
  const issueFilter = useTebEditorStore((state) => state.issueFilter);
  const setIssueFilter = useTebEditorStore((state) => state.setIssueFilter);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const focusProjectNode = useTebEditorStore((state) => state.focusProjectNode);

  const rows = useMemo(
    () => {
      const baseRows =
        syncStatus === 'offline'
          ? [
              {
                id: 'sync-offline',
                type: 'error' as const,
                description: syncMessage,
                library: 'База данных',
                className: 'WorkspaceSnapshot',
                instance: 'Текущая рабочая область',
                documentId: 'start' as const,
              },
              ...issues,
            ]
          : issues;

      return issueFilter === 'all' ? baseRows : baseRows.filter((row) => row.type === issueFilter);
    },
    [issueFilter, issues, syncMessage, syncStatus],
  );

  const allRows =
    syncStatus === 'offline'
      ? [{ type: 'error' as const }, ...issues]
      : issues;
  const errors = allRows.filter((row) => row.type === 'error').length;
  const warnings = allRows.filter((row) => row.type === 'warning').length;
  const messages = allRows.filter((row) => row.type === 'info').length;

  function goToIssue(row = rows[0]) {
    if (!row) {
      return;
    }

    if (row.documentId) {
      activateDocument(row.documentId);
    }

    if (row.sourceNodeId) {
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
        <button className={`issues-filter ${issueFilter === 'error' ? 'is-active' : ''}`} type="button" onClick={() => setIssueFilter(issueFilter === 'error' ? 'all' : 'error')}>
          <img src={errorIcon} alt="" aria-hidden="true" /> Ошибки ({errors})
        </button>
        <button className={`issues-filter ${issueFilter === 'warning' ? 'is-active' : ''}`} type="button" onClick={() => setIssueFilter(issueFilter === 'warning' ? 'all' : 'warning')}>
          <img src={warningIcon} alt="" aria-hidden="true" /> Предупреждения ({warnings})
        </button>
        <button className={`issues-filter ${issueFilter === 'info' ? 'is-active' : ''}`} type="button" onClick={() => setIssueFilter(issueFilter === 'info' ? 'all' : 'info')}>
          <img src={infoIcon} alt="" aria-hidden="true" /> Сообщения ({messages})
        </button>
        <button className="issues-go-source" type="button" onClick={() => goToIssue()}>
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
        {rows.map((row, index) => (
          <button className="issues-row" type="button" role="row" key={`${row.description}-${index}`} onClick={() => goToIssue(row)}>
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
