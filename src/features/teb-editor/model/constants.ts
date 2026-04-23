import type { OptionDefinition, TabDefinition, TabId } from '../../../shared/types/teb';

export const PARAMETER_TYPES: OptionDefinition[] = [
  { value: 'NameOrPartParameterType', label: 'Имя / часть имени' },
  { value: 'IntegerParameterType', label: 'Целое число' },
  { value: 'NumberParameterType', label: 'Вещественное число' },
  { value: 'ExpressionParameterType', label: 'Выражение' },
];

export const EDITOR_TABS: TabDefinition[] = [
  { id: 'general', label: 'Общие' },
  { id: 'gpss-model', label: 'GPSS модель' },
  { id: 'gpss-objects', label: 'GPSS объекты' },
  { id: 'inputs', label: 'Входы' },
  { id: 'outputs', label: 'Выходы' },
  { id: 'parameters', label: 'Параметры' },
  { id: 'states', label: 'Состояния' },
];

const ALL_TAB_IDS = EDITOR_TABS.map((tab) => tab.id);

export function visibleTabsForType(type?: string): TabId[] {
  if (type === 'SimpleTebClass') {
    return ALL_TAB_IDS;
  }

  if (type === 'CompositeTebClass') {
    return ALL_TAB_IDS.filter((tabId) => tabId !== 'gpss-model' && tabId !== 'gpss-objects');
  }

  if (type === 'GlobalDataTebClass') {
    return ['general', 'gpss-model', 'gpss-objects'];
  }

  return ['general'];
}
