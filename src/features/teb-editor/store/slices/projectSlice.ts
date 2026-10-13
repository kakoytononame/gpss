import type { StateCreator } from 'zustand';
import { createProjectApi } from '../../../../shared/api/projectApi';
import type { GenerationMessage, StudioProject } from '../../../../shared/types/project';
import type { IssueItem, IssueType } from '../../../../shared/types/teb';
import { withDocument } from '../../model/documents';
import {
  applyDocumentToNode,
  applySchemeView,
  findNode,
  replaceNode,
  replaceSchemeAtPath,
  schemeAtPath,
  tebNodeToDocument,
  toSchemeView,
} from '../../model/projectScheme';
import { createHistory, safeTabForDocument, syncFailureMessage } from '../helpers';
import { initialResultState } from './resultSlice';
import type { ProjectSliceActions, ProjectSliceState, TebEditorStore } from '../types';

const GENERATION_ISSUE_PREFIX = 'gen-';

const SEVERITY_TYPES: Record<GenerationMessage['Severity'], IssueType> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};

export const initialProjectState: ProjectSliceState = {
  projects: [],
  projectsLoading: false,
  project: null,
  projectModelIndex: 0,
  schemePath: [],
  projectDirty: false,
  projectBusy: false,
  generation: null,
  editingNodeId: null,
  projectFormIndex: 0,
};

function currentModelIndex(project: StudioProject): number {
  const current = project.Models.findIndex((model) => model.IsCurrent);
  return current >= 0 ? current : 0;
}

function generationIssues(messages: GenerationMessage[], modelName: string): IssueItem[] {
  return messages.map((message, index) => ({
    id: `${GENERATION_ISSUE_PREFIX}${index}`,
    type: SEVERITY_TYPES[message.Severity] ?? 'info',
    description: message.Message,
    library: modelName,
    className: 'Генератор модели',
    instance: message.Teb ?? 'Модель',
    documentId: 'scheme',
    sourceNodeId: message.NodeId ?? undefined,
  }));
}

/**
 * Simulation projects in the GPSS Studio format: import, storage on the server, the structural scheme
 * of the selected model (with navigation into composite TEBs), editing TEBs and model generation.
 */
export const createProjectSlice: StateCreator<TebEditorStore, [], [], ProjectSliceState & ProjectSliceActions> = (set, get) => {
  const api = () => createProjectApi(get().apiBaseUrl);

  const fail = (error: unknown, prefix: string) =>
    set({
      projectBusy: false,
      projectsLoading: false,
      syncStatus: 'offline',
      syncMessage: `${prefix}: ${error instanceof Error ? error.message : syncFailureMessage(error)}`,
    });

  /** Shows the scheme level at the current path in the structural scheme document. */
  const showSchemeLevel = (project: StudioProject, modelIndex: number, path: string[]) => {
    const scheme = schemeAtPath(project.Models[modelIndex], path);
    const view = scheme ? toSchemeView(scheme) : { nodes: [], links: [] };
    set({ schemeNodes: view.nodes, schemeLinks: view.links, schemeSelection: null, schemePath: path, projectModelIndex: modelIndex });
  };

  /** `keepLayout` leaves the open documents as they are (workspace restore). */
  const openLoadedProject = (project: StudioProject, message: string, keepLayout = false) => {
    const modelIndex = currentModelIndex(project);
    const model = project.Models[modelIndex];
    const preferred = model?.Scheme ? 'scheme' : 'model-text';
    set((state) => ({
      project,
      projectDirty: false,
      projectBusy: false,
      generation: null,
      editingNodeId: null,
      projectFormIndex: 0,
      simulationMonitoring: null,
      simulationStartCount: 1,
      modelText: model?.ModelText ?? state.modelText,
      simulationSessionId: null,
      simulationState: 'idle',
      simulationReport: null,
      ...initialResultState,
      openDocuments: keepLayout ? state.openDocuments : withDocument(state.openDocuments, preferred),
      activeDocument: keepLayout ? state.activeDocument : preferred,
      syncStatus: project.ImportNotes.length > 0 ? 'warning' : 'saved',
      syncMessage: project.ImportNotes.length > 0 ? `${message} Замечаний импорта: ${project.ImportNotes.length}.` : message,
    }));
    showSchemeLevel(project, modelIndex, []);
    void get().loadResults();
  };

  return {
    ...initialProjectState,

    async loadProjects() {
      set({ projectsLoading: true });
      try {
        set({ projects: await api().list(), projectsLoading: false });
      } catch (error) {
        fail(error, 'Список проектов не получен');
      }
    },

    async createProject(name, description) {
      set({ projectBusy: true, syncStatus: 'syncing', syncMessage: 'Создание проекта...' });
      try {
        const project = await api().create(name, description);
        openLoadedProject(project, `Проект «${project.Name}» создан.`);
        await get().loadProjects();
      } catch (error) {
        fail(error, 'Проект не создан');
      }
    },

    async importProject(file) {
      set({ projectBusy: true, syncStatus: 'syncing', syncMessage: `Импорт «${file.name}»...` });
      try {
        const project = await api().importFile(file);
        openLoadedProject(project, `Проект «${project.Name}» импортирован: моделей ${project.Models.length}, библиотек ТЭБов ${project.Libraries.length}.`);
        await get().loadProjects();
      } catch (error) {
        fail(error, 'Импорт не выполнен');
      }
    },

    async openProject(id, { keepLayout = false } = {}) {
      set({ projectBusy: true, syncStatus: 'syncing', syncMessage: 'Открытие проекта...' });
      try {
        const project = await api().get(id);
        openLoadedProject(project, `Открыт проект «${project.Name}».`, keepLayout);
      } catch (error) {
        fail(error, 'Проект не открыт');
      }
    },

    closeProject() {
      set({
        ...initialProjectState,
        ...initialResultState,
        projects: get().projects,
        simulationMonitoring: null,
        simulationStartCount: 1,
        syncStatus: 'saved',
        syncMessage: 'Проект закрыт.',
      });
      get().resetScheme();
    },

    async saveProject() {
      get().flushSchemeToProject();
      const project = get().project;
      if (!project) {
        return;
      }

      set({ projectBusy: true, syncStatus: 'syncing', syncMessage: 'Сохранение проекта...' });
      try {
        await api().save({ ...project, Models: project.Models.map((model, index) => ({ ...model, IsCurrent: index === get().projectModelIndex })) });
        set({ projectBusy: false, projectDirty: false, syncStatus: 'saved', syncMessage: `Проект «${project.Name}» сохранён.` });
        await get().loadProjects();
      } catch (error) {
        fail(error, 'Проект не сохранён');
      }
    },

    async deleteProject(id) {
      set({ projectBusy: true });
      try {
        await api().remove(id);
        if (get().project?.Id === id) {
          get().closeProject();
        }

        set({ projectBusy: false, syncStatus: 'saved', syncMessage: 'Проект удалён.' });
        await get().loadProjects();
      } catch (error) {
        fail(error, 'Проект не удалён');
      }
    },

    selectProjectModel(index) {
      get().flushSchemeToProject();
      const project = get().project;
      const model = project?.Models[index];
      if (!project || !model) {
        return;
      }

      set({
        modelText: model.ModelText ?? '',
        simulationSessionId: null,
        simulationState: 'idle',
        projectFormIndex: 0,
        simulationMonitoring: null,
        simulationStartCount: 1,
        syncMessage: `Выбрана модель «${model.Name}».`,
      });
      showSchemeLevel(project, index, []);
    },

    enterComposite(nodeId) {
      get().flushSchemeToProject();
      const { project, projectModelIndex, schemePath } = get();
      const scheme = schemeAtPath(project?.Models[projectModelIndex], schemePath);
      const node = scheme?.Nodes.find((item) => item.Id === nodeId);
      if (!project || !node?.Child) {
        return;
      }

      showSchemeLevel(project, projectModelIndex, [...schemePath, nodeId]);
      set({ syncStatus: 'saved', syncMessage: `Открыта схема композитного ТЭБа «${node.Header}».` });
    },

    leaveToSchemeLevel(depth) {
      get().flushSchemeToProject();
      const { project, projectModelIndex, schemePath } = get();
      if (project) {
        showSchemeLevel(project, projectModelIndex, schemePath.slice(0, Math.max(0, depth)));
      }
    },

    openSchemeNode(nodeId) {
      const { project, projectModelIndex, schemePath } = get();
      if (!project) {
        get().activateDocument('editor');
        return;
      }

      const node = schemeAtPath(project.Models[projectModelIndex], schemePath)?.Nodes.find((item) => item.Id === nodeId);
      if (!node) {
        // Boundary connector of the composite TEB: nothing to open.
        return;
      }

      if (node.Kind === 'composite' && node.Child) {
        get().enterComposite(nodeId);
        return;
      }

      get().openProjectTeb(nodeId);
    },

    flushSchemeToProject() {
      const { project, projectModelIndex, schemePath, schemeNodes, schemeLinks } = get();
      const model = project?.Models[projectModelIndex];
      const scheme = schemeAtPath(model, schemePath);
      if (!project || !model || !scheme) {
        return;
      }

      const updated = applySchemeView(scheme, schemeNodes, schemeLinks);
      if (JSON.stringify(updated) === JSON.stringify(scheme)) {
        return;
      }

      const models = project.Models.map((item, index) => (index === projectModelIndex ? replaceSchemeAtPath(item, schemePath, updated) : item));
      set({ project: { ...project, Models: models }, projectDirty: true });
    },

    openProjectTeb(nodeId) {
      get().flushSchemeToProject();
      const { project, projectModelIndex } = get();
      const node = findNode(project?.Models[projectModelIndex]?.Scheme, nodeId);
      if (!node) {
        return;
      }

      const teb = tebNodeToDocument(node);
      set((state) => ({
        teb,
        source: 'project',
        mode: 'class',
        loadError: '',
        editingNodeId: nodeId,
        activeTab: safeTabForDocument(state.activeTab, teb.type),
        openDocuments: withDocument(state.openDocuments, 'editor'),
        activeDocument: 'editor',
        syncStatus: 'saved',
        syncMessage: `Открыт ТЭБ «${node.Header}» проекта.`,
        ...createHistory(teb),
      }));
    },

    applyTebToProject(message) {
      const { project, projectModelIndex, editingNodeId, teb } = get();
      const model = project?.Models[projectModelIndex];
      const node = editingNodeId ? findNode(model?.Scheme, editingNodeId) : null;
      if (!project || !model?.Scheme || !node || !teb) {
        return;
      }

      const updated = applyDocumentToNode(node, teb);
      const models = project.Models.map((item, index) =>
        index === projectModelIndex && item.Scheme ? { ...item, Scheme: replaceNode(item.Scheme, updated) } : item,
      );
      set((state) => ({
        project: { ...project, Models: models },
        projectDirty: true,
        schemeNodes: state.schemeNodes.map((view) =>
          view.id === updated.Id ? { ...view, label: updated.Header, nameInModel: updated.NameInModel ?? undefined } : view,
        ),
        syncStatus: 'saved',
        syncMessage: message,
      }));
    },

    updateProjectLink(linkId, patch) {
      get().flushSchemeToProject();
      const { project, projectModelIndex, schemePath } = get();
      const model = project?.Models[projectModelIndex];
      const scheme = schemeAtPath(model, schemePath);
      if (!project || !model || !scheme?.Links.some((link) => link.Id === linkId)) {
        return;
      }

      const updated = { ...scheme, Links: scheme.Links.map((link) => (link.Id === linkId ? { ...link, ...patch } : link)) };
      const models = project.Models.map((item, index) => (index === projectModelIndex ? replaceSchemeAtPath(item, schemePath, updated) : item));
      set({ project: { ...project, Models: models }, projectDirty: true, syncStatus: 'saved', syncMessage: 'Свойства связи изменены.' });
    },

    async generateModelText() {
      get().flushSchemeToProject();
      const { project, projectModelIndex } = get();
      const model = project?.Models[projectModelIndex];
      if (!project || !model?.Scheme) {
        set({ syncStatus: 'warning', syncMessage: 'Откройте проект со структурной схемой, чтобы сгенерировать текст модели.' });
        return;
      }

      set({ projectBusy: true, syncStatus: 'syncing', syncMessage: 'Генерация текста модели...' });
      try {
        const generation = await api().generate(model.Scheme, model.Name);
        const issues = generationIssues(generation.Messages, model.Name);
        const models = project.Models.map((item, index) => (index === projectModelIndex ? { ...item, ModelText: generation.Text } : item));
        const total = generation.Text.split('\n').length;

        set((state) => ({
          generation,
          projectBusy: false,
          project: { ...project, Models: models },
          projectDirty: true,
          modelText: generation.Text,
          simulationSessionId: null,
          simulationState: 'idle',
          issues: [...state.issues.filter((issue) => !issue.id.startsWith(GENERATION_ISSUE_PREFIX)), ...issues],
          issuesPanelVisible: state.issuesPanelVisible || issues.some((issue) => issue.type !== 'info'),
          openDocuments: withDocument(state.openDocuments, 'model-text'),
          activeDocument: generation.Success ? 'model-text' : state.activeDocument,
          syncStatus: generation.Success ? 'saved' : 'warning',
          syncMessage: generation.Success
            ? `Текст модели сгенерирован: ${total} строк, из них автоматически ${generation.GeneratedLines}.`
            : `Генерация завершена с ошибками: ${issues.filter((issue) => issue.type === 'error').length}. См. «Замечания и ошибки».`,
        }));
      } catch (error) {
        fail(error, 'Текст модели не сгенерирован');
      }
    },
  };
};
