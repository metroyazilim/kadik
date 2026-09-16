import { test as base } from "@playwright/test";
import {
  createAuthFixtures,
  setAuthProvider,
  type AuthFixtures,
  type AuthProvider,
} from "@seontechnologies/playwright-utils/auth-session";

const authProvider: AuthProvider = {
  getEnvironment: (options) => options?.environment ?? process.env.TEST_ENV ?? "local",
  getUserIdentifier: (options) => options?.userIdentifier ?? process.env.TEST_USER_IDENTIFIER ?? "default",
  extractToken: (tokenData) => (typeof tokenData.token === "string" ? tokenData.token : null),
  extractCookies: () => [],
  isTokenExpired: () => false,
  getBaseUrl: () => process.env.BASE_URL ?? "http://127.0.0.1:3000",
  manageAuthToken: async () => {
    // TODO(Story 1.1): connect this provider to the Metro admin session endpoint.
    throw new Error("Metro Playwright auth provider is not configured yet.");
  },
  clearToken: () => undefined,
};

setAuthProvider(authProvider);

const authFixtures = createAuthFixtures();
const authTest = base.extend<{}, AuthFixtures>(
  authFixtures as unknown as Parameters<typeof base.extend<{}, AuthFixtures>>[0],
);

export const test = authTest.extend({
  // Story 0.1 does not exercise admin authentication. Auth is enabled explicitly
  // by the auth stories after their login contract is approved.
  authSessionEnabled: async ({}, fixtureUse) => {
    await fixtureUse(false);
  },
});
