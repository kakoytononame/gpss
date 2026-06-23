# GPSS TEB Editor

Веб-проект состоит из трех частей:

- `frontend` на Vite + React + TypeScript в корне репозитория;
- `backend` на ASP.NET Core + EF Core в папке [`backend/GpssStudio.WebApi`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\GpssStudio.WebApi);
- `PostgreSQL`, которая поднимается через Docker Compose и инициализируется SQL-скриптом.

## Быстрый запуск через Docker

1. Установить Docker Desktop.
2. В корне проекта выполнить:

```bash
npm run docker:up
```

После старта сервисы будут доступны по адресам:

- веб-интерфейс: `http://localhost:8080`
- backend API: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432`

Остановить окружение:

```bash
npm run docker:down
```

Логи контейнеров:

```bash
npm run docker:logs
```

## Локальный запуск без Docker

### Frontend

```bash
npm install
npm run dev
```

Vite поднимется на `http://127.0.0.1:5173`.

### Backend

```bash
dotnet run --project backend/GpssStudio.WebApi/GpssStudio.WebApi.csproj --urls http://127.0.0.1:3001
```

По умолчанию backend ожидает PostgreSQL на `Host=localhost;Port=5432;Database=gpss;Username=gpss;Password=gpss`.

## Структура проекта

### Корень

- [`src/app`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\src\app) — точка сборки приложения.
- [`src/features/teb-editor`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\src\features\teb-editor) — бизнес-логика редактора ТЭБ.
- [`src/widgets`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\src\widgets) — крупные элементы оболочки GPSS Studio.
- [`src/shared`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\src\shared) — общие типы, API-клиент, UI-кирпичики и ассеты.
- [`docker`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\docker) — nginx-конфигурация для контейнера с фронтом.

### Backend

- [`backend/GpssStudio.WebApi/Controllers`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\GpssStudio.WebApi\Controllers) — HTTP endpoints.
- [`backend/GpssStudio.WebApi/Application/Tebs/Interfaces`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\GpssStudio.WebApi\Application\Tebs\Interfaces) — интерфейсы сервисного слоя.
- [`backend/GpssStudio.WebApi/Application/Tebs/Services`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\GpssStudio.WebApi\Application\Tebs\Services) — реализации сервисов.
- [`backend/GpssStudio.WebApi/Application/Tebs`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\GpssStudio.WebApi\Application\Tebs) — модели и маппинг ответов.
- [`backend/GpssStudio.WebApi/Infrastructure/Persistence/Interfaces`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\GpssStudio.WebApi\Infrastructure\Persistence\Interfaces) — интерфейсы слоя доступа к данным.
- [`backend/GpssStudio.WebApi/Infrastructure/Persistence/Repositories`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\GpssStudio.WebApi\Infrastructure\Persistence\Repositories) — реализации repository на EF Core.
- [`backend/GpssStudio.WebApi/Infrastructure/Persistence`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\GpssStudio.WebApi\Infrastructure\Persistence) — `DbContext` и EF Core entities.
- [`backend/GpssStudio.WebApi/Contracts`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\GpssStudio.WebApi\Contracts) — request/response DTO.
- [`backend/database/init`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\database\init) — SQL-инициализация схемы и тестовых данных.

## Что делает backend

Backend хранит и обслуживает:

- классы ТЭБ;
- экземпляры ТЭБ;
- GPSS-модель;
- GPSS-объекты;
- входы и выходы;
- параметры и их значения;
- состояния;
- обновления свойств и табличных коллекций.

## Основные файлы

- [`docker-compose.yml`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\docker-compose.yml) — общий запуск всех сервисов.
- [`Dockerfile`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\Dockerfile) — production-сборка фронта.
- [`backend/Dockerfile`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\Dockerfile) — production-сборка backend.
- [`backend/GpssStudio.WebApi/appsettings.json`](C:\Users\timur\OneDrive\Документы\GitHub\gpss\backend\GpssStudio.WebApi\appsettings.json) — connection string и CORS-настройки API.
