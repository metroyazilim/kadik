import { __issueForTestSupportOnly, type AdminContext } from "./admin-context";

/**
 * SCRIPT-ONLY. Mints a real, provenance-tracked `AdminContext` from a
 * synthetic session for trusted server-side CLI scripts under `scripts/`
 * (`docker/entrypoint.sh`'s first-boot content bootstrap, `npm run
 * media:import`, `npm run db:seed-kadik`) that have no live Next.js request
 * to call `requireAdmin()` against - the same fundamental limitation
 * `admin-context-test-support.ts` exists for, but for scripts that must run
 * inside a production container rather than a test runtime. The returned
 * value passes `assertAdminContext()` exactly like a real one, because it
 * goes through the same `issue()`/`WeakSet` registration
 * `resolveAdminContext()` uses.
 *
 * Deliberately not gated by `NODE_ENV`, unlike the test-support module:
 * these scripts are invoked directly by whoever already has shell/CLI
 * access to the deployment - the same access level as the database
 * credentials they already hold - so an environment check adds no real
 * boundary here. It would only make the container's own documented
 * first-boot seeding step fail exactly where it must run. Never import
 * this from application request-handling code; only from a top-level CLI
 * script under `scripts/`.
 */
export function issueScriptAdminContext(
  session: Readonly<{ id: string; email: string }>,
): AdminContext {
  return __issueForTestSupportOnly(session);
}
