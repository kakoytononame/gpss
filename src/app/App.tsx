import { useEffect } from 'react';
import { useTebEditorStore } from '../features/teb-editor/store/useTebEditorStore';
import { ModelTextDocument } from '../features/teb-editor/ui/ModelTextDocument';
import { SchemeDocument } from '../features/teb-editor/ui/SchemeDocument';
import { StartPageDocument } from '../features/teb-editor/ui/StartPageDocument';
import { TebEditorDocument } from '../features/teb-editor/ui/TebEditorDocument';
import { DocumentTabs } from '../widgets/desktop-shell/DocumentTabs';
import { ProjectExplorer } from '../widgets/desktop-shell/ProjectExplorer';
import { Ribbon } from '../widgets/desktop-shell/Ribbon';

function ActiveDocumentView() {
  const activeDocument = useTebEditorStore((state) => state.activeDocument);

  if (activeDocument === 'scheme') {
    return <SchemeDocument />;
  }

  if (activeDocument === 'start') {
    return <StartPageDocument />;
  }

  if (activeDocument === 'model-text') {
    return <ModelTextDocument />;
  }

  return <TebEditorDocument />;
}

export default function App() {
  const load = useTebEditorStore((state) => state.load);
  const teb = useTebEditorStore((state) => state.teb);
  const activeDocument = useTebEditorStore((state) => state.activeDocument);
  const openDocuments = useTebEditorStore((state) => state.openDocuments);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const closeDocument = useTebEditorStore((state) => state.closeDocument);
  const explorerVisible = useTebEditorStore((state) => state.explorerVisible);
  const syncMessage = useTebEditorStore((state) => state.syncMessage);
  const simulationState = useTebEditorStore((state) => state.simulationState);

  useEffect(() => {
    void load();
  }, [load]);

  const editorTitle = teb?.header || teb?.nameInModel || 'Экземпляр ТЭБа';

  return (
    <main className={`gpss-desktop ${explorerVisible ? '' : 'gpss-desktop--collapsed'}`}>
      <Ribbon />

      <div className="workbench">
        {explorerVisible ? <ProjectExplorer /> : null}

        <section className="document-host">
          <DocumentTabs activeDocument={activeDocument} editorTitle={editorTitle} openDocuments={openDocuments} onActivate={activateDocument} onClose={closeDocument} />
          <div className="document-surface">
            <ActiveDocumentView />
          </div>
        </section>
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
