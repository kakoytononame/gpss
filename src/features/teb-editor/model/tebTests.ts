import type { GenerationResult, StudioModel, StudioTebNode, TebScheme } from '../../../shared/types/project';
import type { TebDocument, TebTestItem } from '../../../shared/types/teb';

/** Group of tests about the whole model (generation and translation of the model text). */
export const MODEL_TEST_GROUP = 'Модель';

interface PlacedNode {
  node: StudioTebNode;
  /** Composite TEBs to enter from the root scheme to see the node. */
  path: string[];
}

function placedNodes(scheme: TebScheme | null | undefined, path: string[] = []): PlacedNode[] {
  return (scheme?.Nodes ?? []).flatMap((node) => [{ node, path }, ...(node.Kind === 'composite' ? placedNodes(node.Child, [...path, node.Id]) : [])]);
}

function result(id: string, group: string, name: string, problems: string[], okMessage: string, place?: PlacedNode): TebTestItem {
  return {
    id,
    group,
    name,
    status: problems.length > 0 ? 'failed' : 'passed',
    message: problems.length > 0 ? problems.join(' ') : okMessage,
    sourceNodeId: place?.node.Id,
    schemePath: place?.path,
  };
}

function tebName(node: StudioTebNode): string {
  return node.Header.trim() || node.NameInModel || node.Id;
}

/**
 * Tests of the TEBs of a model ("Тесты ТЭБов"): description, GPSS model (or inner scheme, GPSS objects),
 * parameters and the messages of the model generator for each TEB, then generation and translation of the model.
 */
export function projectTebTests(model: StudioModel, generation: GenerationResult | null): TebTestItem[] {
  const placed = placedNodes(model.Scheme).filter(({ node }) => node.Kind !== 'transaction');
  const names = new Map<string, number>();
  placed.forEach(({ node }) => {
    const name = node.NameInModel?.trim().toLowerCase();
    if (name) {
      names.set(name, (names.get(name) ?? 0) + 1);
    }
  });

  const messages = generation?.Messages ?? [];
  const tests = placed.flatMap((place) => {
    const { node } = place;
    const group = tebName(node);
    const id = (check: string) => `teb-${node.Id}-${check}`;

    const description: string[] = [];
    if (!node.Header.trim()) {
      description.push('Не задан заголовок ТЭБа.');
    }

    if (!node.NameInModel?.trim()) {
      description.push('Не задано имя в модели.');
    } else if ((names.get(node.NameInModel.trim().toLowerCase()) ?? 0) > 1) {
      description.push(`Имя в модели «${node.NameInModel}» есть у нескольких ТЭБов.`);
    }

    const content: string[] = [];
    let contentName = 'GPSS-модель';
    if (node.Kind === 'composite') {
      contentName = 'Внутренняя схема';
      if (!node.Child?.Nodes.length) {
        content.push('Схема композитного ТЭБа пуста.');
      }
    } else if (node.Kind === 'data') {
      contentName = 'Объекты GPSS';
      if (node.Entities.length === 0 && !node.GpssText?.trim()) {
        content.push('В ТЭБе с данными нет объектов GPSS.');
      }

      const unnamed = node.Entities.filter((entity) => !entity.Name.trim()).length;
      if (unnamed > 0) {
        content.push(`Объектов без имени: ${unnamed}.`);
      }
    } else if (!node.GpssText?.trim()) {
      content.push('У элементарного ТЭБа нет GPSS-модели.');
    }

    // Translation errors of the generated text are attributed to the TEB by its header.
    const translation = messages.filter((message) => !message.NodeId && message.Teb && message.Teb === node.Header && message.Severity === 'error');
    content.push(...translation.map((message) => message.Message));

    const parameters = node.Parameters.filter(
      (parameter) => !parameter.NameInModel.trim() || ![parameter.Value, parameter.DefaultValue].some((value) => (value ?? '').trim() !== ''),
    ).map((parameter) => parameter.Header || parameter.NameInModel || `№${parameter.Id}`);

    const own = messages.filter((message) => message.NodeId === node.Id);
    const errors = own.filter((message) => message.Severity === 'error').map((message) => message.Message);
    const warnings = own.filter((message) => message.Severity === 'warning').map((message) => message.Message);

    return [
      result(id('description'), group, 'Описание ТЭБа', description, 'Заголовок и имя в модели заданы.', place),
      result(id('content'), group, contentName, content, 'Ошибок не найдено.', place),
      result(
        id('parameters'),
        group,
        'Параметры',
        parameters.length > 0 ? [`Не заданы имя или значение параметров: ${parameters.join(', ')}.`] : [],
        node.Parameters.length > 0 ? `Значения заданы у всех параметров (${node.Parameters.length}).` : 'Параметров нет.',
        place,
      ),
      ...(generation
        ? [
            result(
              id('ports'),
              group,
              'Входы и выходы',
              errors,
              warnings.length > 0 ? `Предупреждения: ${warnings.join(' ')}` : 'Связи входов и выходов корректны.',
              place,
            ),
          ]
        : []),
    ];
  });

  if (!generation) {
    return tests;
  }

  const known = new Set(placed.map(({ node }) => node.Header));
  const unattributed = messages.filter((message) => message.Severity === 'error' && !message.NodeId && !(message.Teb && known.has(message.Teb)));
  const errorCount = messages.filter((message) => message.Severity === 'error').length;
  return [
    ...tests,
    result(
      'model-generation',
      MODEL_TEST_GROUP,
      'Генерация текста модели',
      errorCount > 0 ? [`Ошибок генерации: ${errorCount}.`] : [],
      `Сгенерировано строк: ${generation.GeneratedLines}.`,
    ),
    result(
      'model-translation',
      MODEL_TEST_GROUP,
      'Трансляция модели',
      unattributed.map((message) => message.Message),
      'Ошибок трансляции, не связанных с ТЭБами, нет.',
    ),
  ];
}

/** Tests of the TEB class open in the TEB editor (without a project). */
export function editorTebTests(teb: TebDocument): TebTestItem[] {
  const group = (teb.header ?? '').trim() || teb.nameInModel || 'ТЭБ';
  const description: string[] = [];
  if (!(teb.header ?? '').trim()) {
    description.push('Не задан заголовок класса.');
  }

  if (!(teb.nameInModel ?? '').trim()) {
    description.push('Не задано имя в модели.');
  }

  const parameterNames = teb.parameters.map((parameter) => (parameter.nameInModel ?? '').trim());
  const parameters = [
    ...(parameterNames.some((name) => !name) ? ['Есть параметры без имени в модели.'] : []),
    ...(new Set(parameterNames.filter(Boolean)).size < parameterNames.filter(Boolean).length ? ['Имена параметров повторяются.'] : []),
    ...teb.parameters
      .filter(
        (parameter) => !parameter.allowEmptyValues && ![parameter.currentValue, parameter.defaultValue].some((value) => String(value ?? '').trim() !== ''),
      )
      .map((parameter) => `Не задано значение параметра «${parameter.header || parameter.nameInModel}».`),
  ];

  // As the model generator requires: every port names the block the transactions enter or leave by.
  const ports = [
    ...teb.inputs
      .filter((port) => !(port.connectedBlock ?? '').trim())
      .map((port) => `Для входа «${port.header || port.nameInModel || port.id}» не задан связанный блок.`),
    ...teb.outputs
      .filter((port) => !(port.connectedBlock ?? '').trim())
      .map((port) => `Для выхода «${port.header || port.nameInModel || port.id}» не задан блок.`),
  ];
  return [
    result('editor-description', group, 'Описание ТЭБа', description, 'Заголовок и имя в модели заданы.'),
    result('editor-model', group, 'GPSS-модель', teb.gpssModel?.text?.trim() ? [] : ['У ТЭБа нет GPSS-модели.'], 'GPSS-модель задана.'),
    result('editor-parameters', group, 'Параметры', parameters, teb.parameters.length > 0 ? 'Параметры заданы.' : 'Параметров нет.'),
    result('editor-ports', group, 'Входы и выходы', ports, `Входов: ${teb.inputs.length}, выходов: ${teb.outputs.length}.`),
  ];
}
