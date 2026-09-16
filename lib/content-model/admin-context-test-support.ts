import { __issueForTestSupportOnly, type AdminContext } from "./admin-context";

/**
 * TEST-ONLY. Mints a real, provenance-tracked `AdminContext` from a
 * synthetic session, bypassing `lib/admin-auth.ts`'s `requireAdmin()` -
 * which needs a live Next.js server request this test runtime does not
 * have. The returned value passes `assertAdminContext()` exactly like a
 * real one, because it goes through the same `issue()`/`WeakSet`
 * registration `resolveAdminContext()` uses; this module does not weaken
 * that check, it only supplies an alternate session source, the same way
 * a real HTTP request would supply one to `requireAdmin()`.
 *
 * Defense-in-depth: throws immediately if `NODE_ENV` is `"production"`, so
 * an accidental production import of this module that somehow still gets
 * called does not silently succeed. Only ever import this from a test
 * file. Testing `requireAdmin()`'s own login/session-establishment
 * behavior is Epic 1 Story 1.1's contract, not this slice's.
 */
export function issueTestAdminContext(
  session: Readonly<{ id: string; email: string }>,
): AdminContext {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "issueTestAdminContext() must never be called in a production environment.",
    );
  }
  return __issueForTestSupportOnly(session);
}
