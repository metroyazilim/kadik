import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "./lib/session-token";

const PUBLIC_PATHS: Record<string, true> = {
  "/manage/login": true,
  "/manage/forgot-password": true,
  "/manage/reset-password": true,
};

/**
 * Centralized, structural gate for every current and future `/manage`
 * route: a request with no syntactically valid session cookie never
 * reaches page code. Deliberately lightweight (signature+expiry only, no
 * database call) - defense-in-depth per Vercel's routing-middleware
 * guidance, not the sole protection layer. The authoritative
 * tokenVersion-vs-database check stays in `lib/admin-auth.ts`'s
 * `getAdminSession()`/`requireAdmin()`, called from each page/action
 * exactly as before.
 *
 * `PUBLIC_PATHS` are the pre-auth pages an unauthenticated visitor must be
 * able to reach - login itself, plus the forgot/reset-password pair. Only
 * whitelisting the login path (as before) 307'd a signed-out visitor
 * straight back to it from forgot/reset-password, making "Şifremi
 * unuttum" and the emailed reset link both silently dead ends.
 */
export async function proxy(request: NextRequest) {
  if (PUBLIC_PATHS[request.nextUrl.pathname]) return NextResponse.next();

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.redirect(new URL("/manage/login", request.url));
  return NextResponse.next();
}

// NOTE: still named `config` (not `proxyConfig`) - verified directly against
// this repo's installed Next.js 16.3.4 source
// (node_modules/next/dist/build/analysis/get-page-static-info.js), which
// reads the literal identifier `config` regardless of proxy vs middleware.
// A `proxyConfig` export is silently ignored, which would run this file's
// logic on every route instead of only `/manage/:path*`.
export const config = {
  matcher: ["/manage/:path*"],
};
