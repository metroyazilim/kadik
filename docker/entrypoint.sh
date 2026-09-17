#!/bin/sh
# Startup order for every deployment: wait for Postgres, apply migrations,
# bootstrap a still-empty database (first admin and content registries), then
# hand the process over to the Next.js standalone
# server.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "entrypoint: DATABASE_URL is required" >&2
  exit 1
fi

# libpq rejects Prisma's client-only query parameters outright ("invalid URI
# query parameter: schema"), so psql gets the same URL minus exactly those
# keys. Every real libpq parameter (sslmode, sslrootcert, connect_timeout,
# application_name, ...) is preserved, which matters for managed Postgres.
psql_url() {
  case "$DATABASE_URL" in
    *\?*) ;;
    *) printf '%s' "$DATABASE_URL"; return ;;
  esac

  base=${DATABASE_URL%%\?*}
  kept=""
  old_ifs=$IFS
  IFS='&'
  for param in ${DATABASE_URL#*\?}; do
    case "$param" in
      ""|schema=*|connection_limit=*|pool_timeout=*|pgbouncer=*|socket_timeout=*|statement_cache_size=*) continue ;;
    esac
    kept=${kept:+$kept&}$param
  done
  IFS=$old_ifs

  printf '%s' "$base${kept:+?$kept}"
}

PSQL_URL=$(psql_url)

attempt=0
until psql "$PSQL_URL" -tAc 'SELECT 1' >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "entrypoint: database is not reachable after 60 attempts" >&2
    exit 1
  fi
  echo "entrypoint: waiting for database ($attempt)"
  sleep 2
done

echo "entrypoint: applying migrations"
./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma

entities=$(psql "$PSQL_URL" -tAc 'SELECT count(*) FROM "ContentEntity"')
if [ "$entities" = "0" ]; then
  # Creates the first SUPER_ADMIN from ADMIN_EMAIL/ADMIN_PASSWORD and
  # bootstraps empty registry rows. Customer content is never bundled.
  echo "entrypoint: bootstrapping first admin and content registries"
  ./node_modules/.bin/tsx prisma/seed.ts
  echo "entrypoint: seeding Kadik initial content (board members + posts)"
  ./node_modules/.bin/tsx scripts/seed-kadik-content.ts || echo "entrypoint: kadik content seed failed, continuing"
else
  echo "entrypoint: database already has $entities content entities, skipping bootstrap"
fi

echo "entrypoint: starting Next.js"
exec node server.js
