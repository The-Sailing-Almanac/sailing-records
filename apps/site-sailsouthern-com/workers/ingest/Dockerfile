FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

COPY workers/ingest/package.json ./workers/ingest/
COPY apps/api/package.json ./apps/api/

RUN npm install --workspace=@sailsouthern/ingest-worker --workspace=almanac-api

COPY workers/ingest/ ./workers/ingest/
COPY apps/api/src/lib/ ./apps/api/src/lib/
COPY data/ ./data/

RUN cd workers/ingest && npm run build

WORKDIR /app/workers/ingest

CMD ["node", "dist/index.js"]
