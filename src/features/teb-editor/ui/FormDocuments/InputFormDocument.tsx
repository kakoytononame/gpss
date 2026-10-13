import { useMemo } from 'react';
import type { FormControl } from '../../../../shared/types/project';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { inputValue, isSet, modelForms, planFromForm } from '../../model/userForms';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { FormCanvas } from './FormCanvas';
import { FormSelector, NoFormPlaceholder } from './FormHeader';
import '../BaseDocument/BaseDocument.css';
import './FormDocuments.css';

/**
 * "Форма ввода исходных данных" of a GPSS Studio model: the designed form and the table of all input
 * data. Values are written into the operands of the form's model text before the run.
 */
export function InputFormDocument() {
  const project = useTebEditorStore((state) => state.project);
  const modelIndex = useTebEditorStore((state) => state.projectModelIndex);
  const formIndex = useTebEditorStore((state) => state.projectFormIndex);
  const busy = useTebEditorStore((state) => state.formBusy || state.simulationBusy);
  const projectDirty = useTebEditorStore((state) => state.projectDirty);
  const openForm = useTebEditorStore((state) => state.openForm);
  const setFormInputValue = useTebEditorStore((state) => state.setFormInputValue);
  const resetFormInputs = useTebEditorStore((state) => state.resetFormInputs);
  const applyFormToModel = useTebEditorStore((state) => state.applyFormToModel);
  const runForm = useTebEditorStore((state) => state.runForm);
  const planExperimentFromForm = useTebEditorStore((state) => state.planExperimentFromForm);
  const saveProject = useTebEditorStore((state) => state.saveProject);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);

  const forms = modelForms(project, modelIndex);
  const form = forms[formIndex];
  const editableInputs = useMemo(() => form?.Inputs.filter((input) => input.Operands.length > 0) ?? [], [form]);

  if (!form) {
    return <NoFormPlaceholder title="Форма ввода данных" />;
  }

  const valueOf = (control: FormControl) =>
    isSet(control.Input) && control.Operand ? (inputValue(form, control.Input, control.Operand) ?? control.Value ?? '') : (control.Value ?? '');
  const changeControl = (control: FormControl, value: string) => {
    if (isSet(control.Input) && control.Operand) {
      setFormInputValue(control.Input, control.Operand, value);
    }
  };

  return (
    <section className="placeholder-document form-document" aria-label="Форма ввода данных">
      <div className="placeholder-document__header">
        <h2>Форма ввода данных — {form.Name}</h2>
        <div className="placeholder-document__actions">
          <FormSelector forms={forms} selected={formIndex} onSelect={(index) => openForm(index, 'input-form')} />
          <IconButton
            label="Сформировать модель"
            title="Записать исходные данные в текст модели"
            disabled={busy}
            onClick={() => void applyFormToModel().then((applied) => applied && activateDocument('model-text'))}
          />
          <IconButton label="Моделировать" title="Сформировать модель и выполнить моделирование" disabled={busy} onClick={() => void runForm()} />
          <IconButton
            label="План эксперимента"
            title="Заполнить эксперимент факторами и показателями формы"
            disabled={busy || !planFromForm(form)}
            onClick={() => void planExperimentFromForm()}
          />
          <IconButton
            label="Динамическая форма"
            title="Открыть динамическую форму"
            disabled={!form.DynamicForm}
            onClick={() => openForm(formIndex, 'dynamic-form')}
          />
          <IconButton label="По умолчанию" title="Восстановить значения по умолчанию" onClick={resetFormInputs} />
          <IconButton
            label="Сохранить проект"
            title="Сохранить исходные данные формы в проекте"
            disabled={!projectDirty || busy}
            onClick={() => void saveProject()}
          />
        </div>
      </div>

      <div className="form-document__body">
        {form.EntryForm ? (
          <div className="form-document__canvas" aria-label="Макет формы">
            <FormCanvas root={form.EntryForm} images={form.Images} inputValue={valueOf} onInput={changeControl} />
          </div>
        ) : null}

        <details className="form-document__inputs" open={!form.EntryForm}>
          <summary>Исходные данные ({editableInputs.length})</summary>
          <table className="experiment-table">
            <thead>
              <tr>
                <th>Объект</th>
                <th>Строка</th>
                <th>Операнд</th>
                <th>Значение</th>
                <th>По умолчанию</th>
              </tr>
            </thead>
            <tbody>
              {editableInputs.flatMap((input) =>
                input.Operands.map((operand) => (
                  <tr key={`${input.Number}-${operand.Operand}`}>
                    <td>{input.Name}</td>
                    <td>{input.Line}</td>
                    <td title={`Операнд ${operand.Operand}`}>{operand.Name}</td>
                    <td>
                      <input
                        aria-label={`${input.Name}: ${operand.Name}`}
                        value={operand.Value}
                        onChange={(event) => setFormInputValue(input.Number, operand.Operand, event.target.value)}
                      />
                    </td>
                    <td>{operand.DefaultValue}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}
