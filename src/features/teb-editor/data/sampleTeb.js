export const SAMPLE_TEB_CLASS = {
  id: '3ef71b95-07f7-41c6-b532-03d83d8a3973',
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
      type: 'Queue',
      nameInModel: 'BU3_Q',
      value: '',
      description: 'Очередь ожидания входа на блок-участок',
    },
    {
      type: 'Facility',
      nameInModel: 'BU3',
      value: '',
      description: 'Устройство блок-участка',
    },
  ],
  inputs: [
    {
      nameInModel: 'IN',
      header: 'Вход',
      connectedBlock: 'QUEUE',
      connectionsLimit: 1,
      description: 'Вход транзактов на участок',
    },
  ],
  outputs: [
    {
      nameInModel: 'OUT',
      header: 'Выход',
      connectedBlock: 'TRANSFER',
      connectionsLimit: 1,
      description: 'Переход к следующему участку',
    },
  ],
  parameters: [
    {
      type: 'NumberParameterType',
      header: 'Время прохода',
      nameInModel: 'travelTime',
      defaultValue: 5,
      allowEmptyValues: false,
      currentValue: 6,
    },
    {
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
      name: 'Busy',
      expression: 'F$BU3 = 1',
      description: 'Участок занят',
    },
    {
      name: 'QueueLength',
      expression: 'Q$BU3_Q',
      description: 'Длина очереди перед участком',
    },
  ],
  childScheme: {
    instances: [],
  },
};

export const SAMPLE_TEB_INSTANCE = {
  id: '80ba15bc-7a4a-4b36-ba57-df2cab3b89ad',
  type: 'TebInstance',
  nameInModel: 'BI_U_3_01',
  header: 'Экземпляр Т36а',
  class: SAMPLE_TEB_CLASS,
};
