import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FormControl } from '../../../../shared/types/project';
import { cssColor, fontStyle, intervalColors, isSet, pictureFit } from '../../model/userForms';

const CHART_COLORS = ['#2e7d32', '#1565c0', '#ef6c00', '#6a1b9a', '#c62828', '#00838f', '#9e9d24', '#4e342e'];

export interface FormCanvasProps {
  root: FormControl;
  images: Record<string, string>;
  /** Value written into the model by an input control. */
  inputValue?: (control: FormControl) => string;
  onInput?: (control: FormControl, value: string) => void;
  /** Current value of an indicator (dynamic forms). */
  indicatorValue?: (indicatorId: number) => number | null | undefined;
  /** Model time shown by clock controls. */
  clock?: number | null;
}

function formatValue(value: number | null | undefined): string {
  return isSet(value) ? String(Number(value.toFixed(4))) : '—';
}

function boxStyle(control: FormControl, positioned: boolean): CSSProperties {
  return {
    ...(positioned ? { position: 'absolute', left: control.X, top: control.Y } : {}),
    width: control.Width || undefined,
    height: control.Height || undefined,
    color: cssColor(control.ForeColor),
    background: cssColor(control.BackColor),
    ...fontStyle(control),
  };
}

/** Tab control: page headers and the selected page. */
function FormTabs({ control, renderChildren }: { control: FormControl; renderChildren: (parent: FormControl) => ReactNode }) {
  const [selected, setSelected] = useState(0);
  const page = control.Children[Math.min(selected, control.Children.length - 1)];
  return (
    <div className="form-canvas__tabs" style={boxStyle(control, true)}>
      <div className="form-canvas__tab-headers" role="tablist">
        {control.Children.map((tab, index) => (
          <button
            key={tab.Name || index}
            type="button"
            role="tab"
            aria-selected={tab === page}
            className={tab === page ? 'is-active' : undefined}
            onClick={() => setSelected(index)}
          >
            {tab.Text || tab.Name}
          </button>
        ))}
      </div>
      {page ? (
        <div className="form-canvas__tab-page" role="tabpanel" style={{ background: cssColor(page.BackColor) }}>
          {renderChildren(page)}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Renders a GPSS Studio form layout (Windows Forms controls with absolute coordinates): labels, group
 * boxes, tab controls, input / combo / check boxes bound to model operands, SNA boxes coloured by value
 * intervals, pictures and charts of indicators.
 */
export function FormCanvas({ root, images, inputValue, onInput, indicatorValue, clock }: FormCanvasProps) {
  // Windows Forms paints the first control of a collection on top: render in reverse order.
  const renderChildren = (parent: FormControl): ReactNode =>
    [...parent.Children].reverse().map((child, index) => <Fragment key={`${child.Name}-${index}`}>{renderItem(child)}</Fragment>);

  // A render function (not a nested component) keeps inputs mounted while the user types.
  function renderItem(control: FormControl): ReactNode {
    const style = boxStyle(control, true);
    switch (control.Type) {
      case 'label':
        return (
          <div className="form-canvas__label" style={style}>
            {control.Text}
          </div>
        );
      case 'group':
        return (
          <fieldset className="form-canvas__group" style={style}>
            {control.Text ? <legend>{control.Text}</legend> : null}
            {renderChildren(control)}
          </fieldset>
        );
      case 'panel':
      case 'tab':
        return (
          <div className="form-canvas__panel" style={style}>
            {renderChildren(control)}
          </div>
        );
      case 'tabs':
        return <FormTabs control={control} renderChildren={renderChildren} />;
      case 'input':
        return (
          <input
            className="form-canvas__input"
            style={style}
            aria-label={control.Name}
            value={inputValue?.(control) ?? control.Value ?? ''}
            readOnly={!onInput}
            onChange={(event) => onInput?.(control, event.target.value)}
          />
        );
      case 'combo':
        return (
          <select
            className="form-canvas__input"
            style={style}
            aria-label={control.Name}
            value={inputValue?.(control) ?? control.Value ?? ''}
            disabled={!onInput}
            onChange={(event) => onInput?.(control, event.target.value)}
          >
            {control.Choices.map((choice) => (
              <option key={`${choice.Label}-${choice.Value}`} value={choice.Value}>
                {choice.Label}
              </option>
            ))}
          </select>
        );
      case 'check': {
        const checked = control.Choices[1]?.Value ?? '1';
        const unchecked = control.Choices[0]?.Value ?? '0';
        return (
          <input
            type="checkbox"
            className="form-canvas__check"
            style={{ position: 'absolute', left: control.X, top: control.Y }}
            aria-label={control.Name}
            checked={(inputValue?.(control) ?? control.Value) === checked}
            disabled={!onInput}
            onChange={(event) => onInput?.(control, event.target.checked ? checked : unchecked)}
          />
        );
      }
      case 'sna': {
        const value = isSet(control.Indicator) ? indicatorValue?.(control.Indicator) : null;
        const colors = intervalColors(control, value);
        return (
          <output className="form-canvas__sna" style={{ ...style, ...colors }} aria-label={control.Name}>
            {formatValue(value)}
          </output>
        );
      }
      case 'picture': {
        const source = control.Image ? images[control.Image] : undefined;
        return source ? (
          <img
            className="form-canvas__picture"
            style={{ ...style, objectFit: pictureFit(control.SizeMode), objectPosition: control.SizeMode === 'CenterImage' ? 'center' : 'left top' }}
            src={source}
            alt=""
          />
        ) : (
          <div className="form-canvas__picture form-canvas__picture--missing" style={style} />
        );
      }
      case 'chart':
        return (
          <div className="form-canvas__chart" style={style}>
            <FormChart control={control} indicatorValue={indicatorValue} />
          </div>
        );
      case 'clock':
        return (
          <div className="form-canvas__clock" style={style} title="Модельное время">
            <span>Модельное время</span>
            <strong>{formatValue(clock)}</strong>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="form-canvas" style={{ width: root.Width + root.X, height: root.Height + root.Y }}>
      <div className="form-canvas__panel form-canvas__root" style={boxStyle(root, true)}>
        {renderChildren(root)}
      </div>
    </div>
  );
}

function FormChart({ control, indicatorValue }: { control: FormControl; indicatorValue?: FormCanvasProps['indicatorValue'] }) {
  const series = control.Series[0];
  if (!series) {
    return null;
  }

  // One row per argument with a value column per series.
  const data = series.Points.map((point, index) => ({
    argument: point.Argument,
    ...Object.fromEntries(control.Series.map((item, seriesIndex) => [`s${seriesIndex}`, indicatorValue?.(item.Points[index]?.Indicator ?? -1) ?? 0])),
  }));
  const view = series.ViewType.toLowerCase();

  return (
    <ResponsiveContainer width="100%" height="100%">
      {view.includes('pie') || view.includes('doughnut') ? (
        <PieChart>
          <Pie data={data} dataKey="s0" nameKey="argument" isAnimationActive={false} label>
            {data.map((item, index) => (
              <Cell key={item.argument} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      ) : view.includes('line') || view.includes('spline') ? (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="argument" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          {control.Series.map((item, index) => (
            <Line key={item.Name} dataKey={`s${index}`} name={item.Name} stroke={CHART_COLORS[index % CHART_COLORS.length]} isAnimationActive={false} />
          ))}
        </LineChart>
      ) : (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="argument" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          {control.Series.map((item, index) => (
            <Bar key={item.Name} dataKey={`s${index}`} name={item.Name} fill={CHART_COLORS[index % CHART_COLORS.length]} isAnimationActive={false} />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
