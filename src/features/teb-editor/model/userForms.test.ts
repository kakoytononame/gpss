import { studioForm } from '../../../test/fixtures';
import {
  cssColor,
  fontStyle,
  formMonitoring,
  inputValue,
  intervalColors,
  layoutIndicatorIds,
  pictureFit,
  planFromForm,
  withDefaultInputs,
  withInputValue,
} from './userForms';

describe('user forms', () => {
  it('reads and changes operand values of inputs', () => {
    const form = studioForm();

    expect(inputValue(form, 1, 'B')).toBe('30');
    const changed = withInputValue(form, 1, 'B', '40');
    expect(inputValue(changed, 1, 'B')).toBe('40');
    expect(inputValue(form, 1, 'B')).toBe('30');
    expect(inputValue(withDefaultInputs(changed), 1, 'B')).toBe('26');
  });

  it('lists indicators of a layout and monitored indicators', () => {
    const form = studioForm();

    expect(layoutIndicatorIds(form.DynamicForm)).toEqual([10, 15]);
    expect(formMonitoring(form)).toEqual({ monitors: [{ Expression: 'S$Berth', Label: 'Причал (S$Berth)' }], interval: 60 });
    expect(formMonitoring({ ...form, Run: { ...form.Run, CollectDynamics: false } })).toBeNull();
  });

  it('turns the form plan into an experiment plan', () => {
    expect(planFromForm(studioForm())).toEqual({
      factors: [{ name: 'Интервал', kind: 'Operand', levels: '20..24 шаг 2', line: 2, operand: 'B' }],
      indicators: [{ expression: 'SR$Berth', label: 'Загрузка причала' }],
      startCount: 50,
      objective: 0,
    });

    const form = studioForm();
    const withoutRange = { ...form, Plan: { ...form.Plan!, Factors: [{ ...form.Plan!.Factors[0], Min: null }] } };
    expect(planFromForm(withoutRange)?.factors?.[0].levels).toBe('20; 22; 24');
    expect(planFromForm({ ...form, Plan: null })).toBeNull();
  });

  it('maps Windows Forms colours, fonts and picture modes', () => {
    const box = studioForm().DynamicForm!.Children[0];

    expect(intervalColors(box, 1)).toEqual({ color: undefined, background: '#7CFC00' });
    expect(intervalColors(box, 5).background).toBe('Red');
    expect(intervalColors(box, null)).toEqual({});
    expect(cssColor('buttonface')).toBe('#f0f0f0');
    expect(fontStyle({ ...box, FontSize: 12, FontStyle: 'Bold, Italic', FontName: 'Tahoma' })).toMatchObject({
      fontSize: '16px',
      fontWeight: 700,
      fontStyle: 'italic',
    });
    expect(pictureFit('Zoom')).toBe('contain');
    expect(pictureFit('Normal')).toBe('none');
  });
});
