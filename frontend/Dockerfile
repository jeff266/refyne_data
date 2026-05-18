FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "tsx", "--tsconfig", "tsconfig.json", "scripts/start-digest-worker.ts"]
