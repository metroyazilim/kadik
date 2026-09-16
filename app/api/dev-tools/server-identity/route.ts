import { execFileSync } from "node:child_process";
import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/env";

/**
 * Spec 5 §7/AC-5.13/AC-5.14: development-only surface the E2E harness
 * (`tests/global-setup.ts`) calls before trusting a server already running
 * on the target port - proves it is the same checkout/commit the test run
 * itself is executing from, so a stale `next dev` left over from another
 * branch/worktree is never silently adopted (`playwright.config.ts`'s
 * `webServer.reuseExistingServer: true` no longer being "blind").
 *
 * Mirrors `app/api/test-support/admin-context/route.ts`'s exact
 * production-guard convention: `404` in production, never a live surface
 * there. Exposes no secret, no raw environment variable value, and no
 * database detail beyond a boolean "configured" flag (AC-5.14) - only
 * process-identity metadata (working directory, current commit) a local
 * test harness needs to compare against itself.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const workingDirectory = process.cwd();
  let gitSha: string | null = null;
  try {
    gitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: workingDirectory, encoding: "utf8" }).trim();
  } catch {
    gitSha = null;
  }

  return NextResponse.json({
    workingDirectory,
    gitSha,
    databaseConfigured: hasDatabase(),
  });
}
