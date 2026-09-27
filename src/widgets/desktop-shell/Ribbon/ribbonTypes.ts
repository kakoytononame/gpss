export interface RibbonCommand {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
}

export interface RibbonGroup {
  title: string;
  commands: RibbonCommand[];
  className?: string;
}

export interface AppMenuItem {
  id: string;
  label: string;
  icon?: string;
  tone?: 'default' | 'danger';
  glyph?: 'question' | 'info' | 'exit';
  onClick: () => void;
}

export type AppMenuEntry = AppMenuItem | 'divider';

export const REPORT_TAB = 'Стандартный отчёт';
export const JOURNAL_TAB = 'Журнал моделирования';

export type RibbonTabId = 'Главная' | 'Моделирование' | 'Окна' | typeof REPORT_TAB | typeof JOURNAL_TAB;

export const BASE_RIBBON_TABS: RibbonTabId[] = ['Главная', 'Моделирование', 'Окна'];
