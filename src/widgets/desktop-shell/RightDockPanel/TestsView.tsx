import { useState } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import copyIcon from '../../../shared/assets/icons/gpss-native/copy16.png';
import deleteIcon from '../../../shared/assets/icons/gpss-native/delete_16.png';
import testFailedIcon from '../../../shared/assets/icons/gpss-native/testfailed_16.png';
import testNotRunIcon from '../../../shared/assets/icons/gpss-native/testnotrun_16.png';
import testPassedIcon from '../../../shared/assets/icons/gpss-native/testpassed_16.png';
import type { TebTestItem, TebTestStatus } from '../../../shared/types/teb';

const STATUS_ICONS: Record<TebTestStatus, string> = {
  passed: testPassedIcon,
  failed: testFailedIcon,
  'not-run': testNotRunIcon,
  running: testNotRunIcon,
};

const STATUS_LABELS: Record<TebTestStatus, string> = {
  passed: 'пройден',
  failed: 'ошибка',
  'not-run': 'не запускался',
  running: 'выполняется',
};

/** Tests in groups by TEB, in the order the groups first appear. */
function groupTests(tests: TebTestItem[]): Array<[string, TebTestItem[]]> {
  const groups = new Map<string, TebTestItem[]>();
  tests.forEach((test) => {
    const group = test.group ?? 'Прочие';
    groups.set(group, [...(groups.get(group) ?? []), test]);
  });
  return [...groups.entries()];
}

/** "Тесты ТЭБов": checks of the TEBs of the project model (or of the TEB in the editor). */
export function TestsView() {
  const tests = useTebEditorStore((state) => state.tebTests);
  const busy = useTebEditorStore((state) => state.tebTestsBusy);
  const hasProject = useTebEditorStore((state) => state.project !== null);
  const runTebTests = useTebEditorStore((state) => state.runTebTests);
  const clearTebTests = useTebEditorStore((state) => state.clearTebTests);
  const focusTebTest = useTebEditorStore((state) => state.focusTebTest);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const [search, setSearch] = useState('');
  const [byTeb, setByTeb] = useState(true);

  const query = search.trim().toLowerCase();
  const visibleTests = query ? tests.filter((test) => `${test.group ?? ''} ${test.name} ${test.message}`.toLowerCase().includes(query)) : tests;
  const failed = tests.filter((test) => test.status === 'failed').length;

  async function copyResults() {
    const report = tests.map((test) => [test.group ?? '', test.name, STATUS_LABELS[test.status], test.message].join('\t')).join('\n');

    try {
      await navigator.clipboard.writeText(report);
      setStatusMessage('Результаты тестов ТЭБов скопированы.', 'saved');
    } catch {
      setStatusMessage('Браузер запретил доступ к буферу обмена.', 'warning');
    }
  }

  function renderTest(test: TebTestItem) {
    return (
      <button
        type="button"
        className={`teb-test-row teb-test-row--${test.status}`}
        key={test.id}
        title={test.sourceNodeId ? 'Показать ТЭБ на структурной схеме' : undefined}
        onClick={() => focusTebTest(test)}
      >
        <img src={STATUS_ICONS[test.status]} alt={STATUS_LABELS[test.status]} />
        <span>
          <span className="teb-test-row__name">{byTeb || !test.group ? test.name : `${test.group}: ${test.name}`}</span>
          <span className="teb-test-row__message">{test.message}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="teb-tests-view">
      <div className="teb-tests-toolbar">
        <button
          type="button"
          title={hasProject ? 'Запустить тесты ТЭБов модели' : 'Запустить тесты ТЭБа в редакторе'}
          aria-label="Запустить тесты"
          disabled={busy}
          onClick={() => void runTebTests()}
        >
          <img src={testNotRunIcon} alt="" aria-hidden="true" />
        </button>
        <button type="button" title="Сгруппировать по тэбам" aria-pressed={byTeb} onClick={() => setByTeb((value) => !value)}>
          По тэбам
        </button>
        <button
          type="button"
          title="Скопировать результаты"
          aria-label="Скопировать результаты"
          disabled={tests.length === 0}
          onClick={() => void copyResults()}
        >
          <img src={copyIcon} alt="" aria-hidden="true" />
        </button>
        <button type="button" title="Очистить результаты" aria-label="Очистить результаты" disabled={tests.length === 0} onClick={clearTebTests}>
          <img src={deleteIcon} alt="" aria-hidden="true" />
        </button>
        {tests.length > 0 ? (
          <span className={`teb-tests-summary ${failed > 0 ? 'has-failures' : ''}`} role="status">
            {busy ? 'Выполняются...' : `${tests.length - failed} из ${tests.length}`}
          </span>
        ) : null}
      </div>
      <input
        className="teb-tests-search"
        type="search"
        placeholder="Поиск тестов (F3)"
        aria-label="Поиск тестов"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="teb-tests-list">
        {tests.length === 0 ? (
          <p className="teb-tests-empty">
            {busy
              ? 'Выполняются тесты...'
              : hasProject
                ? 'Нажмите «Запустить тесты»: будут проверены все ТЭБы текущей модели проекта и сгенерированный по схеме текст модели.'
                : 'Нажмите «Запустить тесты», чтобы проверить ТЭБ, открытый в редакторе. Откройте проект, чтобы проверить ТЭБы его модели.'}
          </p>
        ) : byTeb ? (
          groupTests(visibleTests).map(([group, items]) => (
            <section key={group} className="teb-tests-group" aria-label={group}>
              <h4 className={items.some((test) => test.status === 'failed') ? 'has-failures' : undefined}>{group}</h4>
              {items.map(renderTest)}
            </section>
          ))
        ) : (
          visibleTests.map(renderTest)
        )}
      </div>
    </div>
  );
}
