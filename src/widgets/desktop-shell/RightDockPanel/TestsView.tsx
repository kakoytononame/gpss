import { useState } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import copyIcon from '../../../shared/assets/icons/gpss-native/copy16.png';
import deleteIcon from '../../../shared/assets/icons/gpss-native/delete_16.png';
import testFailedIcon from '../../../shared/assets/icons/gpss-native/testfailed_16.png';
import testNotRunIcon from '../../../shared/assets/icons/gpss-native/testnotrun_16.png';
import testPassedIcon from '../../../shared/assets/icons/gpss-native/testpassed_16.png';
import type { TebTestStatus } from '../../../shared/types/teb';

const STATUS_ICONS: Record<TebTestStatus, string> = {
  passed: testPassedIcon,
  failed: testFailedIcon,
  'not-run': testNotRunIcon,
  running: testNotRunIcon,
};

/** Test that fails in the demo run until the class header check is implemented. */
const DEMO_FAILING_TEST_ID = 'test-parameters';

export function TestsView() {
  const tests = useTebEditorStore((state) => state.tebTests);
  const setTebTestStatus = useTebEditorStore((state) => state.setTebTestStatus);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const [search, setSearch] = useState('');

  const query = search.trim().toLowerCase();
  const visibleTests = query ? tests.filter((test) => `${test.name} ${test.message}`.toLowerCase().includes(query)) : tests;

  function runTests() {
    tests.forEach((test) => {
      const failed = test.id === DEMO_FAILING_TEST_ID;
      setTebTestStatus(test.id, failed ? 'failed' : 'passed', failed ? 'Требуется значение заголовка класса.' : 'Тест выполнен успешно.');
    });
  }

  function clearTests() {
    tests.forEach((test) => setTebTestStatus(test.id, 'not-run', 'Не запускался.'));
  }

  async function copyResults() {
    const report = tests.map((test) => `${test.name}\t${test.status}\t${test.message}`).join('\n');

    try {
      await navigator.clipboard.writeText(report);
      setStatusMessage('Результаты тестов ТЭБов скопированы.', 'saved');
    } catch {
      setStatusMessage('Браузер запретил доступ к буферу обмена.', 'warning');
    }
  }

  return (
    <div className="teb-tests-view">
      <div className="teb-tests-toolbar">
        <button type="button" title="Запустить тесты" aria-label="Запустить тесты" onClick={runTests}>
          <img src={testNotRunIcon} alt="" aria-hidden="true" />
        </button>
        <button type="button" title="Сгруппировать по тэбам">
          По тэбам
        </button>
        <button type="button" title="Скопировать результаты" aria-label="Скопировать результаты" onClick={() => void copyResults()}>
          <img src={copyIcon} alt="" aria-hidden="true" />
        </button>
        <button type="button" title="Очистить результаты" aria-label="Очистить результаты" onClick={clearTests}>
          <img src={deleteIcon} alt="" aria-hidden="true" />
        </button>
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
        {visibleTests.map((test) => (
          <div className={`teb-test-row teb-test-row--${test.status}`} key={test.id}>
            <img src={STATUS_ICONS[test.status]} alt="" aria-hidden="true" />
            <div>
              <div className="teb-test-row__name">{test.name}</div>
              <div className="teb-test-row__message">{test.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
