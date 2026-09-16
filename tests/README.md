# Metro test framework

## Setup

```bash
npm install
npx playwright install chromium
```

The suite uses Playwright with `@seontechnologies/playwright-utils`. `BASE_URL`
defaults to `http://127.0.0.1:3000`; override it for a running deployment or
another local port. Do not place credentials, tokens, or cookies in the repo.

## Run

```bash
npm run test:unit
TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/metro_test" npm run test:integration
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:debug
```

The unit and integration scripts use `playwright.contract.config.ts` directly
and never start the Next.js web server. The E2E commands use
`playwright.config.ts`, whose default command starts Next.js when no local server
is already available.

## Layout

- `e2e/` — browser journeys and acceptance-level UI checks.
- `support/merged-fixtures.ts` — the only test entry point; composes API,
  network, retry, logging, and auth fixtures.
- `unit/` and `integration/` — direct, non-browser contract checks.
- `support/fixtures/story-0-1-fixture.ts` — run-scoped database fixture entry
  point for Story 0.1.
- `support/auth-fixture.ts` — project auth-provider boundary. Admin auth is
  intentionally disabled until Story 1.1 approves its login contract.
- `global-setup.ts` — initializes isolated auth storage paths.

## Isolation and selectors

Prefer role, label, and stable `data-testid` selectors. Keep each test
independent and use run-scoped fixture helpers for database contracts.
`TEST_DATABASE_URL` must identify a distinct local or CI-only test database and
must never identify the same host, port, and database name as `DATABASE_URL`.

`TEST_DATABASE_URL` is accepted only for PostgreSQL targets whose normalized
hostname is `loopback`, `postgres`, `db`, `test-db`, or `test-postgres`, and
whose database name contains `test`. This intentionally supports local
PostgreSQL and standard CI service aliases while rejecting arbitrary remote or
production-like targets. The URL is also compared with `DATABASE_URL` by
hostname, port, and database name before any schema is created.
Do not use sleeps; use the `recurse` fixture for eventual consistency. Use
`apiRequest` for application HTTP calls and `interceptNetworkCall` for browser
network assertions. Import `test` from `support/merged-fixtures.ts`, never
straight from `@playwright/test` in an integration or E2E spec.

## CI

The config retains traces and videos on failure and screenshots only on failure.
The TEA write-time enforcement hook is not installed because Codex has no
supported tool-hook interception point; `bmad-testarch-test-review` remains the
review gate.

Persistent, reviewed Story evidence belongs in
`_bmad-output/test-artifacts/story-0-1-evidence.md`. Playwright HTML, JUnit, and
runtime result directories are generated evidence and remain ignored.

## TEA references

The setup follows the installed TEA knowledge fragments for Playwright utility
mandates, fixture composition, API requests, network-first checks, auth-session
boundaries, recursion, logging, and test quality.
