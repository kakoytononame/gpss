import type { GenerationResult, StudioModel } from '../../../shared/types/project';
import { studioProject } from '../../../test/fixtures';
import { editorTebTests, MODEL_TEST_GROUP, projectTebTests } from './tebTests';
import { sampleDocument } from '../store/slices/tebSlice';

function model(): StudioModel {
  return studioProject().Models[0];
}

const statusOf = (tests: ReturnType<typeof projectTebTests>, id: string) => tests.find((test) => test.id === id);

describe('TEB tests', () => {
  it('checks every TEB of the scheme, including TEBs inside composites', () => {
    const tests = projectTebTests(model(), null);

    expect([...new Set(tests.map((test) => test.group))]).toEqual(['Поступление', 'Цех', 'Станок', 'Данные']);
    expect(tests.every((test) => test.status === 'passed')).toBe(true);
    expect(statusOf(tests, 'teb-teb3-content')).toMatchObject({ name: 'GPSS-модель', sourceNodeId: 'teb3', schemePath: ['teb2'] });
    expect(statusOf(tests, 'teb-teb2-content')?.name).toBe('Внутренняя схема');
    expect(statusOf(tests, 'teb-data-content')?.name).toBe('Объекты GPSS');
    // Connections are checked by the model generator only.
    expect(tests.some((test) => test.name === 'Входы и выходы')).toBe(false);
  });

  it('finds missing models, duplicate names and parameters without values', () => {
    const broken = model();
    const [arrivals, shop] = broken.Scheme!.Nodes;
    arrivals.GpssText = '  ';
    arrivals.NameInModel = 'teb3';
    arrivals.Parameters = [
      { Id: 1, Type: 'Number', NameInModel: 'interval', Header: 'Интервал', DefaultValue: '', Value: null },
      { Id: 2, Type: 'Number', NameInModel: 'service', Header: 'Обслуживание', DefaultValue: '4', Value: '' },
    ];
    shop.Child!.Nodes[0].Header = '';

    const tests = projectTebTests(broken, null);

    expect(statusOf(tests, 'teb-teb1-content')).toMatchObject({ status: 'failed', message: 'У элементарного ТЭБа нет GPSS-модели.' });
    expect(statusOf(tests, 'teb-teb1-description')).toMatchObject({ status: 'failed', message: 'Имя в модели «teb3» есть у нескольких ТЭБов.' });
    expect(statusOf(tests, 'teb-teb1-parameters')).toMatchObject({ status: 'failed', message: 'Не заданы имя или значение параметров: Интервал.' });
    expect(statusOf(tests, 'teb-teb3-description')).toMatchObject({ status: 'failed', group: 'teb3' });
  });

  it('turns generator messages into tests of the TEBs and of the model', () => {
    const generation: GenerationResult = {
      Text: ' GENERATE 5',
      GeneratedLines: 12,
      Success: false,
      Messages: [
        { Severity: 'error', Message: 'Для входа №1 не задан связанный блок.', NodeId: 'teb3', Teb: 'Станок' },
        { Severity: 'warning', Message: 'Выход №1 не соединён ни с одним ТЭБом: транзакты будут уничтожены.', NodeId: 'teb1', Teb: 'Поступление' },
        { Severity: 'error', Message: 'Строка 4 сгенерированного текста: Неизвестный блок.', NodeId: null, Teb: 'Станок' },
        { Severity: 'error', Message: 'Строка 1 сгенерированного текста: Нет START.', NodeId: null, Teb: null },
      ],
    };

    const tests = projectTebTests(model(), generation);

    expect(statusOf(tests, 'teb-teb3-ports')).toMatchObject({ status: 'failed', message: 'Для входа №1 не задан связанный блок.' });
    expect(statusOf(tests, 'teb-teb1-ports')).toMatchObject({ status: 'passed', message: expect.stringContaining('Предупреждения: Выход №1') });
    expect(statusOf(tests, 'teb-teb3-content')).toMatchObject({ status: 'failed', message: 'Строка 4 сгенерированного текста: Неизвестный блок.' });
    expect(statusOf(tests, 'model-generation')).toMatchObject({ group: MODEL_TEST_GROUP, status: 'failed', message: 'Ошибок генерации: 3.' });
    expect(statusOf(tests, 'model-translation')).toMatchObject({ status: 'failed', message: 'Строка 1 сгенерированного текста: Нет START.' });
  });

  it('checks the TEB class in the editor', () => {
    const teb = { ...sampleDocument('class'), nameInModel: 'KASSA1' };
    expect(editorTebTests(teb).every((test) => test.status === 'passed')).toBe(true);
    expect(editorTebTests(sampleDocument('class'))[0]).toMatchObject({ status: 'failed', message: 'Не задано имя в модели.' });

    const broken = {
      ...teb,
      header: '',
      gpssModel: { text: '' },
      parameters: [
        { id: 'p1', type: 'Number', header: 'Интервал', nameInModel: 'gap', defaultValue: '', allowEmptyValues: false, currentValue: '' },
        { id: 'p2', type: 'Number', header: 'Интервал 2', nameInModel: 'gap', defaultValue: 5, allowEmptyValues: false, currentValue: '' },
      ],
      inputs: teb.inputs.map((port) => ({ ...port, connectedBlock: '' })),
    };
    const tests = editorTebTests(broken);

    expect(tests.map((test) => [test.name, test.status])).toEqual([
      ['Описание ТЭБа', 'failed'],
      ['GPSS-модель', 'failed'],
      ['Параметры', 'failed'],
      ['Входы и выходы', 'failed'],
    ]);
    expect(tests[2].message).toContain('Имена параметров повторяются.');
    // An empty current value falls back to the default value (class mode keeps values per instance).
    expect(tests[2].message).toContain('«Интервал»');
    expect(tests[2].message).not.toContain('«Интервал 2»');
  });
});
