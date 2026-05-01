import type { IssueItem, SchemeLink, SchemeNode, TebTestItem } from '../../../shared/types/teb';

export const INITIAL_SCHEME_NODES: SchemeNode[] = [
  { id: 'source-data', label: 'Исходные данные моделирования', kind: 'data', x: 56, y: 48, width: 250, height: 110 },
  { id: 'time-control', label: 'Управление временем моделирования', kind: 'time', x: 36, y: 210, width: 300, height: 96 },
  { id: 'arrival', label: 'Прибытие посетителей', kind: 'teb', x: 677, y: 58, width: 166, height: 68 },
  { id: 'kitchen-choice', label: 'Выбор кухни', kind: 'teb', x: 685, y: 206, width: 150, height: 52 },
  { id: 'cashier-1', label: 'Обслуживание посетителя Касса 1', kind: 'teb', x: 377, y: 348, width: 166, height: 68 },
  { id: 'cashier-2', label: 'Обслуживание посетителя Касса 2', kind: 'teb', x: 517, y: 378, width: 166, height: 68 },
  { id: 'cashier-3', label: 'Обслуживание посетителя Касса 3', kind: 'teb', x: 677, y: 378, width: 166, height: 68 },
  { id: 'cashier-4', label: 'Обслуживание посетителя Касса 4', kind: 'teb', x: 837, y: 378, width: 166, height: 68 },
  { id: 'cashier-5', label: 'Обслуживание посетителя Касса 5', kind: 'teb', x: 977, y: 348, width: 166, height: 68 },
  { id: 'free-seat', label: 'Выбор свободного места', kind: 'teb', x: 677, y: 556, width: 166, height: 68 },
];

export const INITIAL_SCHEME_LINKS: SchemeLink[] = [
  { id: 'arrival-to-choice', from: 'arrival', to: 'kitchen-choice' },
  { id: 'choice-to-cashier-1', from: 'kitchen-choice', to: 'cashier-1' },
  { id: 'choice-to-cashier-2', from: 'kitchen-choice', to: 'cashier-2' },
  { id: 'choice-to-cashier-3', from: 'kitchen-choice', to: 'cashier-3' },
  { id: 'choice-to-cashier-4', from: 'kitchen-choice', to: 'cashier-4' },
  { id: 'choice-to-cashier-5', from: 'kitchen-choice', to: 'cashier-5' },
  { id: 'cashier-1-to-free-choice', from: 'cashier-1', to: 'free-seat' },
  { id: 'cashier-2-to-free-choice', from: 'cashier-2', to: 'free-seat' },
  { id: 'cashier-3-to-free-choice', from: 'cashier-3', to: 'free-seat' },
  { id: 'cashier-4-to-free-choice', from: 'cashier-4', to: 'free-seat' },
  { id: 'cashier-5-to-free-choice', from: 'cashier-5', to: 'free-seat' },
];

export const INITIAL_ISSUES: IssueItem[] = [
  {
    id: 'issue-no-errors',
    type: 'info',
    description: 'Ошибок модели не обнаружено.',
    library: 'Библиотека ТЭБов',
    className: 'SimpleTebClass',
    instance: 'Касса 1',
    documentId: 'scheme',
  },
  {
    id: 'issue-demo-report',
    type: 'warning',
    description: 'Отчет сформирован демонстрационным расчетом до подключения GPSS World Core.',
    library: 'Столовая',
    className: 'Отчет',
    instance: 'Стандартный отчет',
    documentId: 'std-report',
  },
];

export const INITIAL_TEB_TESTS: TebTestItem[] = [
  { id: 'test-ports', name: 'Проверка входных портов', status: 'passed', message: 'Ошибок не найдено', sourceNodeId: 'arrival' },
  { id: 'test-gpss-model', name: 'Проверка GPSS модели', status: 'not-run', message: 'Не запускалась', sourceNodeId: 'kitchen-choice' },
  { id: 'test-parameters', name: 'Проверка параметров класса', status: 'failed', message: 'Требуется значение заголовка', sourceNodeId: 'cashier-1' },
];
