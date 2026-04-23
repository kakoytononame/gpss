import type { TebDocument, TebParameter } from '../../../shared/types/teb';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function pick<T>(source: unknown, keys: string[], fallback: T): T {
  if (!isRecord(source)) {
    return fallback;
  }

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) {
      return value as T;
    }
  }

  return fallback;
}

function toArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items as T[];
  }

  if (isRecord(value) && Array.isArray(value.Items)) {
    return value.Items as T[];
  }

  return [];
}

function unwrapType(value: unknown, fallback = 'TebClass'): string {
  if (!value) {
    return fallback;
  }

  const rawType = typeof value === 'string' ? value : pick<string>(value, ['type', 'Type', '$type', 'className', 'ClassName'], fallback);
  return String(rawType).split(',')[0].split('.').at(-1) || fallback;
}

function normalizeParameterValues(instance: unknown): { byIndex: Map<number, string | number>; byName: Map<string, string | number> } {
  const values = toArray<unknown>(pick(instance, ['parameterValues', 'ParameterValues', 'parametersValues', 'ParametersValues'], []));
  const byIndex = new Map<number, string | number>();
  const byName = new Map<string, string | number>();

  values.forEach((item, index) => {
    const value = pick<string | number>(item, ['value', 'Value', 'currentValue', 'CurrentValue'], String(item ?? ''));
    const name = pick<string>(item, ['nameInModel', 'NameInModel', 'name', 'Name'], '');

    byIndex.set(index, value);
    if (name) {
      byName.set(name, value);
    }
  });

  return { byIndex, byName };
}

function normalizeParameter(parameter: unknown, index: number, currentValue: string | number): TebParameter {
  return {
    id: pick<string>(parameter, ['id', 'Id'], `parameter-${index}`),
    type: unwrapType(pick(parameter, ['type', 'Type', 'parameterType', 'ParameterType'], 'NumberParameterType'), 'NumberParameterType'),
    header: pick<string>(parameter, ['header', 'Header', 'title', 'Title'], ''),
    nameInModel: pick<string>(parameter, ['nameInModel', 'NameInModel', 'name', 'Name'], ''),
    defaultValue: pick<string | number>(parameter, ['defaultValue', 'DefaultValue', 'value', 'Value'], ''),
    allowEmptyValues: Boolean(pick<boolean>(parameter, ['allowEmptyValues', 'AllowEmptyValues'], false)),
    currentValue,
  };
}

export function normalizeTebPayload(payload: unknown, requestedMode: 'class' | 'instance'): TebDocument {
  const instanceCandidate = pick(payload, ['instance', 'Instance'], payload);
  const rawClass = pick(instanceCandidate, ['class', 'Class', 'tebClass', 'TebClass'], requestedMode === 'instance' ? null : instanceCandidate);
  const isInstance = Boolean(rawClass && rawClass !== instanceCandidate);
  const parameterValues = normalizeParameterValues(isInstance ? instanceCandidate : {});
  const gpssModel = pick<UnknownRecord>(rawClass, ['gpssModel', 'GpssModel'], {});
  const childScheme = pick<UnknownRecord>(rawClass, ['childScheme', 'ChildScheme'], {});

  const parameters = toArray<unknown>(pick(rawClass, ['parameters', 'Parameters', 'parameterDefinitions', 'ParameterDefinitions'], [])).map((parameter, index) => {
    const name = pick<string>(parameter, ['nameInModel', 'NameInModel', 'name', 'Name'], '');
    const currentValue = parameterValues.byName.get(name) ?? parameterValues.byIndex.get(index) ?? '';
    return normalizeParameter(parameter, index, currentValue);
  });

  return {
    id: pick<string>(rawClass, ['id', 'Id', 'classId', 'ClassId'], ''),
    instanceId: isInstance ? pick<string>(instanceCandidate, ['id', 'Id'], '') : '',
    mode: isInstance ? 'instance' : requestedMode,
    type: unwrapType(rawClass, 'TebClass'),
    nameInModel: isInstance
      ? pick<string>(instanceCandidate, ['nameInModel', 'NameInModel', 'name', 'Name'], pick<string>(rawClass, ['nameInModel', 'NameInModel', 'name', 'Name'], ''))
      : pick<string>(rawClass, ['nameInModel', 'NameInModel', 'name', 'Name'], ''),
    header: isInstance
      ? pick<string>(instanceCandidate, ['header', 'Header', 'title', 'Title'], pick<string>(rawClass, ['header', 'Header', 'title', 'Title'], ''))
      : pick<string>(rawClass, ['header', 'Header', 'title', 'Title'], ''),
    description: pick<string>(rawClass, ['description', 'Description'], ''),
    imageName: pick<string>(rawClass, ['imageName', 'ImageName', 'image', 'Image'], ''),
    gpssModel: {
      text: pick<string>(gpssModel, ['text', 'Text'], ''),
    },
    gpssEntities: toArray<unknown>(pick(rawClass, ['gpssEntities', 'GpssEntities'], [])).map((entity, index) => {
      const gpssInstance = pick(entity, ['gpssInstance', 'GpssInstance', 'instance', 'Instance'], {});
      return {
        id: pick<string>(entity, ['id', 'Id'], `entity-${index}`),
        type: unwrapType(pick(entity, ['type', 'Type'], gpssInstance), 'GpssEntity'),
        nameInModel: pick<string>(entity, ['nameInModel', 'NameInModel', 'name', 'Name'], pick<string>(gpssInstance, ['nameInModel', 'NameInModel', 'name', 'Name'], '')),
        value: pick<string | number>(entity, ['value', 'Value', 'capacity', 'Capacity', 'argument', 'Argument'], ''),
        description: pick<string>(entity, ['description', 'Description', 'comment', 'Comment'], ''),
      };
    }),
    inputs: toArray<unknown>(pick(rawClass, ['inputs', 'Inputs', 'inputDefinitions', 'InputDefinitions'], [])).map((port, index) => ({
      id: pick<string>(port, ['id', 'Id'], `input-${index}`),
      nameInModel: pick<string>(port, ['nameInModel', 'NameInModel', 'name', 'Name'], ''),
      header: pick<string>(port, ['header', 'Header', 'title', 'Title'], ''),
      connectedBlock: pick<string>(port, ['connectedBlock', 'ConnectedBlock', 'block', 'Block'], ''),
      connectionsLimit: pick<string | number>(port, ['connectionsLimit', 'ConnectionsLimit', 'limit', 'Limit'], ''),
      description: pick<string>(port, ['description', 'Description'], ''),
    })),
    outputs: toArray<unknown>(pick(rawClass, ['outputs', 'Outputs', 'outputDefinitions', 'OutputDefinitions'], [])).map((port, index) => ({
      id: pick<string>(port, ['id', 'Id'], `output-${index}`),
      nameInModel: pick<string>(port, ['nameInModel', 'NameInModel', 'name', 'Name'], ''),
      header: pick<string>(port, ['header', 'Header', 'title', 'Title'], ''),
      connectedBlock: pick<string>(port, ['connectedBlock', 'ConnectedBlock', 'block', 'Block'], ''),
      connectionsLimit: pick<string | number>(port, ['connectionsLimit', 'ConnectionsLimit', 'limit', 'Limit'], ''),
      description: pick<string>(port, ['description', 'Description'], ''),
    })),
    parameters,
    states: toArray<unknown>(pick(rawClass, ['states', 'States'], [])).map((state, index) => ({
      id: pick<string>(state, ['id', 'Id'], `state-${index}`),
      name: pick<string>(state, ['name', 'Name', 'header', 'Header', 'nameInModel', 'NameInModel'], ''),
      expression: pick<string>(state, ['expression', 'Expression', 'value', 'Value'], ''),
      description: pick<string>(state, ['description', 'Description'], ''),
    })),
    childInstances: toArray<unknown>(pick(childScheme, ['instances', 'Instances'], [])),
  };
}
