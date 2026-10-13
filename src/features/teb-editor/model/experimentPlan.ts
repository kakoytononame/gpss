import type { ExperimentFactor, ExperimentIndicator, ExperimentResult, FactorKind } from '../../../shared/types/experiment';

/** Factor as edited in the form: levels are typed as text ("4; 6; 8" or "4..10 step 2"). */
export interface FactorDraft {
  name: string;
  kind: FactorKind;
  levels: string;
  /** Operand factors (form plans): 1-based model line and operand letter. */
  line?: number;
  operand?: string;
}

export interface IndicatorDraft {
  expression: string;
  label: string;
}

export interface ExperimentPlan {
  factors: FactorDraft[];
  indicators: IndicatorDraft[];
  replications: number;
  startCount: number;
  /** Index of the objective indicator, or -1 for none. */
  objective: number;
  maximize: boolean;
}

export const FACTOR_KIND_LABELS: Record<FactorKind, string> = {
  Savevalue: 'Ячейка X$',
  Storage: 'Ёмкость памяти',
  Equ: 'Константа EQU',
  Operand: 'Операнд строки',
};

const MAX_LEVELS = 50;
/** More factors make the full factorial plan too large to be useful. */
const MAX_SUGGESTED_FACTORS = 4;

/** "4; 6; 8", "4 6 8" or a range "4..10 step 2" (also "4..10 шаг 2"). */
export function parseLevels(text: string): number[] {
  const range = /^\s*(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)(?:\s*(?:step|шаг)\s*([\d.]+))?\s*$/i.exec(text);
  if (range) {
    const [from, to, step] = [Number(range[1]), Number(range[2]), Number(range[3] ?? 1)];
    if (!Number.isFinite(from) || !Number.isFinite(to) || !(step > 0)) {
      return [];
    }

    const levels: number[] = [];
    for (let value = from; value <= to + 1e-9 && levels.length < MAX_LEVELS; value += step) {
      levels.push(Number(value.toFixed(10)));
    }

    return levels;
  }

  return text
    .split(/[;\s]+/)
    .map((item) => item.trim().replace(',', '.'))
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite)
    .slice(0, MAX_LEVELS);
}

export function toRequestFactors(factors: FactorDraft[]): ExperimentFactor[] {
  return factors
    .filter((factor) => factor.name.trim())
    .map((factor) => ({
      Name: factor.name.trim(),
      Kind: factor.kind,
      Levels: parseLevels(factor.levels),
      ...(factor.kind === 'Operand' ? { Line: factor.line ?? null, Operand: factor.operand ?? null } : {}),
    }));
}

export function toRequestIndicators(indicators: IndicatorDraft[]): ExperimentIndicator[] {
  return indicators
    .filter((indicator) => indicator.expression.trim())
    .map((indicator) => ({ Expression: indicator.expression.trim(), Label: indicator.label.trim() || null }));
}

/** Factor candidates found in the model: INITIAL X$, STORAGE and EQU statements. */
export function suggestFactors(modelText: string): FactorDraft[] {
  const found = new Map<string, FactorDraft>();
  for (const line of modelText.split('\n')) {
    const code = line.split(';')[0];
    const initial = /^\s*INITIAL\s+X\$([\wА-Яа-яЁё]+)\s*,\s*(-?[\d.]+)/i.exec(code);
    const storage = /^\s*([\wА-Яа-яЁё]+)\s+STORAGE\s+(\d+)/i.exec(code);
    const equ = /^\s*([\wА-Яа-яЁё]+)\s+EQU\s+(-?[\d.]+)/i.exec(code);
    if (initial) {
      found.set(`X:${initial[1]}`, { name: initial[1], kind: 'Savevalue', levels: initial[2] });
    } else if (storage) {
      found.set(`S:${storage[1]}`, { name: storage[1], kind: 'Storage', levels: storage[2] });
    } else if (equ) {
      found.set(`E:${equ[1]}`, { name: equ[1], kind: 'Equ', levels: equ[2] });
    }
  }

  return [...found.values()].slice(0, MAX_SUGGESTED_FACTORS);
}

/** Indicator candidates: utilisation of facilities and storages, waiting time in queues. */
export function suggestIndicators(modelText: string): IndicatorDraft[] {
  const found = new Map<string, IndicatorDraft>();
  const add = (expression: string, label: string) => found.set(expression.toUpperCase(), { expression, label });
  for (const line of modelText.split('\n')) {
    const code = line.split(';')[0];
    const match = /^\s*(?:[\wА-Яа-яЁё]+\s+)?(SEIZE|QUEUE|ENTER)\s+([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)/i.exec(code);
    if (!match) {
      continue;
    }

    const [operation, name] = [match[1].toUpperCase(), match[2]];
    if (operation === 'SEIZE') {
      add(`FR$${name}`, `Загрузка ${name}, ‰`);
    } else if (operation === 'QUEUE') {
      add(`QT$${name}`, `Ожидание в ${name}`);
    } else {
      add(`SR$${name}`, `Загрузка памяти ${name}, ‰`);
    }
  }

  return [...found.values()].slice(0, 8);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Summary of an experiment series as CSV for Excel (";" separators, decimal comma left to Excel). */
export function experimentToCsv(result: ExperimentResult): string {
  const header: Array<string | number> = [
    'Точка',
    ...result.FactorNames,
    ...result.IndicatorNames.flatMap((name) => [`${name}: среднее`, `${name}: ±95%`, `${name}: σ`]),
  ];
  const rows = result.Points.map((point): Array<string | number> => [
    point.Index + 1,
    ...point.Factors,
    ...point.Indicators.flatMap((summary): Array<string | number> =>
      summary ? [summary.Mean, summary.ConfidenceHalfWidth, summary.StandardDeviation] : ['', '', ''],
    ),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
}
