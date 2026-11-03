import type { Distribution, DistributionKind } from '../../../../shared/types/queueing';
import { DISTRIBUTION_LABELS, defaultDistribution, distributionMean } from '../../model/queueing';

type Field = 'Mean' | 'Cv' | 'Shape' | 'Min' | 'Max' | 'Mode';

const FIELDS: Record<DistributionKind, { field: Field; label: string; step?: number }[]> = {
  Exponential: [{ field: 'Mean', label: 'среднее' }],
  Deterministic: [{ field: 'Mean', label: 'значение' }],
  Erlang: [
    { field: 'Mean', label: 'среднее' },
    { field: 'Shape', label: 'фаз k', step: 1 },
  ],
  HyperExponential: [
    { field: 'Mean', label: 'среднее' },
    { field: 'Cv', label: 'коэф. вариации ≥ 1', step: 0.1 },
  ],
  Uniform: [
    { field: 'Min', label: 'от' },
    { field: 'Max', label: 'до' },
  ],
  Normal: [
    { field: 'Mean', label: 'среднее' },
    { field: 'Cv', label: 'коэф. вариации', step: 0.05 },
  ],
  LogNormal: [
    { field: 'Mean', label: 'среднее' },
    { field: 'Cv', label: 'коэф. вариации', step: 0.1 },
  ],
  Triangular: [
    { field: 'Min', label: 'мин.' },
    { field: 'Mode', label: 'мода' },
    { field: 'Max', label: 'макс.' },
  ],
  Gamma: [
    { field: 'Mean', label: 'среднее' },
    { field: 'Cv', label: 'коэф. вариации', step: 0.1 },
  ],
  Weibull: [
    { field: 'Mean', label: 'среднее' },
    { field: 'Shape', label: 'форма k', step: 0.1 },
  ],
};

interface DistributionEditorProps {
  label: string;
  value: Distribution;
  onChange: (value: Distribution) => void;
}

/** Kind of an interval distribution and its parameters (mean, coefficient of variation, phases, bounds). */
export function DistributionEditor({ label, value, onChange }: DistributionEditorProps) {
  return (
    <div className="queueing-distribution" role="group" aria-label={label}>
      <span className="queueing-distribution__label">{label}</span>
      <select
        aria-label={`${label}: закон распределения`}
        value={value.Kind}
        onChange={(event) => onChange(defaultDistribution(event.target.value as DistributionKind, distributionMean(value) || 10))}
      >
        {Object.entries(DISTRIBUTION_LABELS).map(([kind, text]) => (
          <option key={kind} value={kind}>
            {text}
          </option>
        ))}
      </select>
      {FIELDS[value.Kind].map(({ field, label: fieldLabel, step }) => (
        <label key={field} className="queueing-distribution__field">
          {fieldLabel}
          <input
            type="number"
            min={0}
            step={step ?? 'any'}
            aria-label={`${label}: ${fieldLabel}`}
            value={value[field] ?? ''}
            onChange={(event) => onChange({ ...value, [field]: event.target.value === '' ? undefined : Number(event.target.value) })}
          />
        </label>
      ))}
    </div>
  );
}

interface OptionalDistributionProps {
  label: string;
  value: Distribution | null | undefined;
  defaultMean: number;
  onChange: (value: Distribution | null) => void;
}

/** A distribution that can be switched off (patience, vacations, failures). */
export function OptionalDistribution({ label, value, defaultMean, onChange }: OptionalDistributionProps) {
  return (
    <div className="queueing-optional">
      <label className="queueing-check">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked ? defaultDistribution('Exponential', defaultMean) : null)} />
        {label}
      </label>
      {value ? <DistributionEditor label={label} value={value} onChange={onChange} /> : null}
    </div>
  );
}
