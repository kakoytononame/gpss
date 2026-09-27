/** Chart roles (reference data-viz palette, light surface). One series per chart uses slot 1. */
export const CHART_THEME = {
  series: '#2a78d6',
  surface: '#fcfcfb',
  grid: '#e3e6ea',
  axis: '#8a93a0',
  textPrimary: '#20242b',
  textSecondary: '#52514e',
} as const;

export const AXIS_TICK = { fill: CHART_THEME.textSecondary, fontSize: 11 };

export function formatNumber(value: number, digits = 3): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}
