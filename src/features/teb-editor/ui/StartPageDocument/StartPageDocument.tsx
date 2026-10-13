import { useEffect } from 'react';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import openProjectIcon from '../../../../shared/assets/icons/open-project.png';
import exampleAgro from '../../../../shared/assets/start-page/example-agro.png';
import exampleCanteen from '../../../../shared/assets/start-page/example-canteen.png';
import exampleGas from '../../../../shared/assets/start-page/example-gas.png';
import examplePort from '../../../../shared/assets/start-page/example-port.png';
import './StartPageDocument.css';

interface RecentProject {
  id: string;
  title: string;
  lastLaunch: string;
  location: string;
  isSelected?: boolean;
}

interface ExampleProject {
  id: string;
  title: string;
  description: string;
  image: string;
  badge?: string;
  isSelected?: boolean;
}

const BUNDLED_PROJECT_ID = 'canteen';
const RECENT_PROJECTS_LIMIT = 6;

function formatLaunch(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '');
}

const recentProjects: RecentProject[] = [
  {
    id: 'gas',
    title: 'Автозаправочная станция',
    lastLaunch: '24.04.2026 12:56',
    location: 'SampleProjects\\Автозаправочная станция',
  },
  {
    id: 'canteen',
    title: 'Столовая',
    lastLaunch: '23.04.2026 17:26',
    location: 'SampleProjects\\Столовая',
    isSelected: true,
  },
];

const exampleProjects: ExampleProject[] = [
  {
    id: 'gas',
    title: 'Автозаправочная станция',
    description: 'АЗС состоит из двух заправочных колонок. Интервалы времени со средним значением зависят от времени суток.',
    image: exampleGas,
  },
  {
    id: 'agro',
    title: 'Агропромпарк',
    description: 'Необходимо определить, при каких значениях входных параметров достигается максимальная загруженность накопителя.',
    image: exampleAgro,
    badge: '+оптимизация',
  },
  {
    id: 'port',
    title: 'Модель порта',
    description: 'Необходимо определить поток кораблей, при котором достижение обслуживания кораблей портом приемлемо.',
    image: examplePort,
  },
  {
    id: 'canteen',
    title: 'Столовая',
    description: 'Рассматривается работа столовой. Продукты питания оплачиваются, после чего посетитель занимает место на время приёма пищи.',
    image: exampleCanteen,
    isSelected: true,
  },
];

export function StartPageDocument() {
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const serverProjects = useTebEditorStore((state) => state.projects);
  const currentProjectId = useTebEditorStore((state) => state.project?.Id);
  const loadProjects = useTebEditorStore((state) => state.loadProjects);
  const openServerProject = useTebEditorStore((state) => state.openProject);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  // Projects stored on the server replace the demo list once there are any.
  const recent: RecentProject[] =
    serverProjects.length > 0
      ? serverProjects.slice(0, RECENT_PROJECTS_LIMIT).map((project) => ({
          id: project.Id,
          title: project.Name,
          lastLaunch: formatLaunch(project.UpdatedAt),
          location: `Сервер, моделей: ${project.ModelCount}`,
          isSelected: project.Id === currentProjectId,
        }))
      : recentProjects;

  /** The "Столовая" demo is bundled; the other GPSS Studio samples are imported on the projects page. */
  function openProject(projectId: string, message: string) {
    if (serverProjects.some((project) => project.Id === projectId)) {
      void openServerProject(projectId);
      return;
    }

    if (projectId === BUNDLED_PROJECT_ID) {
      activateDocument('scheme');
      setStatusMessage(message, 'saved');
      return;
    }

    activateDocument('projects');
    setStatusMessage(`${message} Импортируйте проект из GPSS Studio (ZIP-архив папки проекта).`, 'saved');
  }

  return (
    <section className="start-page">
      <div className="start-page__recent">
        <h2 className="start-page__title">Последние открытые проекты:</h2>

        <div className="recent-projects">
          {recent.map((project) => (
            <button
              className={`recent-project ${project.isSelected ? 'is-selected' : ''}`}
              key={project.id}
              type="button"
              onClick={() =>
                openProject(
                  project.id,
                  project.id === BUNDLED_PROJECT_ID ? `Открыт проект: ${project.title}.` : `Подготовлено открытие проекта: ${project.title}.`,
                )
              }
            >
              <img className="recent-project__icon" src={openProjectIcon} alt="" aria-hidden="true" />

              <div className="recent-project__content">
                <div className="recent-project__title">{project.title}</div>

                <div className="recent-project__meta">
                  <span className="recent-project__meta-label">Прошлый запуск:</span>
                  <span className="recent-project__meta-value">{project.lastLaunch}</span>
                </div>

                <div className="recent-project__meta">
                  <span className="recent-project__meta-label">Расположение:</span>
                  <span className="recent-project__meta-value">{project.location}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <aside className="start-page__examples">
        <h2 className="start-page__title">Примеры проектов:</h2>

        <div className="start-page__example-list">
          {exampleProjects.map((project) => (
            <button
              className={`start-example ${project.isSelected ? 'is-selected' : ''}`}
              key={project.id}
              type="button"
              onClick={() => openProject(project.id, `Выбран пример проекта: ${project.title}.`)}
            >
              <img className="start-example__image" src={project.image} alt="" aria-hidden="true" />
              <div className="start-example__content">
                <div className="start-example__heading">
                  <span className="start-example__title">{project.title}</span>
                  {project.badge ? <span className="start-example__badge">{project.badge}</span> : null}
                </div>
                <p className="start-example__description">{project.description}</p>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}
