import { NextResponse } from "next/server";
import { resolveAdminContext } from "@/lib/content-model/admin-context";

/**
 * Test-support only. Proves resolveAdminContext() end-to-end against a real
 * login-established session (AC-1.1-05), without wiring resolveAdminContext()
 * into any legacy /manage page prematurely - that migration is a later
 * epic's job. Mirrors lib/content-model/admin-context-test-support.ts's own
 * production-guard convention.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const context = await resolveAdminContext();
  return NextResponse.json({ actorId: context.actorId, actorEmail: context.actorEmail });
}
