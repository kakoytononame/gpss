export const PARAMETER_TYPES = [
  { value: 'NameOrPartParameterType', label: 'Имя / часть имени' },
  { value: 'IntegerParameterType', label: 'Целое число' },
  { value: 'NumberParameterType', label: 'Вещественное число' },
  { value: 'ExpressionParameterType', label: 'Выражение' },
];

export const EDITOR_TABS = [
  { id: 'general', label: 'Общие' },
  { id: 'gpss-model', label: 'GPSS модель' },
  { id: 'gpss-objects', label: 'GPSS объекты' },
  { id: 'inputs', label: 'Входы' },
  { id: 'outputs', label: 'Выходы' },
  { id: 'parameters', label: 'Параметры' },
  { id: 'states', label: 'Состояния' },
];

const ALL_TAB_IDS = EDITOR_TABS.map((tab) => tab.id);

export function visibleTabsForType(type) {
  if (type === 'SimpleTebClass') {
    return ALL_TAB_IDS;
  }

  if (type === 'CompositeTebClass') {
    return ALL_TAB_IDS.filter((tabId) => tabId !== 'gpss-model' && tabId !== 'gpss-objects');
  }

  if (type === 'GlobalDataTebClass') {
    return ['general', 'gpss-model', 'gpss-objects'];
  }

  return ['general'];
}

export function pick(source, keys, fallback = undefined) {
  if (!source) {
    return fallback;
  }

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }

  return fallback;
}

function toArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value.items)) {
    return value.items;
  }

  if (Array.isArray(value.Items)) {
    return value.Items;
  }

  return [];
}

function unwrapType(value, fallback = 'TebClass') {
  if (!value) {
    return fallback;
  }

  const rawType = typeof value === 'string' ? value : pick(value, ['type', 'Type', '$type', 'className', 'ClassName'], fallback);
  const cleanType = String(rawType).split(',')[0].split('.').at(-1);

  return cleanType || fallback;
}

function normalizeGpssEntity(entity, index) {
  const gpssInstance = pick(entity, ['gpssInstance', 'GpssInstance', 'instance', 'Instance'], {});

  return {
    id: pick(entity, ['id', 'Id'], `entity-${index}`),
    type: unwrapType(pick(entity, ['type', 'Type'], gpssInstance), 'GpssEntity'),
    nameInModel: pick(entity, ['nameInModel', 'NameInModel', 'name', 'Name'], pick(gpssInstance, ['nameInModel', 'NameInModel', 'name', 'Name'], '')),
    value: pick(entity, ['value', 'Value', 'capacity', 'Capacity', 'argument', 'Argument'], ''),
    description: pick(entity, ['description', 'Description', 'comment', 'Comment'], ''),
  };
}

function normalizePort(port, index) {
  return {
    id: pick(port, ['id', 'Id'], `port-${index}`),
    nameInModel: pick(port, ['nameInModel', 'NameInModel', 'name', 'Name'], ''),
    header: pick(port, ['header', 'Header', 'title', 'Title'], ''),
    connectedBlock: pick(port, ['connectedBlock', 'ConnectedBlock', 'block', 'Block'], ''),
    connectionsLimit: pick(port, ['connectionsLimit', 'ConnectionsLimit', 'limit', 'Limit'], ''),
    description: pick(port, ['description', 'Description'], ''),
  };
}

function normalizeParameter(parameter, index, currentValue) {
  return {
    id: pick(parameter, ['id', 'Id'], `parameter-${index}`),
    type: unwrapType(pick(parameter, ['type', 'Type', 'parameterType', 'ParameterType'], 'NumberParameterType'), 'NumberParameterType'),
    header: pick(parameter, ['header', 'Header', 'title', 'Title'], ''),
    nameInModel: pick(parameter, ['nameInModel', 'NameInModel', 'name', 'Name'], ''),
    defaultValue: pick(parameter, ['defaultValue', 'DefaultValue', 'value', 'Value'], ''),
    allowEmptyValues: Boolean(pick(parameter, ['allowEmptyValues', 'AllowEmptyValues'], false)),
    currentValue: currentValue ?? pick(parameter, ['currentValue', 'CurrentValue'], ''),
  };
}

function normalizeState(state, index) {
  return {
    id: pick(state, ['id', 'Id'], `state-${index}`),
    name: pick(state, ['name', 'Name', 'header', 'Header'], ''),
    expression: pick(state, ['expression', 'Expression', 'value', 'Value'], ''),
    description: pick(state, ['description', 'Description'], ''),
  };
}

function normalizeParameterValues(instance) {
  const values = toArray(pick(instance, ['parameterValues', 'ParameterValues', 'parametersValues', 'ParametersValues'], []));
  const byIndex = new Map();
  const byName = new Map();

  values.forEach((item, index) => {
    const value = pick(item, ['value', 'Value', 'currentValue', 'CurrentValue'], item);
    const name = pick(item, ['nameInModel', 'NameInModel', 'name', 'Name'], '');

    byIndex.set(index, value);

    if (name) {
      byName.set(name, value);
    }
  });

  return { byIndex, byName };
}

export function normalizeTebPayload(payload, requestedMode = 'class') {
  const instanceCandidate = pick(payload, ['instance', 'Instance'], payload);
  const rawClass = pick(instanceCandidate, ['class', 'Class', 'tebClass', 'TebClass'], requestedMode === 'instance' ? null : instanceCandidate);
  const isInstance = Boolean(rawClass && rawClass !== instanceCandidate);
  const parameterValues = normalizeParameterValues(isInstance ? instanceCandidate : {});
  const gpssModel = pick(rawClass, ['gpssModel', 'GpssModel'], {});
  const childScheme = pick(rawClass, ['childScheme', 'ChildScheme'], {});

  const parameters = toArray(pick(rawClass, ['parameters', 'Parameters', 'parameterDefinitions', 'ParameterDefinitions'], [])).map((parameter, index) => {
    const name = pick(parameter, ['nameInModel', 'NameInModel', 'name', 'Name'], '');
    const currentValue = parameterValues.byName.get(name) ?? parameterValues.byIndex.get(index);

    return normalizeParameter(parameter, index, currentValue);
  });

  return {
    id: pick(rawClass, ['id', 'Id'], ''),
    instanceId: isInstance ? pick(instanceCandidate, ['id', 'Id'], '') : '',
    mode: isInstance ? 'instance' : requestedMode,
    type: unwrapType(rawClass, 'TebClass'),
    nameInModel: isInstance
      ? pick(instanceCandidate, ['nameInModel', 'NameInModel', 'name', 'Name'], pick(rawClass, ['nameInModel', 'NameInModel', 'name', 'Name'], ''))
      : pick(rawClass, ['nameInModel', 'NameInModel', 'name', 'Name'], ''),
    header: isInstance
      ? pick(instanceCandidate, ['header', 'Header', 'title', 'Title'], pick(rawClass, ['header', 'Header', 'title', 'Title'], ''))
      : pick(rawClass, ['header', 'Header', 'title', 'Title'], ''),
    description: pick(rawClass, ['description', 'Description'], ''),
    imageName: pick(rawClass, ['imageName', 'ImageName', 'image', 'Image'], ''),
    gpssModel: {
      text: pick(gpssModel, ['text', 'Text'], ''),
    },
    gpssEntities: toArray(pick(rawClass, ['gpssEntities', 'GpssEntities'], [])).map(normalizeGpssEntity),
    inputs: toArray(pick(rawClass, ['inputs', 'Inputs', 'inputDefinitions', 'InputDefinitions'], [])).map(normalizePort),
    outputs: toArray(pick(rawClass, ['outputs', 'Outputs', 'outputDefinitions', 'OutputDefinitions'], [])).map(normalizePort),
    parameters,
    states: toArray(pick(rawClass, ['states', 'States'], [])).map(normalizeState),
    childInstances: toArray(pick(childScheme, ['instances', 'Instances'], [])),
  };
}

export function createBlankGpssEntity() {
  return {
    id: crypto.randomUUID(),
    type: 'Savevalue',
    nameInModel: '',
    value: '',
    description: '',
  };
}

export function createBlankPort() {
  return {
    id: crypto.randomUUID(),
    nameInModel: '',
    header: '',
    connectedBlock: '',
    connectionsLimit: '',
    description: '',
  };
}

export function createBlankParameter() {
  return {
    id: crypto.randomUUID(),
    type: 'NumberParameterType',
    header: '',
    nameInModel: '',
    defaultValue: '',
    allowEmptyValues: false,
    currentValue: '',
  };
}

export function createBlankState() {
  return {
    id: crypto.randomUUID(),
    name: '',
    expression: '',
    description: '',
  };
}

export function reorder(items, index, direction) {
  const next = [...items];
  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= next.length) {
    return next;
  }

  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
