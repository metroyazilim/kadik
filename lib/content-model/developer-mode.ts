import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { requireAuthSecret } from "../env";

const DEV_MODE_COOKIE = "metro_dev_mode";
/** Session capability window (Spec 14 AD-4): not a global flag, not a
 * long-lived cookie - fifteen minutes, re-authenticated by password. */
const DEV_MODE_MAX_AGE_SECONDS = 15 * 60;

function secretKey(): Uint8Array {
  // Same required-secret boundary as the admin session token: no inline
  // fallback string, so a missing secret fails loudly instead of signing
  // capability tokens with a publicly known key.
  return new TextEncoder().encode(requireAuthSecret());
}

export async function isDeveloperModeActive(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(DEV_MODE_COOKIE)?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.cap === "developer-mode";
  } catch {
    return false;
  }
}

export async function grantDeveloperMode(actorId: string): Promise<void> {
  const token = await new SignJWT({ cap: "developer-mode" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(actorId)
    .setIssuedAt()
    .setExpirationTime(`${DEV_MODE_MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set({
    name: DEV_MODE_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEV_MODE_MAX_AGE_SECONDS,
  });
}

export async function revokeDeveloperMode(): Promise<void> {
  const store = await cookies();
  store.delete(DEV_MODE_COOKIE);
}
