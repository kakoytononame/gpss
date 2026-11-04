GPSS Studio — запуск из готовых образов
=======================================

1. Один раз установите Docker Desktop: https://www.docker.com/products/docker-desktop/
   (на Windows — с WSL 2) и перезагрузите компьютер.
2. Распакуйте архив в любую папку.
3. Дважды щёлкните START_GPSS_STUDIO.cmd.
   Первый запуск скачивает образы (около 500 МБ), следующие — несколько секунд.
   Браузер откроется сам: http://127.0.0.1:8080
4. Остановка — STOP_GPSS_STUDIO.cmd. Данные (проекты, результаты) сохраняются
   в Docker volume gpss_postgres_data и не удаляются при остановке и обновлении.

Нужны свободные порты 8080, 3001 и 55432.
Ничего не собирается на компьютере: исходный код не нужен.

ИИ-пояснения результатов (необязательно): задайте переменные окружения
GPSS_AI_PROVIDER=local и GPSS_AI_MODEL=qwen2.5:3b и запустите
  docker compose --project-name gpss --profile ai up -d
или GPSS_AI_PROVIDER=anthropic и ANTHROPIC_API_KEY для Claude.
