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

## Структура проекта

- `src/app` — сборка приложения и композиция основной оболочки;
- `src/features/teb-editor` — состояние, модель данных и интерфейс редактора ТЭБ;
- `src/widgets` — крупные панели интерфейса GPSS Studio;
- `src/shared` — общие типы, API-клиент, компоненты и графические ресурсы;
- `backend/GpssStudio.WebApi` — ASP.NET Core Web API, сервисы, EF Core и DI;
- `backend/database/init` — начальная схема и данные PostgreSQL;
- `docker` — конфигурация nginx;
- `scripts/windows` — переносимый запуск и упаковка проекта;
- `docker-compose.yml` — единая конфигурация frontend, backend и PostgreSQL.

## Хранение данных

PostgreSQL использует именованный Docker volume `gpss_postgres_data`. Обычная остановка или обновление контейнеров данные не удаляет. Не запускайте `docker compose down --volumes`, если требуется сохранить проекты и результаты моделирования.
