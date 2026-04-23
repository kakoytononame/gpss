import type { ActiveDocument } from '../../shared/types/teb';

interface DocumentTabsProps {
  activeDocument: ActiveDocument;
  editorTitle: string;
  openDocuments: ActiveDocument[];
  onActivate: (documentId: ActiveDocument) => void;
  onClose: (documentId: ActiveDocument) => void;
}

const documentLabels: Record<ActiveDocument, string> = {
  editor: 'Редактор ТЭБа',
  scheme: 'Структурная схема',
  start: 'Стартовая страница',
  'model-text': 'Текст модели',
  'std-report': 'Стандартный отчёт',
  'model-log': 'Журнал моделирования',
};

export function DocumentTabs({ activeDocument, editorTitle, openDocuments, onActivate, onClose }: DocumentTabsProps) {
  const labels: Record<ActiveDocument, string> = {
    ...documentLabels,
    editor: editorTitle || documentLabels.editor,
  };

  return (
    <div className="document-tabs" role="tablist" aria-label="Открытые документы">
      {openDocuments.map((documentId) => (
        <div className={`document-tab ${activeDocument === documentId ? 'is-active' : ''}`} key={documentId} role="tab" aria-selected={activeDocument === documentId}>
          <button className="document-tab__button" type="button" onClick={() => onActivate(documentId)}>
            <span className="document-tab__label" title={labels[documentId]}>
              {labels[documentId]}
            </span>
          </button>
          <button className="document-tab__close" type="button" aria-label={`Закрыть ${labels[documentId]}`} title={`Закрыть ${labels[documentId]}`} onClick={() => onClose(documentId)}>
            x
          </button>
        </div>
      ))}
    </div>
  );
}
