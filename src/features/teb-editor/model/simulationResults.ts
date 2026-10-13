import type { StudioForm } from '../../../shared/types/project';
import type { ResultInputValue, SimulationResultKind, SimulationResultSummary } from '../../../shared/types/result';

export const RESULT_KIND_LABELS: Record<SimulationResultKind, string> = {
  single: 'Одиночные эксперименты',
  series: 'Серии экспериментов',
};

const NAME_PREFIXES: Record<SimulationResultKind, string> = {
  single: 'Эксперимент',
  series: 'Серия экспериментов',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** "13.10.2026 14:05" in local time. */
export function formatResultDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Default name of a saved result, as GPSS Studio names the nodes of the result tree. */
export function defaultResultName(kind: SimulationResultKind, date: Date, formName?: string | null): string {
  return `${NAME_PREFIXES[kind]}${formName ? ` «${formName}»` : ''} от ${formatResultDate(date)}`;
}

/** Input data of the form as flat rows (input, operand, value) kept with a single experiment. */
export function formInputValues(form: StudioForm | undefined): ResultInputValue[] {
  return (form?.Inputs ?? []).flatMap((input) =>
    input.Operands.map((operand) => ({ Input: input.Name, Name: operand.Name, Operand: operand.Operand, Value: operand.Value })),
  );
}

/** Results split into the two branches of the tree, oldest first as the server lists them. */
export function groupResults(results: SimulationResultSummary[]): Record<SimulationResultKind, SimulationResultSummary[]> {
  return {
    single: results.filter((result) => result.Kind === 'single'),
    series: results.filter((result) => result.Kind === 'series'),
  };
}
