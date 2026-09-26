FROM node:20-alpine

RUN apk add --no-cache postgresql-client \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY backend/package.json backend/pnpm-lock.yaml ./backend/
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN pnpm install --frozen-lockfile \
  && pnpm --dir backend install --frozen-lockfile \
  && pnpm --dir frontend install --frozen-lockfile

COPY --chown=node:node . .
RUN pnpm --dir backend prisma generate \
  && pnpm build \
  && mkdir -p /app/backend/backups /app/backend/uploads \
  && chown -R node:node /app/backend/backups /app/backend/uploads

ENV NODE_ENV=production PORT=4000 PG_DUMP_PATH=/usr/bin/pg_dump
EXPOSE 4000
USER node
WORKDIR /app/backend
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm db:seed && node dist/src/server.js"]
