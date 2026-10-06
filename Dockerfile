FROM node:20-alpine

RUN apk add --no-cache postgresql-client \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile \
  && pnpm --dir backend install \
  && pnpm --dir frontend install

COPY . .

RUN cd backend \
    && pnpm prisma generate \
    && cd .. \
    && pnpm run build \
    && mkdir -p /app/backend/backups /app/backend/uploads
    
ENV NODE_ENV=production
ENV PORT=4000
ENV PG_DUMP_PATH=/usr/bin/pg_dump

EXPOSE 4000

WORKDIR /app/backend

CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm db:seed && node dist/src/server.js"]git add Dockerfile
