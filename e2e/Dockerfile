# Browser tests against the running stack: docker compose --profile test run --rm e2e
FROM mcr.microsoft.com/playwright:v1.56.1-jammy

WORKDIR /e2e
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY playwright.config.ts tsconfig.node.json ./
COPY e2e ./e2e

CMD ["npx", "playwright", "test"]
