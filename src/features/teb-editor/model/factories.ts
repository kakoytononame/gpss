import { createId } from '../../../shared/lib/utils';
import type { GpssEntity, TebParameter, TebPort, TebState } from '../../../shared/types/teb';

export function createBlankGpssEntity(): GpssEntity {
  return {
    id: createId(),
    type: 'Savevalue',
    nameInModel: '',
    value: '',
    description: '',
  };
}

export function createBlankPort(): TebPort {
  return {
    id: createId(),
    nameInModel: '',
    header: '',
    connectedBlock: '',
    connectionsLimit: '',
    description: '',
  };
}

export function createBlankParameter(): TebParameter {
  return {
    id: createId(),
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
    id: createId(),
    name: '',
    expression: '',
    description: '',
  };
}
