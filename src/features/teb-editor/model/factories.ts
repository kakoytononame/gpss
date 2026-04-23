import type { GpssEntity, TebParameter, TebPort, TebState } from '../../../shared/types/teb';

export function createBlankGpssEntity(): GpssEntity {
  return {
    id: crypto.randomUUID(),
    type: 'Savevalue',
    nameInModel: '',
    value: '',
    description: '',
  };
}

export function createBlankPort(): TebPort {
  return {
    id: crypto.randomUUID(),
    nameInModel: '',
    header: '',
    connectedBlock: '',
    connectionsLimit: '',
    description: '',
  };
}

export function createBlankParameter(): TebParameter {
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

export function createBlankState(): TebState {
  return {
    id: crypto.randomUUID(),
    name: '',
    expression: '',
    description: '',
  };
}
