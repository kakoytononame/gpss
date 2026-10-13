import { vi } from 'vitest';
import type { FormControl, StudioForm, StudioProject, StudioTebNode, StudioTebPort } from '../shared/types/project';
import type { SimulationResult } from '../shared/types/simulation';

/** Class payload in the shape returned by the ASP.NET backend (PascalCase). */
export const CLASS_PAYLOAD = {
  ClassId: '3ef71b95-07f7-41c6-b532-03d83d8a3973',
  LibraryId: '0',
  Type: 'SimpleTebClass',
  NameInModel: 'BI_U_3',
  Header: 'Блок-участок 2',
  Description: 'Описание участка',
  ImageName: 'teb.png',
  ImageUrl: 'data:image/png;base64,AAAA',
  GpssModel: { Metadata: {}, Text: 'QUEUE BU3_Q\nSEIZE BU3' },
  GpssEntities: [{ Id: 'e1', Type: 'Queue', NameInModel: 'BU3_Q', Value: '', Description: 'Очередь' }],
  Inputs: [{ Id: 'i1', NameInModel: 'IN', Header: 'Вход', ConnectedBlock: 'QUEUE', ConnectionsLimit: '1', Description: '' }],
  Outputs: [{ Id: 'o1', NameInModel: 'OUT', Header: 'Выход', ConnectedBlock: 'TRANSFER', ConnectionsLimit: '1', Description: '' }],
  Parameters: [
    { Id: 'p1', Type: 'NumberParameterType', Header: 'Время', NameInModel: 'travelTime', DefaultValue: '5', AllowEmptyValues: false },
    { Id: 'p2', Type: 'NameOrPartParameterType', Header: 'Станция', NameInModel: 'NEXT_STATION', DefaultValue: 'ARRIVAL', AllowEmptyValues: false },
  ],
  States: [{ Id: 's1', Header: 'Busy', NameInModel: 'Busy', Expression: 'F$BU3 = 1', Description: '' }],
};

export const INSTANCE_PAYLOAD = {
  Id: '80ba15bc-7a4a-4b36-ba57-df2cab3b89ad',
  NameInModel: 'BI_U_3_01',
  Text: '',
  ParameterValues: [
    { NameInModel: 'travelTime', Value: '6' },
    { NameInModel: 'NEXT_STATION', Value: 'DEPOT' },
  ],
  Class: CLASS_PAYLOAD,
};

export function simulationResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    SessionId: 'session-1',
    Success: true,
    State: 'completed',
    Clock: 1440,
    TerminationCount: 0,
    Errors: [],
    RuntimeError: null,
    Journal: ['Моделирование завершено. Время 1440.000000.'],
    Report: {
      ModelName: 'Столовая',
      CreatedAt: '2026-09-26T00:00:00Z',
      StartTime: 0,
      EndTime: 1440,
      Sections: [
        { Id: 'general', Label: 'Общая информация', Columns: ['Начальное время', 'Конечное время'], Rows: [['0.000', '1440.000']] },
        { Id: 'facilities', Label: 'Устройства', Columns: ['Имя / номер', 'Коэффициент использования'], Rows: [['KASSA1', '0.278']] },
      ],
      Charts: {
        TimeSeries: [
          {
            Kind: 'queue',
            Name: 'BUF1',
            Points: [
              [0, 0],
              [10, 1],
              [20, 0],
            ],
          },
        ],
        FacilityUtilization: [{ Name: 'KASSA1', Value: 0.278 }],
        QueueAverageContent: [{ Name: 'BUF1', Value: 0.02 }],
        QueueAverageTime: [{ Name: 'BUF1', Value: 0.4 }],
        StorageUtilization: [],
        BlockEntries: [{ Name: '1 GENERATE', Value: 338 }],
        Tables: [],
      },
    },
    ...overrides,
  };
}

export interface RecordedRequest {
  url: string;
  method: string;
  body: unknown;
}

type Responder = (request: RecordedRequest) => { status: number; body?: unknown } | undefined;

/**
 * Replaces global fetch with a router: GET class/instance return fixtures, the workspace
 * returns 404, simulation endpoints return a completed run, saved results live in memory
 * and other mutations answer 200.
 */
export function mockBackend(respond: Responder = () => undefined) {
  const requests: RecordedRequest[] = [];
  const results = new Map<string, Record<string, unknown>>();

  /** In-memory `/studio/results`: list, get, create, rename, delete. */
  const storedResults = (request: RecordedRequest): { status: number; body?: unknown } => {
    const id = /\/studio\/results\/([^/?]+)/.exec(request.url)?.[1];
    const summary = ({ Payload: _payload, ...rest }: Record<string, unknown>) => rest;
    if (!id) {
      if (request.method === 'POST') {
        const body = request.body as Record<string, unknown>;
        const created = { ...body, Id: `result-${results.size + 1}`, CreatedAt: '2026-10-13T10:00:00Z' };
        results.set(created.Id, created);
        return { status: 201, body: created };
      }

      return { status: 200, body: [...results.values()].map(summary) };
    }

    const stored = results.get(id);
    if (!stored) {
      return { status: 404, body: { detail: `Результат ${id} не найден.` } };
    }

    if (request.method === 'PATCH') {
      stored.Name = (request.body as { Name: string }).Name;
      return { status: 200, body: summary(stored) };
    }

    if (request.method === 'DELETE') {
      results.delete(id);
      return { status: 204 };
    }

    return { status: 200, body: stored };
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const request: RecordedRequest = {
      url: String(input),
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    requests.push(request);

    const fallback = (): { status: number; body?: unknown } => {
      if (request.url.includes('/simulation/examples/')) {
        return { status: 200, body: { Id: 'canteen', Name: 'Столовая', Text: '  GENERATE 10\n  TERMINATE 1\n  START 1' } };
      }

      if (request.url.includes('/simulation/translate')) {
        return { status: 200, body: simulationResult({ SessionId: null, State: 'idle', Report: null, Journal: ['Трансляция завершена.'] }) };
      }

      if (request.url.includes('/simulation/')) {
        return { status: 200, body: simulationResult() };
      }

      if (request.url.includes('/studio/results')) {
        return storedResults(request);
      }

      if (request.method !== 'GET') {
        return { status: 200, body: {} };
      }

      if (request.url.endsWith('/workspace')) {
        return { status: 404, body: { title: 'Resource not found' } };
      }

      return { status: 200, body: request.url.includes('/instances/') ? INSTANCE_PAYLOAD : CLASS_PAYLOAD };
    };

    const { status, body } = respond(request) ?? fallback();
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { requests, fetchMock, mutations: () => requests.filter((request) => request.method !== 'GET') };
}

/** Two-level project: arrivals → composite "Цех" (one elementary TEB inside) plus a data TEB. */
export function studioProject(): StudioProject {
  const port = (Id: number, Mode: StudioTebPort['Mode']): StudioTebPort => ({
    Id,
    Mode,
    Label: null,
    ConnectionsLimit: 0,
    TransferMode: 'DirectOrSplit',
    Side: 1,
    Position: 0.5,
  });
  const node = (Id: string, Header: string, overrides: Partial<StudioTebNode> = {}): StudioTebNode => ({
    Id,
    Kind: 'simple',
    Header,
    NameInModel: Id,
    ClassId: `class-${Id}`,
    InstancesCount: 1,
    X: 100,
    Y: 100,
    Width: 160,
    Height: 60,
    GpssText: ' GENERATE 5',
    Entities: [],
    Inputs: [],
    Outputs: [],
    Parameters: [],
    States: [],
    ...overrides,
  });

  return {
    Id: 'project-1',
    Name: 'Мастерская',
    Description: 'Тест',
    Models: [
      {
        Name: 'Модель 1',
        IsCurrent: true,
        Forms: [],
        ModelText: '* сохранённый текст\n GENERATE 1\n TERMINATE 1\n',
        Scheme: {
          Nodes: [
            node('teb1', 'Поступление', { Outputs: [port(2, 'LastBlock')] }),
            node('teb2', 'Цех', {
              Kind: 'composite',
              X: 1500,
              Y: 900,
              Inputs: [port(1, 'FirstBlock')],
              Child: {
                Nodes: [node('teb3', 'Станок', { GpssText: ' SEIZE M\n ADVANCE 3\n RELEASE M\n TERMINATE 1', Inputs: [port(1, 'FirstBlock')] })],
                Links: [
                  { Id: 'in', FromNodeId: 'boundary:1', FromPortId: 0, ToNodeId: 'teb3', ToPortId: 1, Priority: 0, Probability: 0, OrderIndex: 0, Points: [] },
                ],
                Decors: [],
                Boundary: [{ Id: 'boundary:1', Direction: 'input', DefinitionId: 1 }],
              },
            }),
            node('data', 'Данные', { Kind: 'data', GpssText: null, Entities: [{ Type: 'Matrix', Name: 'Plan', Cells: [['1', '2']] }] }),
          ],
          Links: [{ Id: 'l1', FromNodeId: 'teb1', FromPortId: 2, ToNodeId: 'teb2', ToPortId: 1, Priority: 0, Probability: 0, OrderIndex: 0, Points: [] }],
          Decors: [],
          Boundary: [],
        },
      },
    ],
    Libraries: [],
    ImportNotes: [],
  };
}

function control(Type: FormControl['Type'], patch: Partial<FormControl> = {}): FormControl {
  return { Type, Name: Type, X: 0, Y: 0, Width: 80, Height: 20, FontSize: 8.25, Choices: [], Intervals: [], Series: [], Children: [], ...patch };
}

/** Form of a port model: two inputs (EQU, INITIAL), indicators, plan and both layouts. */
export function studioForm(): StudioForm {
  return {
    Name: 'Порт',
    ModelText: 'Berth EQU 1\nINITIAL X$Gap,26\nGENERATE X$Gap\nTERMINATE 1\n',
    HasAnimation: false,
    Inputs: [
      {
        Number: 0,
        Name: 'Berth',
        Kind: 'command',
        Operator: 'equ',
        Line: 1,
        Operands: [{ Name: 'Операнд A', Operand: 'A', ValueType: 'Numeric', Value: '1', DefaultValue: '1' }],
      },
      {
        Number: 1,
        Name: '(2) INITIAL',
        Kind: 'command',
        Operator: 'initial',
        Line: 2,
        Operands: [{ Name: 'Интервал', Operand: 'B', ValueType: 'Numeric', Value: '30', DefaultValue: '26' }],
      },
    ],
    Indicators: [
      { Id: 10, Title: 'Причал', Object: 'Berth', ObjectType: 'Storage', Sna: 'S', Expression: 'S$Berth', Monitored: true },
      { Id: 15, Title: 'Причал', Object: 'Berth', ObjectType: 'Storage', Sna: 'SR', Expression: 'SR$Berth', Monitored: false },
      { Id: 20, Title: 'Матрица', Object: 'M', ObjectType: 'Matrix', Sna: 'MX(1,1)', Expression: null, Monitored: true },
    ],
    Run: { StartCount: 50, CollectDynamics: true, MonitorInterval: 60, ModelTimeUnit: 'Minutes', Period: 500, PeriodUnit: 'Days' },
    Plan: {
      Method: 'Stepwise',
      Factors: [{ Id: 1, Name: 'Интервал', Line: 2, Operand: 'B', Object: '(2) INITIAL', Default: 26, Min: 20, Max: 24, Step: 2 }],
      Targets: [{ Name: 'Загрузка причала', Expression: 'SR$Berth' }],
      Points: [[20], [22], [24]],
    },
    EntryForm: control('panel', {
      Width: 400,
      Height: 200,
      Children: [
        control('label', { Text: 'Интервал прихода', X: 5, Y: 5 }),
        control('input', { Name: 'GapInput', X: 120, Y: 5, Input: 1, Operand: 'B', Value: '30' }),
        control('combo', {
          Name: 'BerthCombo',
          X: 120,
          Y: 40,
          Input: 0,
          Operand: 'A',
          Choices: [
            { Label: 'Один', Value: '1' },
            { Label: 'Два', Value: '2' },
          ],
        }),
      ],
    }),
    DynamicForm: control('panel', {
      Width: 400,
      Height: 200,
      Children: [
        control('sna', {
          Name: 'BusyBox',
          Indicator: 10,
          Intervals: [
            { Low: 0, High: 1, BackColor: '#7CFC00' },
            { Low: 2, High: 100, BackColor: 'Red' },
          ],
        }),
        control('chart', { Name: 'Chart', Series: [{ Name: 'Загрузка', ViewType: 'Bar', Points: [{ Argument: 'Причал', Indicator: 15 }] }] }),
      ],
    }),
    Images: {},
  };
}

/** {@link studioProject} whose model has {@link studioForm}. */
export function studioProjectWithForm(): StudioProject {
  const project = studioProject();
  return { ...project, Models: project.Models.map((model) => ({ ...model, Forms: ['Порт'], UserForms: [studioForm()] })) };
}
