import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "./lib/session-token";

/**
 * Optional "coming soon" holding page (`app/coming-soon`). OFF by default:
 * every host serves the real site. To bring the holding page back for a
 * domain, set `COMING_SOON_HOSTS` (comma-separated), e.g.
 * `COMING_SOON_HOSTS="kadiklondon.org,www.kadiklondon.org"`, and restart.
 * The page itself is kept in the codebase for reuse.
 */
const COMING_SOON_HOSTS = new Set(
  (process.env.COMING_SOON_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0),
);

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
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  if (COMING_SOON_HOSTS.size > 0 && COMING_SOON_HOSTS.has(host) && request.nextUrl.pathname !== "/coming-soon") {
    return NextResponse.rewrite(new URL("/coming-soon", request.url));
  }

  if (!request.nextUrl.pathname.startsWith("/manage")) return NextResponse.next();
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
// logic on every route instead of only the matched paths below.
//
// Matcher now covers every path (not only `/manage/:path*`) so the
// coming-soon host check above runs on every request; excludes Next's own
// static asset/image pipelines, which never need either check.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
