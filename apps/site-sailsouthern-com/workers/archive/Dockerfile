FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY workers/archive/package*.json ./workers/archive/
RUN npm install --omit=dev --workspace=@sailsouthern/archive-worker
COPY workers/archive/dist ./workers/archive/dist
COPY .env .env
CMD ["node", "workers/archive/dist/index.js"]
