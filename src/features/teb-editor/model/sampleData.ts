import type { TebDocument } from '../../../shared/types/teb';

export const SAMPLE_TEB_CLASS: TebDocument = {
  id: '38125a65-f781-48a5-96dd-0bd78372da5b',
  instanceId: '',
  mode: 'class',
  type: 'SimpleTebClass',
  nameInModel: '',
  header: 'Обслуживание посетителя. Касса 1',
  description: '',
  imageName: '',
  gpssModel: {
    text: `PERV    QUEUE        BUF1
SEIZE                         KASSA1
    DEPART    BUF1
        ADVANCE                x$ks,x$ks1
        RELEASE                  KASSA1

        QUEUE BUF1_1
        SEIZE VIDACHA1
    DEPART    BUF1_1
    ADVANCE x$vd,x$vd1
RELEASE VIDACHA1`,
  },
  gpssEntities: [],
  inputs: [
    {
      id: 'input-1',
      nameInModel: 'Вход 1',
      header: 'Вход',
      connectedBlock: 'FirstBlock',
      connectionsLimit: 0,
      description: '',
    },
  ],
  outputs: [
    {
      id: 'output-1',
      nameInModel: 'Выход 1',
      header: 'Выход',
      connectedBlock: 'LastBlock',
      connectionsLimit: 0,
      description: '',
    },
  ],
  parameters: [],
  states: [],
  childInstances: [],
};

export const SAMPLE_TEB_INSTANCE: TebDocument = {
  ...SAMPLE_TEB_CLASS,
  instanceId: 'sample-canteen-instance',
  mode: 'instance',
  header: 'Обслуживание посетителя. Касса 1',
};
