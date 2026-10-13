import type { StudioForm } from '../../../../shared/types/project';

interface FormSelectorProps {
  forms: StudioForm[];
  selected: number;
  onSelect: (index: number) => void;
}

/** Choice of the model form when the model has several. */
export function FormSelector({ forms, selected, onSelect }: FormSelectorProps) {
  if (forms.length < 2) {
    return null;
  }

  return (
    <label className="form-document__selector">
      Форма
      <select value={selected} onChange={(event) => onSelect(Number(event.target.value))}>
        {forms.map((form, index) => (
          <option key={`${form.Name}-${index}`} value={index}>
            {form.Name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NoFormPlaceholder({ title }: { title: string }) {
  return (
    <section className="placeholder-document form-document">
      <div className="placeholder-document__header">
        <h2>{title}</h2>
      </div>
      <p className="form-document__empty">
        У текущей модели нет форм. Импортируйте проект GPSS Studio с формами (папка Forms модели) через «Проекты» → «Импорт».
      </p>
    </section>
  );
}
