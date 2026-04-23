import { useTebEditorStore } from '../store/useTebEditorStore';
import exampleAgro from '../../../shared/assets/start-page/example-agro.png';
import exampleCanteen from '../../../shared/assets/start-page/example-canteen.png';
import exampleGas from '../../../shared/assets/start-page/example-gas.png';
import examplePort from '../../../shared/assets/start-page/example-port.png';

interface ExampleProject {
  id: string;
  title: string;
  description: string;
  image: string;
  badge?: string;
  isSelected?: boolean;
}

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
    description: 'Рассматривается работа столовой. Продукты питания оплачиваются, после чего посетитель занимает место на время приема пищи.',
    image: exampleCanteen,
    isSelected: true,
  },
];

export function StartPageDocument() {
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);

  return (
    <section className="start-page">
      <div className="start-page__recent">
        <h2 className="start-page__title">Последние открытые проекты:</h2>
        <button className="start-page__recent-item" type="button" onClick={() => activateDocument('scheme')}>
          Столовая
        </button>
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
