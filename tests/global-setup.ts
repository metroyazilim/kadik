import { execFileSync } from "node:child_process";
import {
  authStorageInit,
  configureAuthSession,
} from "@seontechnologies/playwright-utils/auth-session";
import "./support/auth-fixture";

/**
 * Spec 5 §7/AC-5.13: runs once, after Playwright's own `webServer.url`
 * readiness wait has already confirmed `baseURL` responds (Playwright
 * guarantees `globalSetup` executes after that wait, never before) - so a
 * fetch here always reaches a live server, whether Playwright just spawned
 * it or `reuseExistingServer: true` adopted one already running. Compares
 * that server's working directory and commit against this test run's own,
 * aborting the whole run with an explicit message on any mismatch instead
 * of silently exercising the wrong code (the "wrong localhost" trap
 * `docs/context/ai-workflow-rules.md` already documents).
 */
async function verifyServerIdentity(): Promise<void> {
  const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
  const response = await fetch(new URL("/api/dev-tools/server-identity", baseURL));
  if (!response.ok) {
    throw new Error(
      `Server identity check failed: ${baseURL} responded ${response.status}. Is a stale server occupying this port?`,
    );
  }
  const identity = (await response.json()) as { workingDirectory: string; gitSha: string | null };

  const expectedWorkingDirectory = process.cwd();
  let expectedGitSha: string | null = null;
  try {
    expectedGitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: expectedWorkingDirectory, encoding: "utf8" }).trim();
  } catch {
    expectedGitSha = null;
  }

  if (identity.workingDirectory !== expectedWorkingDirectory) {
    throw new Error(
      `Server identity mismatch: the server on ${baseURL} is running from "${identity.workingDirectory}", ` +
        `but this test run is executing from "${expectedWorkingDirectory}". Stop the other server (or run tests from its directory) before retrying.`,
    );
  }
  if (expectedGitSha !== null && identity.gitSha !== null && identity.gitSha !== expectedGitSha) {
    throw new Error(
      `Server identity mismatch: the server on ${baseURL} is running commit ${identity.gitSha}, ` +
        `but this test run is at ${expectedGitSha}. Restart the dev server against the current commit before retrying.`,
    );
  }
}

export default async function globalSetup(): Promise<void> {
  await verifyServerIdentity();

  const identifiers = {
    environment: process.env.TEST_ENV ?? "local",
    userIdentifier: process.env.TEST_USER_IDENTIFIER ?? "default",
  };
  const storage = authStorageInit(identifiers);

  configureAuthSession({
    ...identifiers,
    storageDir: storage.storageDir,
    debug: process.env.DEBUG_TESTS === "1",
  });
}
