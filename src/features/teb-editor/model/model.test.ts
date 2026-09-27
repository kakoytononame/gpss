import { CLASS_PAYLOAD, INSTANCE_PAYLOAD } from '../../../test/fixtures';
import { visibleTabsForType } from './constants';
import { documentLabel, nodeForDocument, nodeToDocument, withDocument } from './documents';
import { appendLogLines, buildInitialModelLog, journalLine } from './modelLog';
import { normalizeTebPayload } from './normalizeTeb';

describe('normalizeTebPayload', () => {
  it('maps a PascalCase class payload', () => {
    const teb = normalizeTebPayload(CLASS_PAYLOAD, 'class');

    expect(teb).toMatchObject({
      id: CLASS_PAYLOAD.ClassId,
      mode: 'class',
      type: 'SimpleTebClass',
      nameInModel: 'BI_U_3',
      imageName: 'teb.png',
      imageUrl: CLASS_PAYLOAD.ImageUrl,
    });
    expect(teb.gpssModel.text).toContain('SEIZE');
    expect(teb.parameters.map((parameter) => parameter.nameInModel)).toEqual(['travelTime', 'NEXT_STATION']);
    expect(teb.states[0]).toMatchObject({ name: 'Busy', expression: 'F$BU3 = 1' });
    expect(teb.inputs[0].connectionsLimit).toBe('1');
  });

  it('maps an instance with parameter values matched by name', () => {
    const teb = normalizeTebPayload(INSTANCE_PAYLOAD, 'instance');

    expect(teb.mode).toBe('instance');
    expect(teb.instanceId).toBe(INSTANCE_PAYLOAD.Id);
    expect(teb.nameInModel).toBe('BI_U_3_01');
    expect(teb.parameters.map((parameter) => parameter.currentValue)).toEqual(['6', 'DEPOT']);
  });

  it('tolerates empty payloads', () => {
    const teb = normalizeTebPayload(null, 'class');
    expect(teb.parameters).toEqual([]);
    expect(teb.type).toBe('TebClass');
  });
});

describe('documents', () => {
  it('maps explorer nodes and documents both ways', () => {
    expect(nodeToDocument('charts')).toBe('charts');
    expect(nodeToDocument('project-home')).toBe('start');
    expect(nodeToDocument('anything-else')).toBe('editor');
    expect(nodeForDocument('std-report')).toBe('std-report');
    expect(documentLabel('model-log')).toBe('журнал моделирования');
    expect(withDocument(['editor'], 'editor')).toEqual(['editor']);
    expect(withDocument(['editor'], 'charts')).toEqual(['editor', 'charts']);
  });

  it('shows all tabs only for simple TEB classes', () => {
    expect(visibleTabsForType('SimpleTebClass')).toHaveLength(7);
    expect(visibleTabsForType('CompositeTebClass')).not.toContain('gpss-model');
    expect(visibleTabsForType('Unknown')).toEqual(['general']);
  });
});

describe('model log', () => {
  it('formats journal lines with the local time', () => {
    const date = new Date(2026, 0, 1, 9, 5, 7);
    expect(journalLine('Готово.', date)).toBe('[09:05:07] Готово.');
    expect(buildInitialModelLog(null, date)).toBe('[09:05:07] Проект "Столовая" открыт.');
    expect(appendLogLines('', ['a', 'b'])).toBe('a\nb');
  });
});
