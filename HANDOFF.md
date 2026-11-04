# Передача работы (перенос GPSS Studio)

## Что сделано

Подробная карта функций со статусами: [GPSS_STUDIO_PORT.md](GPSS_STUDIO_PORT.md). Кратко:

- Ядро GPSS World (`backend/GpssStudio.Simulation`): почти все блоки и команды, PLUS-процедуры, `TRANSFER FN`, матрицы, группы, потоки, точки останова (`STOP`), сбор динамики показателей (`Monitors`), вычисление СЧА в сеансе (`evaluate`), эксперименты (`ExperimentRunner`, в т. ч. факторы «операнд строки»).
- Проекты GPSS Studio (`backend/GpssStudio.Projects`): импорт `.gsproj`/`.gsdiagram`/`.gps`/`.tlib`/`Form.fog`, генератор текста модели по схеме, заполнение текста формы (`FormModelBuilder`).
- Web API (`backend/GpssStudio.WebApi`): ТЭБы, моделирование, проекты, формы (`projects/forms/apply`), эксперименты, результаты (`/api/alina-gpss/studio/results`: список по проекту, получение, создание, переименование, удаление; таблица `simulation_results`).
- Фронтенд (`src/`): структурная схема с иерархией, редактор ТЭБа, текст модели (подсветка, F12, таблица имён, точки останова), «Состояние модели», отчёт (правка, CSV), графики, «Эксперименты», «Форма ввода данных», «Динамическая форма», «Результаты моделирования».
- «Результаты моделирования»: клиент `shared/api/resultApi.ts`, типы `shared/types/result.ts` (содержимое результата — JSON, его формирует клиент: `SingleResultPayload` / `SeriesResultPayload`), срез `store/slices/resultSlice.ts`, документ `ui/ResultsDocument`, узел `results-root` в дереве проекта. Автосохранение: `runForm` (одиночный эксперимент с исходными данными формы) и `runExperiment` (серия с планом); обычный прогон — кнопка «Сохранить прогон». Таблица и график серии вынесены в `ui/ExperimentsDocument/ExperimentResultView.tsx`.
- Итоговый отчёт: `StudioProject.Report` (бэкенд, хранится в документе проекта), `model/finalReport.ts` (сбор фрагментов из DOM вкладки, HTML, MHTML для Word), `shared/lib/chartImage.ts` (SVG графика → PNG через canvas), срез `store/slices/finalReportSlice.ts`, документ `ui/FinalReportDocument`, кнопка «Добавить в отчёт» на вкладках результата.
- Тесты ТЭБов: `model/tebTests.ts` (проверки ТЭБов проекта по схеме и сообщениям генератора, проверки ТЭБа в редакторе), срез `store/slices/tebTestSlice.ts` (`runTebTests` вызывает `projects/generate`, `focusTebTest` открывает уровень схемы и выделяет ТЭБ), панель `widgets/desktop-shell/RightDockPanel/TestsView.tsx`. Демонстрационные тесты удалены.
- Проверки на 6 примерах из дистрибутива (`scripts/fetch-gpss-studio-samples.sh`, `GPSS_STUDIO_SAMPLES=...`): генерация совпадает с текстами Studio, время завершения совпадает с журналами GPSS World, формы читаются и выполняются.
- Тесты: движок 98, проекты 37 (52 с примерами), API 63, Vitest 126, Playwright 12 — все зелёные. `*.sh` хранятся с LF (`.gitattributes`), иначе на Windows-клонах `api-tests` в Docker падает на `set -e
`.

- Структурная схема: «Вписать» при открытии уровня, масштаб (панель, Ctrl ±/0, Ctrl + колесо), прокрутка перетаскиванием фона, сетка с привязкой, миникарта, плавные связи, подсветка связей выбранного ТЭБа, сдвиг стрелками.
- Конструктор СМО (`backend/GpssStudio.Simulation/Queueing`, `src/features/teb-editor/ui/QueueingDocument`, срез `store/slices/queueingSlice.ts`, API `/api/alina-gpss/studio/queueing`): описание классов и узлов → текст модели GPSS → теория (точные формулы и приближения) → прогоны с доверительными интервалами. Каталог `QueueingPresets` (29 систем) одновременно служит набором тестов `QueueingPresetTests`: точные формулы должны совпадать с моделированием. Попутно исправлено ядро: порядок цепи задержки памяти по приоритету, `LINK` по параметру/`PR`, `UNLINK` с `BACK` и отбором по параметру, выбор владельца после `RETURN` при `PREEMPT PR`, процедуры `Gamma`/`Weibull`.
- Тесты: движок и конструктор 162, проекты 37 (52 с примерами), API 72, Vitest 137, Playwright 13. В облачной песочнице e2e-тест выгрузки отчёта в Word падает из-за имени скачанного файла («download») — это особенность здешнего Chromium.

## Что осталось

1. ~~Фронтенд «Результаты моделирования»~~ — сделано (см. выше).
2. ~~Виртуальный (итоговый) отчёт~~ — сделано; не сделаны шаблоны отчётов GPSS Studio. Было в плане: «Добавить в отчёт» на вкладках результата, список фрагментов, выгрузка в HTML (открывается в Word), графики — PNG из SVG через canvas.
3. ~~Тесты ТЭБов, связанные с проектом~~ — сделано.
4. Анимационная форма, оптимизация IOSO (сейчас перебор по сетке), экспорт проекта обратно в формат GPSS Studio, `TEMPORARY MATRIX`, `EXPERIMENT/CONDUCT`, `INCLUDE`, `INTEGRATE`, подсказки и сворачивание строк в редакторе, управляющие комментарии отладчика.
5. Обновить README/GPSS_STUDIO_PORT.md и счётчики тестов после каждого пункта.
6. Конструктор СМО: fork–join, групповое обслуживание, неоднородные каналы; аналитика для отказов прибора и смешанных сетей; сохранение описаний СМО в проекте (сейчас — в localStorage браузера).

## ИИ-анализ результатов

Сделан для конструктора СМО, дизайн и настройка — в [AI_ANALYSIS.md](AI_ANALYSIS.md): встроенный анализатор `QueueingInsights` (работает всегда) и необязательная языковая модель — локальная через OpenAI-совместимый сервер (`Analysis__Provider=local`, профиль `ai` с Ollama) или Claude через SDK `Anthropic` (`Analysis__Provider=anthropic`). Дальше по плану: потоковый ответ, вопросы в свободной форме с пересчётом через инструменты, анализ стандартного отчёта и серий экспериментов.

## Окружение песочницы (для следующего агента в облаке)

Без Docker: `apt-get install dotnet-sdk-8.0 postgresql`, `service postgresql start`, пользователь `gpss/gpss`, `GPSS_TEST_DB="Host=localhost;Port=5432;Database=postgres;Username=gpss;Password=gpss"`. API: `dotnet run --no-launch-profile --project backend/GpssStudio.WebApi` с `ASPNETCORE_URLS=http://127.0.0.1:3001`, фронтенд `npx vite`. Playwright — с `launchOptions.executablePath: '/opt/pw-browsers/chromium'`.


Docker запускается вручную (`dockerd`); образы содержат старый порт прокси, поэтому нужен проброс `scratchpad/scripts/portfwd.py 32909 <порт HTTPS_PROXY>` и override `compose.sandbox.yml` (`build.network: host`). Стек: БД 127.0.0.1:55432, API :3001, веб :8080.
