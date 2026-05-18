FROM node:22-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
RUN echo "=== Checking lib/queue ===" && ls -la /app/lib/queue/ || echo "lib/queue NOT FOUND"
RUN echo "=== Checking scripts ===" && ls -la /app/scripts/
RUN echo "=== Root contents ===" && ls -la /app/
CMD ["node_modules/.bin/tsx", "scripts/start-digest-worker.ts"]
