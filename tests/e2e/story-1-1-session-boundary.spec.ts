import { expect, test } from "../support/merged-fixtures";

// RED PHASE (ATDD, Story 1.1). All scenarios below depend on:
//  (a) proxy.ts + lib/session-token.ts (do not exist yet - see session-boundary.md §1-2),
//  (b) requireAdmin() redirecting instead of throwing (session-boundary.md §3),
//  (c) logoutAction() incrementing tokenVersion (session-boundary.md §4),
//  (d) an `adminSeed` fixture (does not exist yet - tracked as a fixture need for
//      bmad-build in atdd-e2e-result-story-1-1.json) that creates/removes a real
//      AdminUser row in the SAME database the running dev server uses (not the
//      isolated per-run schema unit/integration tests use - the dev server this
//      spec drives has no knowledge of that schema), and exposes
//      { email, password, userId, bumpTokenVersion() }.
//  (e) a NODE_ENV-guarded test-support route, app/api/test-support/admin-context/route.ts
//      (does not exist yet), mirroring lib/content-model/admin-context-test-support.ts's
//      own production-guard convention: when hit with a valid session cookie it calls
//      resolveAdminContext() and returns { actorId, actorEmail } as JSON, so AC-1.1-05 can
//      be proven end-to-end from a real login without wiring resolveAdminContext() into any
//      legacy /manage page prematurely (that migration is a later epic's job).
// Activated (green phase) during Story 1.1's bmad-build: all application
// pieces this file depends on now exist. See session-boundary.md for the
// underlying contract each scenario exercises.

test.describe("Story 1.1 session boundary (AC-1.1-01..06)", () => {
  test(
    "[P0] AC-1.1-01: valid credentials establish a session and land on the protected area without leaking the password",
    async ({ page, adminSeed }) => {
      await page.goto("/manage/login");
      await page.getByLabel("E-posta").fill(adminSeed.email);
      await page.getByLabel("Şifre").fill(adminSeed.password);
      await page.getByRole("button", { name: "Giriş yap" }).click();

      await page.waitForURL(/\/manage$/);
      await expect(page.getByText(adminSeed.password)).toHaveCount(0);
      // HttpOnly cookies are not exposed to page script - this is the
      // closest a page-level assertion gets to proving the flag from inside
      // the browser context (AC-1.1-06 asserts the header directly via apiRequest).
      const cookieVisibleToScript = await page.evaluate(() => document.cookie.includes("metro_admin_session"));
      expect(cookieVisibleToScript).toBe(false);
    },
  );

  test("[P0] AC-1.1-02: wrong password is rejected with a generic, correctable error", async ({ page, adminSeed }) => {
    await page.goto("/manage/login");
    await page.getByLabel("E-posta").fill(adminSeed.email);
    await page.getByLabel("Şifre").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "Giriş yap" }).click();

    // Next.js's own route announcer (#__next-route-announcer__) also
    // carries role="alert" - filter to the app's actual error paragraph.
    await expect(page.getByRole("alert").filter({ hasText: "hatalı" })).toHaveText("E-posta veya şifre hatalı.");
    await expect(page.getByRole("heading", { name: "Yönetim paneli" })).toBeVisible();
  });

  test(
    "[P0] AC-1.1-02: a stale-tokenVersion cookie is rejected on a protected page with a safe re-login result, not a thrown error",
    async ({ page, adminSeed }) => {
      await page.goto("/manage/login");
      await page.getByLabel("E-posta").fill(adminSeed.email);
      await page.getByLabel("Şifre").fill(adminSeed.password);
      await page.getByRole("button", { name: "Giriş yap" }).click();
      await page.waitForURL(/\/manage$/);

      // Invalidate the just-issued cookie's tokenVersion server-side, then
      // reuse the same (now-stale) cookie against a protected page.
      await adminSeed.bumpTokenVersion();
      await page.goto("/manage/site-settings");

      await page.waitForURL(/\/manage\/login/);
      await expect(page.locator("body")).not.toContainText(/Error:|at Object\.|node_modules/);
    },
  );

  test(
    "[P0] AC-1.1-03: a visitor with no session is redirected away from a protected /manage page while public routes keep working",
    async ({ page }) => {
      await page.context().clearCookies();
      await page.goto("/manage/site-settings");
      await page.waitForURL(/\/manage\/login/);

      await page.goto("/tr");
      await expect(page.getByRole("banner")).toBeVisible();
    },
  );

  test(
    "[P0] AC-1.1-04: logging out invalidates the session so a replayed pre-logout cookie is rejected on its next protected request",
    async ({ page, context, adminSeed }) => {
      await page.goto("/manage/login");
      await page.getByLabel("E-posta").fill(adminSeed.email);
      await page.getByLabel("Şifre").fill(adminSeed.password);
      await page.getByRole("button", { name: "Giriş yap" }).click();
      await page.waitForURL(/\/manage$/);

      const capturedCookies = await context.cookies();

      await page.getByRole("button", { name: "Çıkış yap" }).click();
      await page.waitForURL(/\/manage\/login/);

      const freshContext = await page.context().browser()!.newContext();
      await freshContext.addCookies(capturedCookies);
      const replayPage = await freshContext.newPage();
      await replayPage.goto("/manage/site-settings");
      await replayPage.waitForURL(/\/manage\/login/);

      // The revoke is scoped to admin auth - a public route on the same
      // (still-valid-looking) context is unaffected.
      await replayPage.goto("/tr");
      await expect(replayPage.getByRole("banner")).toBeVisible();
      await freshContext.close();
    },
  );

  test(
    "[P0] AC-1.1-06: in production, the session cookie is Secure and HttpOnly",
    { annotation: [{ type: "requires", description: "server started with NODE_ENV=production; run with E2E_TARGET_PRODUCTION=1" }] },
    async ({ page, context, adminSeed }) => {
      test.skip(!process.env.E2E_TARGET_PRODUCTION, "Requires a server started with NODE_ENV=production - set E2E_TARGET_PRODUCTION=1 against such a target.");

      await page.goto("/manage/login");
      await page.getByLabel("E-posta").fill(adminSeed.email);
      await page.getByLabel("Şifre").fill(adminSeed.password);
      await page.getByRole("button", { name: "Giriş yap" }).click();
      await page.waitForURL(/\/manage$/);

      // context.cookies() reads at the browser/CDP level, unlike
      // document.cookie - it can see HttpOnly cookies, which is exactly
      // what this assertion needs.
      const cookies = await context.cookies();
      const sessionCookie = cookies.find((cookie) => cookie.name === "metro_admin_session");
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.httpOnly).toBe(true);
      expect(sessionCookie?.secure).toBe(true);
    },
  );

  test(
    "[P0] AC-1.1-06: auth error responses never contain a stack trace, file path, or JWT content",
    async ({ page, adminSeed }) => {
      await page.goto("/manage/login");
      await page.getByLabel("E-posta").fill(adminSeed.email);
      await page.getByLabel("Şifre").fill("definitely-the-wrong-password");
      await page.getByRole("button", { name: "Giriş yap" }).click();

      await expect(page.locator("body")).not.toContainText(/Error:|at Object\.|node_modules|eyJ[A-Za-z0-9_-]{10,}/);
    },
  );

  test(
    "[P0] AC-1.1-05: resolveAdminContext(), called from a real login-established session, resolves to that session's actor identity",
    async ({ page, context, apiRequest, adminSeed }) => {
      await page.goto("/manage/login");
      await page.getByLabel("E-posta").fill(adminSeed.email);
      await page.getByLabel("Şifre").fill(adminSeed.password);
      await page.getByRole("button", { name: "Giriş yap" }).click();
      await page.waitForURL(/\/manage$/);

      // apiRequest's underlying `request` fixture is a worker-scoped
      // APIRequestContext independent of the browser context - it does not
      // automatically carry cookies set via page navigation. Forward the
      // just-established session cookie explicitly.
      const cookies = await context.cookies();
      const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

      const { status, body } = await apiRequest<{ actorId: string; actorEmail: string }>({
        method: "GET",
        path: "/api/test-support/admin-context",
        headers: { Cookie: cookieHeader },
      });

      expect(status).toBe(200);
      expect(body.actorId).toBe(adminSeed.userId);
      expect(body.actorEmail).toBe(adminSeed.email);
    },
  );
});
