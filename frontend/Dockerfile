FROM node:22-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
CMD ["node_modules/.bin/tsx", "scripts/start-digest-worker.ts"]
