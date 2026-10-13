import { studioProject } from '../../../test/fixtures';
import {
  applyDocumentToNode,
  applySchemeView,
  FIRST_BLOCK_LABEL,
  findNode,
  LAST_BLOCK_LABEL,
  pathHeaders,
  replaceSchemeAtPath,
  schemeAtPath,
  schemeExtent,
  tebNodeToDocument,
  toSchemeView,
} from './projectScheme';

const model = () => studioProject().Models[0];

describe('project scheme view', () => {
  it('maps TEB nodes and links of one level with the boundary of composite TEBs', () => {
    const view = toSchemeView(model().Scheme!);

    expect(view.nodes.map((node) => [node.id, node.kind, node.isComposite])).toEqual([
      ['teb1', 'teb', false],
      ['teb2', 'teb', true],
      ['data', 'data', false],
    ]);
    expect(view.links).toEqual([{ id: 'l1', from: 'teb1', to: 'teb2' }]);
    const inner = toSchemeView(schemeAtPath(model(), ['teb2'])!);
    expect(inner.nodes.map((node) => [node.id, node.label, node.isBoundary ?? false])).toEqual([
      ['teb3', 'Станок', false],
      ['boundary:1', 'Вход №1', true],
    ]);
    expect(inner.links).toEqual([{ id: 'in', from: 'boundary:1', to: 'teb3' }]);
    expect(pathHeaders(model(), ['teb2'])).toEqual(['Цех']);
  });

  it('applies moves, deletions and new nodes / links back to the project scheme', () => {
    const scheme = model().Scheme!;
    const view = toSchemeView(scheme);
    const nodes = view.nodes.map((node) => (node.id === 'teb1' ? { ...node, x: 40, label: 'Заявки' } : node.id === 'data' ? { ...node, hidden: true } : node));
    nodes.push({ id: 'new', label: 'Контроль', kind: 'teb', x: 10, y: 10, width: 150, height: 60 });
    const links = [...view.links, { id: 'l2', from: 'new', to: 'teb1' }];

    const updated = applySchemeView(scheme, nodes, links);

    expect(updated.Nodes.map((node) => node.Id)).toEqual(['teb1', 'teb2', 'new']);
    expect(updated.Nodes[0]).toMatchObject({ X: 40, Header: 'Заявки' });
    const created = updated.Nodes[2];
    expect(created).toMatchObject({ Kind: 'simple', NameInModel: 'teb3', Outputs: [{ Mode: 'LastBlock' }] });
    // teb1 had no input: one is created for the new connection.
    expect(updated.Nodes[0].Inputs).toEqual([expect.objectContaining({ Id: 3, Mode: 'FirstBlock' })]);
    expect(updated.Links.find((link) => link.Id === 'l2')).toMatchObject({ FromNodeId: 'new', FromPortId: 2, ToNodeId: 'teb1', ToPortId: 3 });
  });

  it('keeps boundary links of composite levels and replaces nested levels immutably', () => {
    const inner = schemeAtPath(model(), ['teb2'])!;
    const view = toSchemeView(inner);
    expect(applySchemeView(inner, view.nodes, view.links).Links.map((link) => link.Id)).toEqual(['in']);
    // Deleting the boundary connection on the scheme removes it; the connector itself stays.
    const updated = applySchemeView(inner, view.nodes, view.links.map((link) => ({ ...link, hidden: true })));
    expect(updated.Links).toEqual([]);
    expect(updated.Nodes.map((node) => node.Id)).toEqual(['teb3']);

    const moved = { ...inner, Nodes: inner.Nodes.map((node) => ({ ...node, X: 7 })) };
    const next = replaceSchemeAtPath(model(), ['teb2'], moved);
    expect(findNode(next.Scheme, 'teb3')?.X).toBe(7);
    expect(findNode(model().Scheme, 'teb3')?.X).toBe(100);
  });

  it('grows the canvas to show imported nodes', () => {
    expect(schemeExtent(toSchemeView(model().Scheme!).nodes, { width: 1300, height: 640 })).toEqual({ width: 1740, height: 1040 });
  });
});

describe('project TEB in the TEB editor', () => {
  it('converts ports, entities and parameters both ways', () => {
    const node = {
      ...findNode(model().Scheme, 'teb1')!,
      Inputs: [{ Id: 1, Mode: 'Label' as const, Label: 'Entry', ConnectionsLimit: 2, TransferMode: 'DirectOrSplit' as const, Side: 1, Position: 0.5 }],
    };
    node.Parameters = [{ Id: 1, Type: 'Expression', NameInModel: 'Mean', DefaultValue: '5', Value: '7' }];
    const document = tebNodeToDocument(node);

    expect(document).toMatchObject({ type: 'SimpleTebClass', gpssModel: { text: ' GENERATE 5' } });
    expect(document.inputs[0]).toMatchObject({ connectedBlock: 'Entry', connectionsLimit: 2 });
    expect(document.outputs[0].connectedBlock).toBe(LAST_BLOCK_LABEL);
    expect(document.parameters[0]).toMatchObject({ nameInModel: 'Mean', currentValue: '7' });

    document.gpssModel.text = ' GENERATE 9';
    document.inputs[0].connectedBlock = FIRST_BLOCK_LABEL;
    document.outputs.push({ id: 'x', nameInModel: '', header: '', connectedBlock: 'Done', connectionsLimit: '', description: '' });
    const updated = applyDocumentToNode(node, document);

    expect(updated.GpssText).toBe(' GENERATE 9');
    expect(updated.Inputs[0]).toMatchObject({ Id: 1, Mode: 'FirstBlock', Label: null });
    expect(updated.Outputs.map((output) => [output.Id, output.Mode, output.Label])).toEqual([
      [2, 'LastBlock', null],
      [3, 'Label', 'Done'],
    ]);
  });

  it('keeps matrix cells when only the summary is shown', () => {
    const data = findNode(model().Scheme, 'data')!;
    const document = tebNodeToDocument(data);
    expect(document.gpssEntities[0].value).toBe('1×2');

    expect(applyDocumentToNode(data, document).Entities[0].Cells).toEqual([['1', '2']]);
  });
});
