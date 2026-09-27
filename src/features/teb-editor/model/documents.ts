import type { ActiveDocument } from '../../../shared/types/teb';

export const DEFAULT_OPEN_DOCUMENTS: ActiveDocument[] = ['editor', 'scheme', 'start', 'model-text'];

export const DOCUMENT_TITLES: Record<ActiveDocument, string> = {
  editor: 'Редактор ТЭБа',
  scheme: 'Структурная схема',
  start: 'Стартовая страница',
  'model-text': 'Текст модели',
  'std-report': 'Стандартный отчёт',
  'model-log': 'Журнал моделирования',
};

const DOCUMENT_STATUS_LABELS: Record<ActiveDocument, string> = {
  editor: 'редактор ТЭБа',
  scheme: 'структурная схема',
  start: 'стартовая страница',
  'model-text': 'текст модели',
  'std-report': 'стандартный отчёт',
  'model-log': 'журнал моделирования',
};

/** Project explorer nodes that open a document other than the TEB editor. */
const NODE_DOCUMENTS: Record<string, ActiveDocument> = {
  scheme: 'scheme',
  'model-text': 'model-text',
  'std-report': 'std-report',
  'model-log': 'model-log',
  'project-home': 'start',
};

const DOCUMENT_NODES: Record<ActiveDocument, string> = {
  editor: 'library',
  scheme: 'scheme',
  'model-text': 'model-text',
  'std-report': 'std-report',
  'model-log': 'model-log',
  start: 'project-home',
};

export function nodeToDocument(nodeId: string): ActiveDocument {
  return NODE_DOCUMENTS[nodeId] ?? 'editor';
}

export function nodeForDocument(documentId: ActiveDocument): string {
  return DOCUMENT_NODES[documentId];
}

export function documentLabel(documentId: ActiveDocument): string {
  return DOCUMENT_STATUS_LABELS[documentId];
}

export function withDocument(openDocuments: ActiveDocument[], documentId: ActiveDocument): ActiveDocument[] {
  return openDocuments.includes(documentId) ? openDocuments : [...openDocuments, documentId];
}
