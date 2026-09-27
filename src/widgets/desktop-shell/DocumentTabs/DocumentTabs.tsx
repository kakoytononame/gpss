import { DOCUMENT_TITLES } from '../../../features/teb-editor/model/documents';
import type { ActiveDocument } from '../../../shared/types/teb';
import './DocumentTabs.css';

interface DocumentTabsProps {
  activeDocument: ActiveDocument | null;
  editorTitle: string;
  openDocuments: ActiveDocument[];
  onActivate: (documentId: ActiveDocument) => void;
  onClose: (documentId: ActiveDocument) => void;
}

export function DocumentTabs({ activeDocument, editorTitle, openDocuments, onActivate, onClose }: DocumentTabsProps) {
  const titleOf = (documentId: ActiveDocument) => (documentId === 'editor' && editorTitle ? editorTitle : DOCUMENT_TITLES[documentId]);

  return (
    <div className="document-tabs" role="tablist" aria-label="Открытые документы">
      {openDocuments.map((documentId) => {
        const title = titleOf(documentId);
        const isActive = activeDocument === documentId;

        return (
          <div className={`document-tab ${isActive ? 'is-active' : ''}`} key={documentId} role="tab" aria-selected={isActive}>
            <button className="document-tab__button" type="button" onClick={() => onActivate(documentId)}>
              <span className="document-tab__label" title={title}>
                {title}
              </span>
            </button>
            <button
              className="document-tab__close"
              type="button"
              aria-label={`Закрыть ${title}`}
              title={`Закрыть ${title}`}
              onClick={() => onClose(documentId)}
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
