# Corporate website starter - production image (Next.js standalone + Prisma + psql).
# Build context is the repository root; `.env` is never copied in (see .dockerignore).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` runs route type-checking only; no database connection is made,
# so a syntactically valid placeholder URL is enough for Prisma client codegen.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# postgresql-client: the entrypoint waits for and checks PostgreSQL with psql
# on a first, empty deployment.
RUN apk add --no-cache postgresql17-client

COPY --from=build /app/public ./public
# Fonts read at request time by the news share-card route (app/news/[slug]/opengraph-image.tsx).
COPY --from=build /app/assets ./assets
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Full node_modules (not only the Next.js standalone trace): the entrypoint
# runs `prisma migrate deploy` and `prisma/seed.ts` via tsx directly, and
# neither is reachable through the app's own traced server bundle.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
# `prisma/seed.ts` imports lib/env + the three content registries as source.
COPY --from=build /app/lib ./lib
# Operational recovery CLIs run the same way as the seed (tsx, source form) -
# `scripts/reset-admin-password.ts` needs to be reachable without a rebuild
# round-trip when an admin is locked out.
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
