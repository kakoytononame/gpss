import type { SimulationMonitoring } from '../../../shared/api/simulationApi';
import type { FormControl, FormIndicator, StudioForm, StudioProject } from '../../../shared/types/project';
import type { ExperimentPlan, FactorDraft, IndicatorDraft } from './experimentPlan';

export function isSet<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** The simulator collects at most this many indicators over time. */
const MAX_MONITORS = 64;

export function modelForms(project: StudioProject | null, modelIndex: number): StudioForm[] {
  return project?.Models[modelIndex]?.UserForms ?? [];
}

/** Current value of an operand of a form input (the value written into the model text). */
export function inputValue(form: StudioForm, inputNumber: number, operand: string): string | undefined {
  return form.Inputs.find((input) => input.Number === inputNumber)?.Operands.find((item) => item.Operand === operand)?.Value;
}

export function withInputValue(form: StudioForm, inputNumber: number, operand: string, value: string): StudioForm {
  return {
    ...form,
    Inputs: form.Inputs.map((input) =>
      input.Number === inputNumber
        ? { ...input, Operands: input.Operands.map((item) => (item.Operand === operand ? { ...item, Value: value } : item)) }
        : input,
    ),
  };
}

/** Restores the default values of all inputs ("По умолчанию"). */
export function withDefaultInputs(form: StudioForm): StudioForm {
  return {
    ...form,
    Inputs: form.Inputs.map((input) => ({
      ...input,
      Operands: input.Operands.map((item) => ({ ...item, Value: item.DefaultValue ?? item.Value })),
    })),
  };
}

export function replaceForm(project: StudioProject, modelIndex: number, formIndex: number, form: StudioForm): StudioProject {
  return {
    ...project,
    Models: project.Models.map((model, index) =>
      index === modelIndex ? { ...model, UserForms: (model.UserForms ?? []).map((item, i) => (i === formIndex ? form : item)) } : model,
    ),
  };
}

export function flattenControls(control: FormControl | null | undefined): FormControl[] {
  return control ? [control, ...control.Children.flatMap(flattenControls)] : [];
}

export function indicatorsById(form: StudioForm): Map<number, FormIndicator> {
  return new Map(form.Indicators.map((indicator) => [indicator.Id, indicator]));
}

/** Indicator ids shown by a layout: SNA boxes and chart points. */
export function layoutIndicatorIds(layout: FormControl | null | undefined): number[] {
  const ids = flattenControls(layout).flatMap((control) => [
    ...(isSet(control.Indicator) ? [control.Indicator] : []),
    ...control.Series.flatMap((series) => series.Points.map((point) => point.Indicator)),
  ]);
  return [...new Set(ids)];
}

/** Indicators collected over model time when the form runs the model ("Динамика показателей"). */
export function formMonitoring(form: StudioForm): SimulationMonitoring | null {
  if (!form.Run.CollectDynamics) {
    return null;
  }

  const monitors = form.Indicators.filter((indicator) => indicator.Monitored && indicator.Expression)
    .slice(0, MAX_MONITORS)
    .map((indicator) => ({ Expression: indicator.Expression!, Label: indicatorLabel(indicator) }));
  return monitors.length > 0 ? { monitors, interval: form.Run.MonitorInterval > 0 ? form.Run.MonitorInterval : 1 } : null;
}

export function indicatorLabel(indicator: FormIndicator): string {
  return indicator.Title && indicator.Title !== indicator.Object ? `${indicator.Title} (${indicator.Expression})` : (indicator.Expression ?? indicator.Title);
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

/** Experiment plan of the form: factors bound to operands, targets as indicators. */
export function planFromForm(form: StudioForm): Partial<ExperimentPlan> | null {
  const plan = form.Plan;
  if (!plan || (plan.Factors.length === 0 && plan.Targets.length === 0)) {
    return null;
  }

  const factors = plan.Factors.map<FactorDraft>((factor, index) => {
    const planned = [...new Set(plan.Points.map((point) => point[index]).filter((value) => Number.isFinite(value)))];
    const levels =
      isSet(factor.Min) && isSet(factor.Max) && isSet(factor.Step) && factor.Step > 0
        ? `${formatNumber(factor.Min)}..${formatNumber(factor.Max)} шаг ${formatNumber(factor.Step)}`
        : planned.length > 0
          ? planned.map(formatNumber).join('; ')
          : formatNumber(factor.Default ?? 0);
    return { name: factor.Name || `Строка ${factor.Line}`, kind: 'Operand', levels, line: factor.Line, operand: factor.Operand };
  });
  const indicators = plan.Targets.map<IndicatorDraft>((target) => ({ expression: target.Expression, label: target.Name }));
  return { factors, indicators, startCount: Math.max(1, form.Run.StartCount), objective: indicators.length > 0 ? 0 : -1 };
}

/** Colour of an SNA box for a value: the first interval that contains it. */
export function intervalColors(control: FormControl, value: number | null | undefined): { color?: string; background?: string } {
  if (!isSet(value)) {
    return {};
  }

  const interval = control.Intervals.find((item) => value >= item.Low && value <= item.High);
  return interval ? { color: cssColor(interval.TextColor), background: cssColor(interval.BackColor) } : {};
}

const SYSTEM_COLORS: Record<string, string> = {
  buttonface: '#f0f0f0',
  control: '#f0f0f0',
  window: '#ffffff',
  windowtext: '#000000',
  controltext: '#000000',
  transparent: 'transparent',
};

/** Windows Forms colour (name, system colour or #RRGGBB) as CSS. */
export function cssColor(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return SYSTEM_COLORS[trimmed.toLowerCase()] ?? trimmed;
}

/** Font of a control: points are converted to pixels, "Bold, Italic" to CSS. */
export function fontStyle(control: FormControl): { fontFamily?: string; fontSize: string; fontWeight?: number; fontStyle?: string; textDecoration?: string } {
  const style = control.FontStyle ?? '';
  return {
    fontFamily: control.FontName ? `'${control.FontName}', Tahoma, sans-serif` : undefined,
    fontSize: `${Math.round(((control.FontSize || 8.25) * 96) / 72)}px`,
    fontWeight: style.includes('Bold') ? 700 : undefined,
    fontStyle: style.includes('Italic') ? 'italic' : undefined,
    textDecoration: style.includes('Underline') ? 'underline' : undefined,
  };
}

/** CSS object-fit for a picture box size mode. */
export function pictureFit(sizeMode: string | null | undefined): 'contain' | 'fill' | 'none' {
  switch (sizeMode) {
    case 'Zoom':
      return 'contain';
    case 'StretchImage':
      return 'fill';
    default:
      return 'none';
  }
}
