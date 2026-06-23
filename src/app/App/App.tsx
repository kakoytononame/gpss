import { useEffect, useState } from 'react';
import { ModelLogDocument } from '../../features/teb-editor/ui/ModelLogDocument/ModelLogDocument';
import { ModelTextDocument } from '../../features/teb-editor/ui/ModelTextDocument/ModelTextDocument';
import { SchemeDocument } from '../../features/teb-editor/ui/SchemeDocument/SchemeDocument';
import { StandardReportDocument } from '../../features/teb-editor/ui/StandardReportDocument/StandardReportDocument';
import { StartPageDocument } from '../../features/teb-editor/ui/StartPageDocument/StartPageDocument';
import { TebEditorDocument } from '../../features/teb-editor/ui/TebEditorDocument/TebEditorDocument';
import { useTebEditorStore } from '../../features/teb-editor/store/useTebEditorStore';
import { DocumentTabs } from '../../widgets/desktop-shell/DocumentTabs/DocumentTabs';
import { IssuesPanel } from '../../widgets/desktop-shell/IssuesPanel/IssuesPanel';
import { ProjectExplorer } from '../../widgets/desktop-shell/ProjectExplorer/ProjectExplorer';
import { RightDockPanel } from '../../widgets/desktop-shell/RightDockPanel/RightDockPanel';
import { Ribbon } from '../../widgets/desktop-shell/Ribbon/Ribbon';
import './App.css';

function ActiveDocumentView() {
  const activeDocument = useTebEditorStore((state) => state.activeDocument);

  if (!activeDocument) {
    return (
      <div className="empty-document-surface" aria-label="Нет открытых документов">
        <span>Нет открытых документов</span>
      </div>
    );
  }

  if (activeDocument === 'scheme') {
    return <SchemeDocument />;
  }

  if (activeDocument === 'start') {
    return <StartPageDocument />;
  }

  if (activeDocument === 'model-text') {
    return <ModelTextDocument />;
  }

  if (activeDocument === 'std-report') {
    return <StandardReportDocument />;
  }

  if (activeDocument === 'model-log') {
    return <ModelLogDocument />;
  }

  return <TebEditorDocument />;
}

export default function App() {
  const load = useTebEditorStore((state) => state.load);
  const loadWorkspaceSnapshot = useTebEditorStore((state) => state.loadWorkspaceSnapshot);
  const teb = useTebEditorStore((state) => state.teb);
  const activeDocument = useTebEditorStore((state) => state.activeDocument);
  const openDocuments = useTebEditorStore((state) => state.openDocuments);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const closeDocument = useTebEditorStore((state) => state.closeDocument);
  const explorerVisible = useTebEditorStore((state) => state.explorerVisible);
  const rightPanelVisible = useTebEditorStore((state) => state.rightPanelVisible);
  const issuesPanelVisible = useTebEditorStore((state) => state.issuesPanelVisible);
  const syncMessage = useTebEditorStore((state) => state.syncMessage);
  const simulationState = useTebEditorStore((state) => state.simulationState);
  const [explorerAutoHide, setExplorerAutoHide] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void load().then(() => {
      if (!cancelled) {
        loadWorkspaceSnapshot();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [load, loadWorkspaceSnapshot]);

  const editorTitle = teb?.header || teb?.nameInModel || 'Экземпляр ТЭБа';
  const desktopClassName = [
    'gpss-desktop',
    explorerVisible ? '' : 'gpss-desktop--collapsed',
    explorerAutoHide ? 'gpss-desktop--explorer-auto-hide' : '',
    rightPanelVisible ? '' : 'gpss-desktop--right-collapsed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <main className={desktopClassName}>
      <Ribbon />

      <div className="workbench">
        {explorerVisible ? (
          <div className="explorer-dock">
            <ProjectExplorer autoHide={explorerAutoHide} onToggleAutoHide={() => setExplorerAutoHide((value) => !value)} />
          </div>
        ) : null}

        <section className={`document-host ${issuesPanelVisible ? 'document-host--with-issues' : ''}`}>
          <DocumentTabs activeDocument={activeDocument} editorTitle={editorTitle} openDocuments={openDocuments} onActivate={activateDocument} onClose={closeDocument} />
          <div className="document-surface">
            <ActiveDocumentView />
          </div>
          {issuesPanelVisible ? <IssuesPanel /> : null}
        </section>

        {rightPanelVisible ? <RightDockPanel /> : null}
      </div>

      <footer className="global-status">
        <span>Приложение готово к работе</span>
        <span>
          {simulationState !== 'idle' ? `Моделирование: ${simulationState}. ` : ''}
          {syncMessage}
        </span>
      </footer>
    </main>
  );
}
