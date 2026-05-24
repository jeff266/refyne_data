FROM node:22-alpine
WORKDIR /app

# Copy package files from frontend directory
COPY frontend/package*.json frontend/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy all frontend source code
COPY frontend/ .

# Start worker with 6GB heap limit (Railway has 8GB RAM)
CMD ["node_modules/.bin/tsx", \
     "--max-old-space-size=6144", \
     "scripts/start-digest-worker.ts"]
