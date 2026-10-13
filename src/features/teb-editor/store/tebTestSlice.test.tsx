import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockBackend, studioProject } from '../../../test/fixtures';
import { resetStore, store } from '../../../test/store';
import { TestsView } from '../../../widgets/desktop-shell/RightDockPanel/TestsView';
import { sampleDocument } from './slices/tebSlice';

const PROJECTS = '/api/alina-gpss/studio/projects';

function generationBackend() {
  return mockBackend((request) => {
    if (request.url === `${PROJECTS}/project-1` && request.method === 'GET') {
      return { status: 200, body: studioProject() };
    }

    if (request.url === `${PROJECTS}/generate`) {
      return {
        status: 200,
        body: {
          Text: ' GENERATE 5',
          GeneratedLines: 9,
          Success: false,
          Messages: [{ Severity: 'error', Message: 'Для входа №1 не задан связанный блок.', NodeId: 'teb3', Teb: 'Станок' }],
        },
      };
    }

    return undefined;
  });
}

beforeEach(() => resetStore());

describe('TEB tests', () => {
  it('runs the tests of the project TEBs with the model generator', async () => {
    const backend = generationBackend();
    await store().openProject('project-1');

    await store().runTebTests();

    const generate = backend.requests.find((request) => request.url.endsWith('/generate'));
    expect(generate?.body).toMatchObject({ ModelName: 'Модель 1', Scheme: { Nodes: expect.any(Array) } });
    expect(store().rightPanelTab).toBe('teb-tests');
    expect(store().tebTests.find((test) => test.id === 'teb-teb3-ports')).toMatchObject({ status: 'failed', schemePath: ['teb2'] });
    expect(store().syncStatus).toBe('warning');
    expect(store().syncMessage).toMatch(/^Тесты ТЭБов: пройдено \d+ из \d+, с ошибками 2\.$/);
  });

  it('checks the TEBs without connections when the generator is unreachable', async () => {
    mockBackend((request) => (request.url.endsWith('/generate') ? { status: 500, body: { detail: 'Сбой' } } : undefined));
    resetStore({ project: studioProject() });

    await store().runTebTests();

    expect(store().tebTests.length).toBeGreaterThan(0);
    expect(store().tebTests.some((test) => test.name === 'Входы и выходы')).toBe(false);
    expect(store().syncMessage).toContain('Связи и трансляция не проверены');
  });

  it('tests the TEB in the editor without a project', async () => {
    resetStore({ teb: { ...sampleDocument('class'), nameInModel: 'KASSA1' } });

    await store().runTebTests();

    expect(store().tebTests.map((test) => test.status)).toEqual(['passed', 'passed', 'passed', 'passed']);
  });

  it('shows the TEB of a test inside its composite TEB', async () => {
    generationBackend();
    await store().openProject('project-1');
    await store().runTebTests();

    store().focusTebTest(store().tebTests.find((test) => test.id === 'teb-teb3-ports')!);

    expect(store().schemePath).toEqual(['teb2']);
    expect(store().schemeSelection).toEqual({ type: 'node', id: 'teb3' });
    expect(store().activeDocument).toBe('scheme');
  });

  it('lists the results grouped by TEB and opens the TEB on click', async () => {
    generationBackend();
    await store().openProject('project-1');
    render(<TestsView />);

    await userEvent.click(screen.getByRole('button', { name: 'Запустить тесты' }));

    const machine = await screen.findByRole('region', { name: 'Станок' });
    expect(within(machine).getByRole('heading', { name: 'Станок' })).toHaveClass('has-failures');
    await userEvent.click(within(machine).getByText('Для входа №1 не задан связанный блок.'));
    expect(store().schemeSelection).toEqual({ type: 'node', id: 'teb3' });

    await userEvent.click(screen.getByRole('button', { name: 'По тэбам' }));
    expect(screen.queryByRole('region', { name: 'Станок' })).toBeNull();
    expect(screen.getByText('Станок: Входы и выходы')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Очистить результаты' }));
    expect(store().tebTests).toEqual([]);
  });
});
