FROM node:22-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
CMD ["node_modules/.bin/tsx", \
     "--max-old-space-size=4096", \
     "scripts/start-digest-worker.ts"]
