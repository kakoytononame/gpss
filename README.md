# GPSS Studio Web

Веб-версия GPSS Studio состоит из React + TypeScript frontend, ASP.NET Core + EF Core backend и PostgreSQL. Для переноса и запуска все компоненты упакованы в Docker Compose.

## Запуск одной кнопкой на Windows

На новом ноутбуке один раз установите [Docker Desktop](https://www.docker.com/products/docker-desktop/) с поддержкой WSL 2. Node.js, .NET SDK и PostgreSQL отдельно устанавливать не нужно.

1. Скопируйте и распакуйте папку проекта.
2. Запустите `START_GPSS_STUDIO.cmd` двойным щелчком.
3. Дождитесь сборки. При первом запуске Docker загрузит базовые образы, поэтому потребуется интернет и несколько минут.
4. После проверки сервисов браузер автоматически откроет `http://127.0.0.1:8080`.

Лаунчер выполняет следующие действия:

- проверяет наличие Docker и Docker Compose;
- при необходимости запускает Docker Desktop и ожидает его готовности;
- собирает и запускает frontend, backend и PostgreSQL;
- проверяет API, соединение с базой данных и веб-интерфейс;
- открывает приложение в браузере только после успешного запуска.

Для остановки используйте `STOP_GPSS_STUDIO.cmd`. Контейнеры будут остановлены, но данные PostgreSQL сохранятся в Docker volume.

## Подготовка архива для переноса

Запустите `CREATE_TRANSFER_PACKAGE.cmd`. В папке `artifacts` появится архив `GPSS-Studio-portable-ДАТА-ВРЕМЯ.zip` без локальных зависимостей, Git-истории, логов и результатов сборки.

Архив содержит исходный код, Docker-конфигурацию и кнопки запуска. Его можно перенести на другой Windows-компьютер, распаковать и запустить через `START_GPSS_STUDIO.cmd`.

## Адреса сервисов

- веб-интерфейс: `http://127.0.0.1:8080`;
- backend API: `http://127.0.0.1:3001/api/health`;
- PostgreSQL: `127.0.0.1:55432`;
- база данных: `gpss`;
- пользователь: `gpss`;
- пароль: `gpss`.

Порты `8080`, `3001` и `55432` должны быть свободны. Если запуск завершился ошибкой, окно не закроется и покажет последние сообщения контейнеров.

При необходимости внешний порт PostgreSQL можно изменить перед запуском, задав переменную окружения `GPSS_DB_PORT`. Внутри Docker backend всегда подключается к базе на стандартном порту `5432`.

## Ручной запуск

```powershell
docker compose --project-name gpss up --detach --build
```

Остановка:

```powershell
docker compose --project-name gpss down
```

Просмотр логов:

```powershell
docker compose --project-name gpss logs --follow
```

## Моделирование GPSS

Сервер содержит собственный интерпретатор GPSS World (`backend/GpssStudio.Simulation`): транслятор модели, цепи текущих и будущих событий, генераторы случайных чисел (потоки RN1…RNn, воспроизводимые), стандартный отчёт и данные для графиков.

Как пользоваться:

1. Откройте документ «Текст модели». При первом запуске в него загружается пример «Столовая» (5 касс, 5 раздач, зал на 300 мест, 20 столиков, сутки работы).
2. «Проверить» — трансляция без запуска; ошибки с номерами строк попадают в панель «Замечания и ошибки».
3. «Запустить моделирование» (панель быстрого доступа, лента, схема или документ «Текст модели») — модель транслируется и выполняются её управляющие операторы (`START` и др.; если `START` нет, выполняется `START 1`). После завершения открывается «Стандартный отчёт».
4. «Графики результатов» (дерево проекта или кнопка «Показать графики таблиц» на вкладке отчёта): загрузка устройств, длины и времена очередей, динамика очередей и памяти во времени, гистограммы таблиц, входы в блоки.
5. «Журнал моделирования» — журнал и командная строка GPSS: `START n`, `STEP n` (пошаговое выполнение с трассировкой), `HALT`, `CONTINUE`, `RESET`, `CLEAR`, `SHOW выражение`, `INITIAL`, `RMULT`. Те же команды доступны на вкладке ленты «Моделирование».

Поддерживаемые блоки: `GENERATE, TERMINATE, ADVANCE, SEIZE, RELEASE, PREEMPT, RETURN, FAVAIL, FUNAVAIL, QUEUE, DEPART, ENTER, LEAVE, SAVAIL, SUNAVAIL, TRANSFER` (безусловный, вероятностный, `BOTH`, `ALL`, `PICK`, `SBR`, `P`), `TEST, GATE, LOGIC, SAVEVALUE, ASSIGN, MARK, PRIORITY, SPLIT, ASSEMBLE, GATHER, LOOP, BUFFER, TABULATE, LINK, UNLINK, ADOPT, INDEX`.

Операторы: `STORAGE, TABLE, QTABLE, VARIABLE, FVARIABLE, BVARIABLE, FUNCTION` (D, C, L, E), `EQU, INITIAL, START, RESET, CLEAR, SHOW, RMULT`. Выражения поддерживают арифметику, сравнения, СЧА (`Q$, QA$, QM$, QT$, F$, FC$, FR$, S$, R$, SR$, X$, P$/Pn, FN$, V$, N$, W$, LS$, TB$, RNn, AC1, C1, M1, XN1, PR, TG1` и др.) и процедуры `Exponential, Uniform, Normal, Triangular, Poisson, Duniform, Lognormal`, а также математические функции.

Блоки `COUNT, SELECT, MSAVEVALUE, MATCH`, файловые операции и матрицы транслятор распознаёт и сообщает, что они не поддерживаются. Бесконечные циклы и накопление транзактов останавливаются защитными пределами с сообщением в журнале.

## API

Swagger UI: `http://127.0.0.1:3001/swagger`.

- `GET/PATCH/PUT/POST/DELETE /api/alina-gpss/studio/tebs/...` — классы и экземпляры ТЭБов, параметры, коллекции, текст GPSS-модели;
- `GET/PUT/DELETE /api/alina-gpss/studio/tebs/workspace` — снимок рабочей области;
- `POST /api/alina-gpss/studio/simulation/translate` — трансляция модели;
- `POST /api/alina-gpss/studio/simulation/sessions` — создать сеанс моделирования (трансляция + управляющие операторы модели);
- `POST /api/alina-gpss/studio/simulation/sessions/{id}/commands` — команда GPSS в сеансе;
- `GET /api/alina-gpss/studio/simulation/examples/{id}` — примеры моделей;
- `GET /api/health` — состояние API и соединения с PostgreSQL.

Ошибки возвращаются в формате RFC 7807 (`application/problem+json`): 400 для неверных данных, 404 для отсутствующих объектов.

## Тестирование

Всё запускается в Docker, локально ничего кроме Docker не требуется:

```powershell
docker compose --project-name gpss up --detach --build
docker compose --project-name gpss --profile test run --rm api-tests   # 36 тестов симулятора + 50 интеграционных тестов API на PostgreSQL
docker compose --project-name gpss --profile test run --rm e2e         # 8 сквозных тестов в браузере (Playwright)
```

Для разработки фронтенда (нужен Node.js 20+):

```powershell
npm ci
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # 62 модульных и компонентных теста (Vitest + Testing Library)
npm run test:e2e    # Playwright против запущенного стека
```

## Структура проекта

- `src/app` — сборка приложения и композиция основной оболочки;
- `src/features/teb-editor` — модель данных, хранилище состояния (срезы Zustand) и документы редактора: ТЭБ, схема, текст модели, отчёт, журнал, графики;
- `src/widgets` — крупные панели интерфейса GPSS Studio (лента, дерево проекта, свойства, замечания);
- `src/shared` — общие типы, API-клиенты, компоненты и графические ресурсы;
- `backend/GpssStudio.Simulation` — интерпретатор GPSS: транслятор, блоки, движок, стандартный отчёт, примеры моделей;
- `backend/GpssStudio.WebApi` — ASP.NET Core Web API, сервисы, EF Core, схема БД (создаётся при старте API);
- `backend/*.Tests` — тесты симулятора и интеграционные тесты API;
- `e2e` — сквозные тесты Playwright;
- `docker` — конфигурация nginx;
- `scripts/windows` — переносимый запуск и упаковка проекта;
- `docker-compose.yml` — frontend, backend, PostgreSQL и тестовые сервисы (профиль `test`).

## Хранение данных

PostgreSQL использует именованный Docker volume `gpss_postgres_data`. Обычная остановка или обновление контейнеров данные не удаляет. Не запускайте `docker compose down --volumes`, если требуется сохранить проекты и результаты моделирования.
