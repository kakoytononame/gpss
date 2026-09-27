import { vi } from 'vitest';
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
 * returns 404, simulation endpoints return a completed run and other mutations answer 200.
 */
export function mockBackend(respond: Responder = () => undefined) {
  const requests: RecordedRequest[] = [];

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
