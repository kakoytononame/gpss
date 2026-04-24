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

  function openRecentProject(projectId: string, projectTitle: string) {
    if (projectId === 'canteen') {
      activateDocument('scheme');
      setStatusMessage(`Открыт проект: ${projectTitle}.`, 'saved');
      return;
    }

    setStatusMessage(`Подготовлено открытие проекта: ${projectTitle}.`, 'saved');
  }

  return (
    <section className="start-page">
      <div className="start-page__recent">
        <h2 className="start-page__title">Последние открытые проекты:</h2>

        <div className="recent-projects">
          {recentProjects.map((project) => (
            <button
              className={`recent-project ${project.isSelected ? 'is-selected' : ''}`}
              key={project.id}
              type="button"
              onClick={() => openRecentProject(project.id, project.title)}
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
              onClick={() => {
                if (project.id === 'canteen') {
                  activateDocument('scheme');
                  return;
                }

                setStatusMessage(`Выбран пример проекта: ${project.title}.`, 'saved');
              }}
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
