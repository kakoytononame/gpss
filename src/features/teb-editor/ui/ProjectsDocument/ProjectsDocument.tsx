import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import '../BaseDocument/BaseDocument.css';
import './ProjectsDocument.css';

const IMPORT_ACCEPT = '.zip,.gps,.txt';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * "Открыть проект / Управление": projects stored on the server, import of GPSS Studio projects
 * (ZIP archive of the project folder or a .gps model file), creation and the open project's models.
 */
export function ProjectsDocument() {
  const projects = useTebEditorStore((state) => state.projects);
  const projectsLoading = useTebEditorStore((state) => state.projectsLoading);
  const project = useTebEditorStore((state) => state.project);
  const projectModelIndex = useTebEditorStore((state) => state.projectModelIndex);
  const projectDirty = useTebEditorStore((state) => state.projectDirty);
  const projectBusy = useTebEditorStore((state) => state.projectBusy);
  const loadProjects = useTebEditorStore((state) => state.loadProjects);
  const importProject = useTebEditorStore((state) => state.importProject);
  const createProject = useTebEditorStore((state) => state.createProject);
  const openProject = useTebEditorStore((state) => state.openProject);
  const deleteProject = useTebEditorStore((state) => state.deleteProject);
  const saveProject = useTebEditorStore((state) => state.saveProject);
  const closeProject = useTebEditorStore((state) => state.closeProject);
  const selectProjectModel = useTebEditorStore((state) => state.selectProjectModel);
  const generateModelText = useTebEditorStore((state) => state.generateModelText);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (newName.trim()) {
      void createProject(newName.trim());
      setNewName('');
    }
  }

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Удалить проект «${name}» с сервера?`)) {
      void deleteProject(id);
    }
  }

  return (
    <section className="placeholder-document projects-document">
      <div className="placeholder-document__header">
        <h2>Проекты</h2>
        <div className="placeholder-document__actions">
          <IconButton
            label="Импорт проекта GPSS Studio"
            title="Загрузить ZIP-архив папки проекта или файл модели .gps"
            disabled={projectBusy}
            onClick={() => fileInputRef.current?.click()}
          />
          <IconButton label="Обновить" title="Обновить список проектов" onClick={() => void loadProjects()} />
          <input
            ref={fileInputRef}
            className="projects-document__file"
            type="file"
            accept={IMPORT_ACCEPT}
            aria-label="Файл проекта GPSS Studio"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void importProject(file);
              }

              event.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="projects-document__body">
        {project ? (
          <section className="projects-card" aria-label="Текущий проект">
            <header className="projects-card__header">
              <div>
                <h3>{project.Name}</h3>
                {project.Description ? <p>{project.Description}</p> : null}
              </div>
              <div className="placeholder-document__actions">
                <IconButton
                  label="Сохранить проект"
                  title="Сохранить проект на сервере"
                  disabled={projectBusy || !projectDirty}
                  onClick={() => void saveProject()}
                />
                <IconButton
                  label="Сгенерировать текст модели"
                  title="Собрать текст GPSS модели по структурной схеме"
                  disabled={projectBusy || !project.Models[projectModelIndex]?.Scheme}
                  onClick={() => void generateModelText()}
                />
                <IconButton label="Закрыть проект" title="Закрыть проект" onClick={closeProject} />
              </div>
            </header>
            <table className="projects-table">
              <thead>
                <tr>
                  <th>Модель</th>
                  <th>Схема</th>
                  <th>Текст модели</th>
                  <th>Формы</th>
                </tr>
              </thead>
              <tbody>
                {project.Models.map((model, index) => (
                  <tr
                    key={`${model.Name}-${index}`}
                    className={index === projectModelIndex ? 'is-selected' : undefined}
                    onClick={() => selectProjectModel(index)}
                  >
                    <td>{model.Name}</td>
                    <td>{model.Scheme ? `ТЭБов: ${model.Scheme.Nodes.length}, связей: ${model.Scheme.Links.length}` : '—'}</td>
                    <td>{model.ModelText ? `${model.ModelText.split('\n').length} строк` : '—'}</td>
                    <td>{model.Forms.length > 0 ? model.Forms.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {project.Libraries.length > 0 ? (
              <p className="projects-card__note">
                Библиотеки ТЭБов: {project.Libraries.map((library) => `${library.Name} (${library.Classes.length})`).join(', ')}
              </p>
            ) : null}
            {project.ImportNotes.length > 0 ? (
              <ul className="projects-card__notes" aria-label="Замечания импорта">
                {project.ImportNotes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section className="projects-card" aria-label="Проекты на сервере">
          <header className="projects-card__header">
            <h3>Проекты на сервере</h3>
            <form className="projects-create" onSubmit={handleCreate}>
              <input value={newName} placeholder="Имя нового проекта" aria-label="Имя нового проекта" onChange={(event) => setNewName(event.target.value)} />
              <button type="submit" disabled={!newName.trim() || projectBusy}>
                Создать проект
              </button>
            </form>
          </header>
          {projects.length === 0 ? (
            <p className="projects-card__empty">
              {projectsLoading
                ? 'Загрузка...'
                : 'Проектов пока нет. Импортируйте проект GPSS Studio (ZIP-архив папки проекта с Project.gsproj) или создайте новый.'}
            </p>
          ) : (
            <table className="projects-table">
              <thead>
                <tr>
                  <th>Проект</th>
                  <th>Описание</th>
                  <th>Моделей</th>
                  <th>Изменён</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {projects.map((item) => (
                  <tr key={item.Id} className={item.Id === project?.Id ? 'is-selected' : undefined} onDoubleClick={() => void openProject(item.Id)}>
                    <td>{item.Name}</td>
                    <td className="projects-table__description">{item.Description ?? ''}</td>
                    <td>{item.ModelCount}</td>
                    <td>{formatDate(item.UpdatedAt)}</td>
                    <td className="projects-table__actions">
                      <button type="button" onClick={() => void openProject(item.Id)}>
                        Открыть
                      </button>
                      <button type="button" className="is-danger" onClick={() => handleDelete(item.Id, item.Name)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </section>
  );
}
