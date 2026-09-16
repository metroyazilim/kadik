import { ContentModelError } from "./errors";

/**
 * Module-private brand (defense-in-depth at the type level: prevents a
 * plain `{ actorId, actorEmail }` object literal from structurally
 * type-checking as `AdminContext` without an explicit unsafe cast).
 */
const ADMIN_CONTEXT_BRAND: unique symbol = Symbol("AdminContext");

/**
 * The actual enforced invariant. An `AdminContext` is authentic if and only
 * if it is a member of this `WeakSet` **by object identity** - not by
 * having a matching shape, a matching symbol key, or any other structural
 * property. This is deliberately not a property check
 * (`ADMIN_CONTEXT_BRAND in value`): that check accepts a *Proxy* whose
 * `has`/`get` traps report the symbol as present, and it accepts a plain
 * object created via `Object.create(realContext)` (which inherits the
 * brand through the prototype chain while carrying its own, attacker-chosen
 * `actorId`/`actorEmail`). Neither a Proxy wrapping a real context nor an
 * object merely descending from one is ever a member of this `WeakSet`,
 * because both are different object references than the one `issue()`
 * created and registered.
 */
const issuedContexts = new WeakSet<object>();

export type AdminContext = Readonly<{
  readonly [ADMIN_CONTEXT_BRAND]: true;
  actorId: string;
  actorEmail: string;
}>;

function issue(session: Readonly<{ id: string; email: string }>): AdminContext {
  // Cast is safe: this is the one and only place an AdminContext-shaped
  // object is constructed, immediately frozen, and registered below.
  const context = Object.freeze({
    [ADMIN_CONTEXT_BRAND]: true,
    actorId: session.id,
    actorEmail: session.email,
  }) as AdminContext;
  issuedContexts.add(context);
  return context;
}

/**
 * The only production path to an `AdminContext`. Takes **no argument** -
 * there is no parameter through which any caller, production or otherwise,
 * can substitute a different session source. Loads `lib/admin-auth.ts`'s
 * `requireAdmin()` - the existing JWT-cookie + `tokenVersion` boundary -
 * via a deferred import and mints a tracked, frozen context from its
 * result.
 *
 * Deferred import, not a static top-level one: `admin-auth.ts`
 * transitively requires `next/headers`' request-scoped `cookies()`, which
 * is unresolvable outside a live Next.js server request - not merely a
 * `server-only` bundler-convention issue. A static import would make this
 * whole module fail to load under a plain test runtime. Loading it only
 * inside this function body means it only ever executes inside a real
 * Next.js server request (Epic 1 Story 1.1's admin routes).
 *
 * Tests that need an `AdminContext` without a live session use
 * `lib/content-model/admin-context-test-support.ts`'s
 * `issueTestAdminContext()` instead of a parameter on this function -
 * testing `requireAdmin()`'s own login/session-establishment behavior is
 * Epic 1 Story 1.1's contract, not this slice's.
 */
export async function resolveAdminContext(): Promise<AdminContext> {
  const { requireAdmin } = await import("../admin-auth");
  const session = await requireAdmin();
  return issue(session);
}

/**
 * Rejects anything that is not a value produced by `resolveAdminContext()`
 * (or, in a test, `issueTestAdminContext()` - both route through the same
 * `issue()` and the same `issuedContexts` registry). Every
 * `AdminContentStore` function calls this first, before any query runs, so
 * a forged actor never reaches the database (AC-0.3-01).
 */
export function assertAdminContext(value: unknown): asserts value is AdminContext {
  if (typeof value !== "object" || value === null || !issuedContexts.has(value)) {
    throw new ContentModelError(
      "invalidInput",
      "Invalid actor context: must be produced by resolveAdminContext().",
    );
  }
}

/**
 * @internal Exported only so `admin-context-test-support.ts` (a separate,
 * clearly-named, defense-in-depth-guarded test seam - see that file) can
 * mint a properly-tracked context from a synthetic session. Never import
 * this from anywhere else; it performs no session verification of its own.
 */
export const __issueForTestSupportOnly = issue;
