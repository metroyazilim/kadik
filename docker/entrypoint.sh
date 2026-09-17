#!/bin/sh
# Startup order for every deployment: wait for Postgres, apply migrations,
# bootstrap a still-empty database (first admin and content registries), then
# hand the process over to the Next.js standalone
# server.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${POSTGRES_DB:-}" ]; then
    # docker-compose.yml passes discrete Postgres credentials rather than a
    # pre-built connection string specifically so a generated
    # POSTGRES_PASSWORD containing URL-reserved characters (`/`, `@`, `:`,
    # `%`, ...) - an entirely normal thing for a random secret - never
    # breaks libpq's URI parser the way raw shell string interpolation
    # into `postgresql://user:pass@host/db` does (observed: an unescaped
    # `/` in the password made libpq parse a password substring as the
    # port). `encodeURIComponent` via the already-present Node runtime
    # percent-encodes both fields correctly.
    DATABASE_URL=$(node -e '
      const enc = encodeURIComponent;
      const host = process.env.DATABASE_HOST || "db";
      const port = process.env.DATABASE_PORT || "5432";
      console.log(`postgresql://${enc(process.env.POSTGRES_USER)}:${enc(process.env.POSTGRES_PASSWORD)}@${host}:${port}/${enc(process.env.POSTGRES_DB)}?schema=public`);
    ')
    export DATABASE_URL
  else
    echo "entrypoint: DATABASE_URL is required" >&2
    exit 1
  fi
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
until psql_error=$(psql "$PSQL_URL" -tAc 'SELECT 1' 2>&1 >/dev/null); do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "entrypoint: database is not reachable after 60 attempts. Last error: ${psql_error:-<no output>}" >&2
    echo "entrypoint: DATABASE_URL host/port: $(printf '%s' "$PSQL_URL" | sed -E 's#.*://[^@]*@##; s#/.*##')" >&2
    exit 1
  fi
  # Every 10th attempt: surface the real reason (DNS failure, connection
  # refused, auth failure, ...) instead of a bare "waiting" line - a
  # container-to-container networking problem (the actual cause the one
  # time this loop ran out the full 60 attempts) looks identical to "Postgres
  # is still booting" without this, and both produce nothing but silence
  # for two minutes.
  if [ $((attempt % 10)) -eq 0 ]; then
    echo "entrypoint: waiting for database ($attempt) - ${psql_error:-<no output>}"
  else
    echo "entrypoint: waiting for database ($attempt)"
  fi
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
