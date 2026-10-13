import { createId } from '../../../shared/lib/utils';
import type {
  TransferMode,
  ConnectedBlockMode,
  StudioModel,
  StudioTebLink,
  StudioTebNode,
  StudioTebPort,
  TebKind,
  TebScheme,
} from '../../../shared/types/project';
import type { GpssEntity, SchemeLink, SchemeNode, SchemeNodeKind, TebDocument, TebPort } from '../../../shared/types/teb';

/** Transaction transfer modes of TEB outputs with their GPSS Studio names. */
export const TRANSFER_MODE_LABELS: Record<TransferMode, string> = {
  DirectOrSplit: 'Прямой переход или копирование',
  FirstAvail: 'Переход по первому доступному соединению',
  Random: 'Случайный переход по любому соединению',
  CustomModel: 'Определяется моделью',
};

const TRANSFER_MODES = Object.keys(TRANSFER_MODE_LABELS) as TransferMode[];

/** Labels shown for the special "connected block" modes of TEB inputs and outputs. */
export const FIRST_BLOCK_LABEL = 'Первый блок модели';
export const LAST_BLOCK_LABEL = 'Последний блок модели';

const CLASS_TYPES: Record<TebKind, string> = {
  simple: 'SimpleTebClass',
  composite: 'CompositeTebClass',
  data: 'GlobalDataTebClass',
  transaction: 'TransactionTebClass',
};

const DEFAULT_COLORS: Record<TebKind, { background: string; border: string }> = {
  simple: { background: '#87cefa', border: '#4f96cc' },
  composite: { background: '#ffd27f', border: '#c99a3c' },
  data: { background: '#dddddd', border: '#b4b4b4' },
  transaction: { background: '#c8f0c8', border: '#6fb96f' },
};

export function emptyScheme(): TebScheme {
  return { Nodes: [], Links: [], Decors: [], Boundary: [] };
}

/** Scheme level reached from the root of the model through the given composite TEBs. */
export function schemeAtPath(model: StudioModel | undefined, path: string[]): TebScheme | null {
  let scheme = model?.Scheme ?? null;
  for (const nodeId of path) {
    scheme = scheme?.Nodes.find((node) => node.Id === nodeId)?.Child ?? null;
  }

  return scheme;
}

/** Headers of the composite TEBs along the path (for the breadcrumb). */
export function pathHeaders(model: StudioModel | undefined, path: string[]): string[] {
  const headers: string[] = [];
  let scheme = model?.Scheme ?? null;
  for (const nodeId of path) {
    const node = scheme?.Nodes.find((item) => item.Id === nodeId);
    headers.push(node?.Header || node?.NameInModel || 'ТЭБ');
    scheme = node?.Child ?? null;
  }

  return headers;
}

function viewKind(kind: TebKind): SchemeNodeKind {
  return kind === 'data' ? 'data' : 'teb';
}

/** Nodes and links of one scheme level for the structural scheme document. */
const BOUNDARY_SIZE = { width: 96, height: 34 };
const BOUNDARY_GAP = 56;

/** Inputs and outputs of the enclosing composite TEB, placed at the left / right edge of the level. */
function boundaryNodes(scheme: TebScheme): SchemeNode[] {
  const right = Math.max(600, ...scheme.Nodes.map((node) => node.X + (node.Width || 160) + 80));
  const place = (direction: 'input' | 'output') => scheme.Boundary.filter((item) => item.Direction === direction);
  return [...place('input'), ...place('output')].map((connector, _, all) => {
    const sameSide = all.filter((item) => item.Direction === connector.Direction);
    const index = sameSide.indexOf(connector);
    return {
      id: connector.Id,
      label: `${connector.Direction === 'input' ? 'Вход' : 'Выход'} №${connector.DefinitionId}`,
      kind: 'data' as const,
      x: connector.Direction === 'input' ? 8 : right,
      y: 40 + index * BOUNDARY_GAP,
      ...BOUNDARY_SIZE,
      isBoundary: true,
      backgroundColor: '#ffffff',
      borderColor: '#7d8a96',
      textColor: '#33414e',
      fontFamily: 'Arial',
      fontSize: 11,
    };
  });
}

/** Nodes and links of one scheme level for the structural scheme document. */
export function toSchemeView(scheme: TebScheme): { nodes: SchemeNode[]; links: SchemeLink[] } {
  const boundary = boundaryNodes(scheme);
  const nodeIds = new Set([...scheme.Nodes.map((node) => node.Id), ...boundary.map((node) => node.id)]);
  return {
    nodes: [
      ...scheme.Nodes.map((node) => ({
        id: node.Id,
        label: node.Header || node.NameInModel || 'ТЭБ',
        kind: viewKind(node.Kind),
        nameInModel: node.NameInModel ?? undefined,
        x: node.X,
        y: node.Y,
        width: node.Width || 160,
        height: node.Height || 60,
        description: node.Description ?? undefined,
        className: CLASS_TYPES[node.Kind],
        classId: node.ClassId,
        isLibraryClass: Boolean(node.LibraryId),
        instanceCount: node.InstancesCount,
        isComposite: node.Kind === 'composite',
        backgroundColor: node.BackgroundColor ?? DEFAULT_COLORS[node.Kind].background,
        borderColor: node.BorderColor ?? DEFAULT_COLORS[node.Kind].border,
        textColor: node.TextColor ?? '#1d2d3a',
        fontFamily: 'Arial',
        fontSize: 12,
      })),
      ...boundary,
    ],
    links: scheme.Links.filter((link) => nodeIds.has(link.FromNodeId) && nodeIds.has(link.ToNodeId)).map((link) => ({
      id: link.Id,
      from: link.FromNodeId,
      to: link.ToNodeId,
    })),
  };
}

function nextNameInModel(scheme: TebScheme): string {
  const used = new Set(scheme.Nodes.map((node) => node.NameInModel?.toLowerCase()));
  let index = scheme.Nodes.length + 1;
  while (used.has(`teb${index}`)) {
    index++;
  }

  return `teb${index}`;
}

function port(id: number, mode: ConnectedBlockMode): StudioTebPort {
  return { Id: id, Mode: mode, Label: null, ConnectionsLimit: 0, TransferMode: 'DirectOrSplit', Side: mode === 'LastBlock' ? 3 : 1, Position: 0.5 };
}

/** New elementary (or data) TEB created on the scheme: one input on the first block, one output after the last block. */
export function createProjectNode(view: SchemeNode, scheme: TebScheme): StudioTebNode {
  const kind: TebKind = view.kind === 'data' ? 'data' : 'simple';
  return {
    Id: view.id,
    Kind: kind,
    Header: view.label,
    NameInModel: nextNameInModel(scheme),
    Description: view.description ?? null,
    ClassId: createId(),
    InstancesCount: 1,
    X: view.x,
    Y: view.y,
    Width: view.width,
    Height: view.height,
    BackgroundColor: view.backgroundColor ?? null,
    BorderColor: view.borderColor ?? null,
    TextColor: view.textColor ?? null,
    GpssText: kind === 'simple' ? '' : null,
    Entities: [],
    Inputs: kind === 'simple' ? [port(1, 'FirstBlock')] : [],
    Outputs: kind === 'simple' ? [port(2, 'LastBlock')] : [],
    Parameters: [],
    States: [],
    Child: null,
  };
}

function nextPortId(node: StudioTebNode): number {
  return Math.max(0, ...node.Inputs.map((item) => item.Id), ...node.Outputs.map((item) => item.Id)) + 1;
}

/**
 * Applies the edits made on the structural scheme document (positions, renamed / added / deleted
 * nodes and links) to the scheme level of the project. Links to composite boundaries are kept.
 */
export function applySchemeView(scheme: TebScheme, nodes: SchemeNode[], links: SchemeLink[]): TebScheme {
  // Boundary connectors of composite TEBs are shown as nodes but belong to the enclosing TEB.
  const views = new Map(nodes.filter((node) => !node.hidden && !node.isBoundary).map((node) => [node.id, node]));
  const boundaryIds = new Set(scheme.Boundary.map((connector) => connector.Id));
  const result: TebScheme = { ...scheme, Nodes: [], Links: [] };

  for (const node of scheme.Nodes) {
    const view = views.get(node.Id);
    if (!view) {
      continue;
    }

    result.Nodes.push({ ...node, X: view.x, Y: view.y, Width: view.width, Height: view.height, Header: view.label });
  }

  for (const view of views.values()) {
    if (!scheme.Nodes.some((node) => node.Id === view.id)) {
      result.Nodes.push(createProjectNode(view, result));
    }
  }

  const nodeById = new Map(result.Nodes.map((node) => [node.Id, node]));
  const visibleLinks = new Map(links.filter((link) => !link.hidden).map((link) => [link.id, link]));
  for (const link of scheme.Links) {
    const exists = (id: string) => nodeById.has(id) || boundaryIds.has(id);
    const isShown = links.some((view) => view.id === link.Id);
    const survives = exists(link.FromNodeId) && exists(link.ToNodeId) && (!isShown || visibleLinks.has(link.Id));
    if (survives) {
      result.Links.push(link);
    }
  }

  for (const view of visibleLinks.values()) {
    if (scheme.Links.some((link) => link.Id === view.id)) {
      continue;
    }

    if (boundaryIds.has(view.from) || boundaryIds.has(view.to)) {
      result.Links.push(boundaryLink(view, scheme, nodeById));
      continue;
    }

    const from = nodeById.get(view.from);
    const to = nodeById.get(view.to);
    if (!from || !to) {
      continue;
    }

    // A new connection uses the first output and input of the TEBs, creating them when missing.
    if (from.Outputs.length === 0) {
      from.Outputs = [port(nextPortId(from), 'LastBlock')];
    }

    if (to.Inputs.length === 0) {
      to.Inputs = [port(nextPortId(to), 'FirstBlock')];
    }

    const link: StudioTebLink = {
      Id: view.id,
      FromNodeId: from.Id,
      FromPortId: from.Outputs[0].Id,
      ToNodeId: to.Id,
      ToPortId: to.Inputs[0].Id,
      Priority: 0,
      Probability: 0,
      OrderIndex: 0,
      Description: null,
      GpssText: null,
      Points: [],
    };
    result.Links.push(link);
  }

  return result;
}

/** New connection from an input of the enclosing composite TEB or to one of its outputs. */
function boundaryLink(view: SchemeLink, scheme: TebScheme, nodeById: Map<string, StudioTebNode>): StudioTebLink {
  const from = nodeById.get(view.from);
  const to = nodeById.get(view.to);
  if (from && from.Outputs.length === 0) {
    from.Outputs = [port(nextPortId(from), 'LastBlock')];
  }

  if (to && to.Inputs.length === 0) {
    to.Inputs = [port(nextPortId(to), 'FirstBlock')];
  }

  return {
    Id: view.id,
    FromNodeId: view.from,
    FromPortId: from ? from.Outputs[0].Id : (scheme.Boundary.find((item) => item.Id === view.from)?.DefinitionId ?? 0),
    ToNodeId: view.to,
    ToPortId: to ? to.Inputs[0].Id : (scheme.Boundary.find((item) => item.Id === view.to)?.DefinitionId ?? 0),
    Priority: 0,
    Probability: 0,
    OrderIndex: 0,
    Description: null,
    GpssText: null,
    Points: [],
  };
}

/** Replaces the scheme level at `path` inside the model (immutable update). */
export function replaceSchemeAtPath(model: StudioModel, path: string[], scheme: TebScheme): StudioModel {
  if (path.length === 0) {
    return { ...model, Scheme: scheme };
  }

  const replace = (current: TebScheme, depth: number): TebScheme => ({
    ...current,
    Nodes: current.Nodes.map((node) =>
      node.Id === path[depth] && node.Child ? { ...node, Child: depth === path.length - 1 ? scheme : replace(node.Child, depth + 1) } : node,
    ),
  });

  return { ...model, Scheme: replace(model.Scheme ?? emptyScheme(), 0) };
}

function connectedBlockText(item: StudioTebPort): string {
  switch (item.Mode) {
    case 'FirstBlock':
      return FIRST_BLOCK_LABEL;
    case 'LastBlock':
      return LAST_BLOCK_LABEL;
    case 'Label':
      return item.Label ?? '';
    default:
      return '';
  }
}

function portView(item: StudioTebPort, isOutput: boolean): TebPort {
  return {
    id: String(item.Id),
    nameInModel: String(item.Id),
    header: item.Mode === 'Label' ? (item.Label ?? '') : '',
    connectedBlock: connectedBlockText(item),
    connectionsLimit: item.ConnectionsLimit,
    description: item.Description ?? '',
    ...(isOutput ? { transferMode: item.TransferMode, gpssModel: item.GpssText ?? '' } : {}),
  };
}

function portFromView(view: TebPort, previous: StudioTebPort[], newId: () => number): StudioTebPort {
  const id = Number(view.nameInModel) || Number(view.id) || newId();
  const old = previous.find((item) => item.Id === id);
  const text = view.connectedBlock.trim();
  const mode: ConnectedBlockMode = text === FIRST_BLOCK_LABEL ? 'FirstBlock' : text === LAST_BLOCK_LABEL ? 'LastBlock' : text ? 'Label' : 'NotSet';
  return {
    ...(old ?? port(id, mode)),
    Id: id,
    Mode: mode,
    Label: mode === 'Label' ? text : null,
    ConnectionsLimit: Number(view.connectionsLimit) || 0,
    Description: view.description || null,
    TransferMode: TRANSFER_MODES.includes(view.transferMode as TransferMode) ? (view.transferMode as TransferMode) : (old?.TransferMode ?? 'DirectOrSplit'),
    GpssText: view.gpssModel === undefined ? (old?.GpssText ?? null) : view.gpssModel || null,
  };
}

/** TEB of a project shown in the TEB editor ("class" mode). */
export function tebNodeToDocument(node: StudioTebNode): TebDocument {
  return {
    id: node.ClassId,
    instanceId: node.Id,
    mode: 'class',
    type: CLASS_TYPES[node.Kind],
    nameInModel: node.NameInModel ?? '',
    header: node.Header,
    description: node.Description ?? '',
    imageName: '',
    gpssModel: { text: node.GpssText ?? '' },
    gpssEntities: node.Entities.map((entity, index): GpssEntity => ({
      id: `${node.Id}-entity-${index}`,
      type: entity.Type,
      nameInModel: entity.Name,
      value: entity.Value ?? (entity.Cells ? `${entity.Cells.length}×${entity.Cells[0]?.length ?? 0}` : ''),
      description: entity.Description ?? '',
    })),
    inputs: node.Inputs.map((item) => portView(item, false)),
    outputs: node.Outputs.map((item) => portView(item, true)),
    parameters: node.Parameters.map((parameter) => ({
      id: String(parameter.Id),
      type: parameter.Type,
      header: parameter.Header ?? '',
      nameInModel: parameter.NameInModel,
      defaultValue: parameter.DefaultValue ?? '',
      allowEmptyValues: false,
      currentValue: parameter.Value ?? parameter.DefaultValue ?? '',
    })),
    states: node.States.map((state, index) => ({
      id: `${node.Id}-state-${index}`,
      name: state.Name,
      expression: state.Expression,
      description: state.Description ?? '',
    })),
    childInstances: [],
  };
}

/** Writes the TEB editor document back into the project node. */
export function applyDocumentToNode(node: StudioTebNode, document: TebDocument): StudioTebNode {
  const previousEntities = new Map(node.Entities.map((entity) => [entity.Name.toLowerCase(), entity]));
  let nextPort = nextPortId(node);
  const newPortId = () => nextPort++;

  return {
    ...node,
    Header: document.header,
    NameInModel: document.nameInModel || null,
    Description: document.description || null,
    GpssText: node.Kind === 'composite' ? node.GpssText : document.gpssModel.text,
    Entities: document.gpssEntities.map((entity) => {
      const previous = previousEntities.get(entity.nameInModel.toLowerCase());
      const isMatrixSummary = previous?.Cells && String(entity.value) === `${previous.Cells.length}×${previous.Cells[0]?.length ?? 0}`;
      return {
        ...previous,
        Type: entity.type,
        Name: entity.nameInModel,
        Value: isMatrixSummary ? (previous?.Value ?? null) : String(entity.value ?? ''),
        Description: entity.description || null,
        Cells: entity.type === previous?.Type ? (previous?.Cells ?? null) : null,
      };
    }),
    Inputs: document.inputs.map((item) => portFromView(item, node.Inputs, newPortId)),
    Outputs: document.outputs.map((item) => portFromView(item, node.Outputs, newPortId)),
    Parameters: document.parameters.map((parameter, index) => ({
      Id: Number(parameter.id) || index + 1,
      Type: parameter.type,
      NameInModel: parameter.nameInModel,
      Header: parameter.header || null,
      DefaultValue: String(parameter.defaultValue ?? ''),
      Value: String(parameter.currentValue ?? ''),
    })),
    States: document.states.map((state) => ({ Name: state.name, Expression: state.expression, Description: state.description || null })),
  };
}

/** Finds a node anywhere in the scheme hierarchy. */
export function findNode(scheme: TebScheme | null | undefined, nodeId: string): StudioTebNode | null {
  for (const node of scheme?.Nodes ?? []) {
    if (node.Id === nodeId) {
      return node;
    }

    const nested = findNode(node.Child, nodeId);
    if (nested) {
      return nested;
    }
  }

  return null;
}

/** Replaces a node anywhere in the scheme hierarchy (immutable update). */
export function replaceNode(scheme: TebScheme, updated: StudioTebNode): TebScheme {
  return {
    ...scheme,
    Nodes: scheme.Nodes.map((node) => (node.Id === updated.Id ? updated : node.Child ? { ...node, Child: replaceNode(node.Child, updated) } : node)),
  };
}

/** Canvas size needed to show all nodes of a level (at least the default canvas). */
export function schemeExtent(nodes: SchemeNode[], minimum: { width: number; height: number }): { width: number; height: number } {
  const visible = nodes.filter((node) => !node.hidden);
  return {
    width: Math.max(minimum.width, ...visible.map((node) => node.x + node.width + 80)),
    height: Math.max(minimum.height, ...visible.map((node) => node.y + node.height + 80)),
  };
}
