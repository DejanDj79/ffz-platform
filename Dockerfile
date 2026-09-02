# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next evaluates server route modules while collecting build metadata.
# db/client.ts deliberately requires DATABASE_URL at module evaluation time,
# but the production database must NOT be reachable or secret-bearing during
# image build. This isolated build-stage value only lets modules initialize.
# It is never copied into the final runtime image and no DB connection is
# expected during `next build`.
RUN DATABASE_URL="postgresql://ffz:build_only@127.0.0.1:5432/ffz_build" \
    npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV FFZ_UPLOAD_DIR=/app/data/uploads

RUN apk add --no-cache su-exec \
    && mkdir -p /app/data/uploads \
    && chown -R node:node /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/package.json ./package.json

COPY deploy/docker-entrypoint-ffz.sh /usr/local/bin/docker-entrypoint-ffz
RUN chmod 0755 /usr/local/bin/docker-entrypoint-ffz

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-ffz"]
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
