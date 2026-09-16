import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { requireAuthSecret } from "./env";

export const ADMIN_SESSION_COOKIE = "metro_admin_session";
export type SessionTokenPayload = JWTPayload & { email: string; name: string; ver: number };

function secretKey() {
  return new TextEncoder().encode(requireAuthSecret());
}

export async function signSessionToken(
  user: { id: string; email: string; name: string; tokenVersion: number },
  maxAgeSeconds: number,
): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, ver: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secretKey());
}

/**
 * Signature + expiry + shape only. No `cookies()`, no Prisma, no
 * tokenVersion-vs-database check - safe to import from `proxy.ts` without
 * pulling `next/headers` or the Prisma client into its module graph. The
 * authoritative tokenVersion-vs-database check stays solely in
 * `lib/admin-auth.ts`'s `getAdminSession()`.
 */
export async function verifySessionToken(token: string | undefined): Promise<SessionTokenPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.name !== "string") return null;
    return { ...payload, email: payload.email, name: payload.name, ver: typeof payload.ver === "number" ? payload.ver : 0 };
  } catch {
    return null;
  }
}
