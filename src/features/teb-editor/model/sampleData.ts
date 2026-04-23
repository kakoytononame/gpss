import type { TebDocument } from '../../../shared/types/teb';

export const SAMPLE_TEB_CLASS: TebDocument = {
  id: '3ef71b95-07f7-41c6-b532-03d83d8a3973',
  instanceId: '',
  mode: 'class',
  type: 'SimpleTebClass',
  nameInModel: 'BI_U_3',
  header: 'Блок-участок 2',
  description:
    'Поезд ожидает входа на участок. После освобождения блок-участка предыдущим составом поезд входит на него. После прохождения участка поезд следует на станцию прибытия.',
  imageName: '',
  gpssModel: {
    text: `; Блок-участок
QUEUE     BU3_Q
SEIZE     BU3
DEPART    BU3_Q
ADVANCE   travelTime
RELEASE   BU3
TRANSFER  ,NEXT_STATION`,
  },
  gpssEntities: [
    {
      id: 'entity-queue',
      type: 'Queue',
      nameInModel: 'BU3_Q',
      value: '',
      description: 'Очередь ожидания входа на блок-участок',
    },
    {
      id: 'entity-facility',
      type: 'Facility',
      nameInModel: 'BU3',
      value: '',
      description: 'Устройство блок-участка',
    },
  ],
  inputs: [
    {
      id: 'input-1',
      nameInModel: 'IN',
      header: 'Вход',
      connectedBlock: 'QUEUE',
      connectionsLimit: 1,
      description: 'Вход транзактов на участок',
    },
  ],
  outputs: [
    {
      id: 'output-1',
      nameInModel: 'OUT',
      header: 'Выход',
      connectedBlock: 'TRANSFER',
      connectionsLimit: 1,
      description: 'Переход к следующему участку',
    },
  ],
  parameters: [
    {
      id: 'parameter-1',
      type: 'NumberParameterType',
      header: 'Время прохода',
      nameInModel: 'travelTime',
      defaultValue: 5,
      allowEmptyValues: false,
      currentValue: 6,
    },
    {
      id: 'parameter-2',
      type: 'NameOrPartParameterType',
      header: 'Следующая станция',
      nameInModel: 'NEXT_STATION',
      defaultValue: 'ARRIVAL',
      allowEmptyValues: false,
      currentValue: 'ARRIVAL',
    },
  ],
  states: [
    {
      id: 'state-1',
      name: 'Busy',
      expression: 'F$BU3 = 1',
      description: 'Участок занят',
    },
    {
      id: 'state-2',
      name: 'QueueLength',
      expression: 'Q$BU3_Q',
      description: 'Длина очереди перед участком',
    },
  ],
  childInstances: [],
};

export const SAMPLE_TEB_INSTANCE: TebDocument = {
  ...SAMPLE_TEB_CLASS,
  id: '3ef71b95-07f7-41c6-b532-03d83d8a3973',
  instanceId: '80ba15bc-7a4a-4b36-ba57-df2cab3b89ad',
  mode: 'instance',
  header: 'Экземпляр Т36а',
  nameInModel: 'BI_U_3_01',
};
