import { useEffect, useState, type ReactNode } from 'react';
import { ModelLogDocument } from '../../features/teb-editor/ui/ModelLogDocument/ModelLogDocument';
import { ExperimentsDocument } from '../../features/teb-editor/ui/ExperimentsDocument/ExperimentsDocument';
import { DynamicFormDocument } from '../../features/teb-editor/ui/FormDocuments/DynamicFormDocument';
import { InputFormDocument } from '../../features/teb-editor/ui/FormDocuments/InputFormDocument';
import { ModelStateDocument } from '../../features/teb-editor/ui/ModelStateDocument/ModelStateDocument';
import { ModelTextDocument } from '../../features/teb-editor/ui/ModelTextDocument/ModelTextDocument';
import { ProjectsDocument } from '../../features/teb-editor/ui/ProjectsDocument/ProjectsDocument';
import { SchemeDocument } from '../../features/teb-editor/ui/SchemeDocument/SchemeDocument';
import { SimulationChartsDocument } from '../../features/teb-editor/ui/SimulationChartsDocument/SimulationChartsDocument';
import { StandardReportDocument } from '../../features/teb-editor/ui/StandardReportDocument/StandardReportDocument';
import { StartPageDocument } from '../../features/teb-editor/ui/StartPageDocument/StartPageDocument';
import { TebEditorDocument } from '../../features/teb-editor/ui/TebEditorDocument/TebEditorDocument';
import { SIMULATION_STATE_LABELS } from '../../features/teb-editor/model/simulationLabels';
import { useTebEditorStore } from '../../features/teb-editor/store/useTebEditorStore';
import { classNames } from '../../shared/lib/utils';
import type { ActiveDocument } from '../../shared/types/teb';
import { DocumentTabs } from '../../widgets/desktop-shell/DocumentTabs/DocumentTabs';
import { IssuesPanel } from '../../widgets/desktop-shell/IssuesPanel/IssuesPanel';
import { ProjectExplorer } from '../../widgets/desktop-shell/ProjectExplorer/ProjectExplorer';
import { RightDockPanel } from '../../widgets/desktop-shell/RightDockPanel/RightDockPanel';
import { Ribbon } from '../../widgets/desktop-shell/Ribbon/Ribbon';
import './App.css';

const DOCUMENT_VIEWS: Record<ActiveDocument, () => ReactNode> = {
  editor: () => <TebEditorDocument />,
  scheme: () => <SchemeDocument />,
  start: () => <StartPageDocument />,
  'model-text': () => <ModelTextDocument />,
  'std-report': () => <StandardReportDocument />,
  'model-log': () => <ModelLogDocument />,
  charts: () => <SimulationChartsDocument />,
  projects: () => <ProjectsDocument />,
  'model-state': () => <ModelStateDocument />,
  experiments: () => <ExperimentsDocument />,
  'input-form': () => <InputFormDocument />,
  'dynamic-form': () => <DynamicFormDocument />,
};

function ActiveDocumentView() {
  const activeDocument = useTebEditorStore((state) => state.activeDocument);

  if (!activeDocument) {
    return (
      <div className="empty-document-surface" aria-label="Нет открытых документов">
        <span>Нет открытых документов</span>
      </div>
    );
  }

  return DOCUMENT_VIEWS[activeDocument]();
}

/** Loads the TEB from the API, then restores the saved workspace layout. */
function useInitialLoad() {
  const load = useTebEditorStore((state) => state.load);
  const loadWorkspaceSnapshot = useTebEditorStore((state) => state.loadWorkspaceSnapshot);
  const loadExampleModel = useTebEditorStore((state) => state.loadExampleModel);

  useEffect(() => {
    let cancelled = false;

    void load()
      .then(() => (cancelled ? undefined : loadWorkspaceSnapshot({ quiet: true })))
      .then(() => (cancelled ? undefined : loadExampleModel()));

    return () => {
      cancelled = true;
    };
  }, [load, loadWorkspaceSnapshot, loadExampleModel]);
}

export default function App() {
  const editorTitle = useTebEditorStore((state) => state.teb?.header || state.teb?.nameInModel || 'Экземпляр ТЭБа');
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
  useInitialLoad();

  const desktopClassName = classNames(
    'gpss-desktop',
    !explorerVisible && 'gpss-desktop--collapsed',
    explorerAutoHide && 'gpss-desktop--explorer-auto-hide',
    !rightPanelVisible && 'gpss-desktop--right-collapsed',
  );

  return (
    <main className={desktopClassName}>
      <Ribbon />

      <div className="workbench">
        {explorerVisible ? (
          <div className="explorer-dock">
            <ProjectExplorer autoHide={explorerAutoHide} onToggleAutoHide={() => setExplorerAutoHide((value) => !value)} />
          </div>
        ) : null}

        <section className={classNames('document-host', issuesPanelVisible && 'document-host--with-issues')}>
          <DocumentTabs
            activeDocument={activeDocument}
            editorTitle={editorTitle}
            openDocuments={openDocuments}
            onActivate={activateDocument}
            onClose={closeDocument}
          />
          <div className="document-surface">
            <ActiveDocumentView />
          </div>
          {issuesPanelVisible ? <IssuesPanel /> : null}
        </section>

        {rightPanelVisible ? <RightDockPanel /> : null}
      </div>

      <footer className="global-status" role="status">
        <span>Приложение готово к работе</span>
        <span>
          {simulationState !== 'idle' ? `Моделирование: ${SIMULATION_STATE_LABELS[simulationState]}. ` : ''}
          {syncMessage}
        </span>
      </footer>
    </main>
  );
}
