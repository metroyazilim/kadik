import { expect, test } from "@playwright/test";

// Activated (green phase) during Story 1.1's bmad-build: lib/session-token.ts
// now holds signSessionToken/verifySessionToken, extracted from
// lib/admin-auth.ts's former private secretKey()/createToken()/verifyToken()
// trio, per session-boundary.md's companion contract, section 1.
import { signSessionToken, verifySessionToken } from "../../lib/session-token";

// Self-contained, synthetic secret - this is a pure crypto round-trip test,
// not a check against the app's actual configured AUTH_SECRET, and must not
// depend on .env being present in the plain (non-Next.js) test runtime.
process.env.AUTH_SECRET = "test-only-session-token-secret-32-chars-min";

const REAL_USER = { id: "user-1", email: "admin@example.com", name: "Admin Örnek", tokenVersion: 3 };

test.describe("Story 1.1 session-token (AC-1.1-02, AC-1.1-06)", () => {
  test("[P0] verifySessionToken accepts a freshly signed, unexpired token and returns its payload", async () => {
    const token = await signSessionToken(REAL_USER, 60);
    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(REAL_USER.id);
    expect(payload?.email).toBe(REAL_USER.email);
    expect(payload?.name).toBe(REAL_USER.name);
    expect(payload?.ver).toBe(REAL_USER.tokenVersion);
  });

  test("[P0] verifySessionToken rejects a token whose signature was tampered with", async () => {
    const token = await signSessionToken(REAL_USER, 60);
    const [header, payload] = token.split(".");
    const tampered = `${header}.${payload}.tampered-signature-not-base64url-valid`;
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  test("[P0] verifySessionToken rejects an expired token", async () => {
    const expiredToken = await signSessionToken(REAL_USER, -1);
    expect(await verifySessionToken(expiredToken)).toBeNull();
  });

  test("[P1] verifySessionToken rejects undefined, empty, and malformed input without throwing", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken("not-a-jwt-at-all")).toBeNull();
  });

  test("[P2] verifySessionToken performs no tokenVersion-vs-database check - a mismatched ver still verifies at the signature layer", async () => {
    // This is the deliberate boundary from session-boundary.md: signature+expiry
    // only, no Prisma. The database-backed tokenVersion comparison lives solely
    // in lib/admin-auth.ts's getAdminSession(), never here - proxy.ts must be able
    // to import this module without pulling in Prisma or next/headers.
    const staleUser = { ...REAL_USER, tokenVersion: 999 };
    const token = await signSessionToken(staleUser, 60);
    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.ver).toBe(999);
  });
});
