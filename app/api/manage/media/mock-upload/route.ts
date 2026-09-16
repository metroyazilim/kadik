import { NextResponse } from "next/server";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { getStorageProvider } from "@/lib/media/storage";

export const dynamic = "force-dynamic";

/**
 * Local stand-in for a Cloudflare R2 presigned `PUT` when no R2 credentials
 * are configured (dev/test): `MemoryStorageProvider.getPresignedUploadUrl`
 * points the browser at this route instead of a real signed URL. Writes
 * the raw request body into the same in-process storage provider singleton
 * `finalizeMediaUpload` later downloads from - it never touches Prisma or
 * the `MediaUploadAttempt` ledger itself, exactly like a real R2 `PUT`
 * wouldn't. Still admin-gated: every other storage-adjacent surface in this
 * app requires a live admin session, and a real R2 bucket would be private
 * besides.
 *
 * Deliberately does not `instanceof MemoryStorageProvider`-guard the
 * provider: this route is only ever reached via a URL
 * `MemoryStorageProvider.getPresignedUploadUrl` itself generated, so
 * reaching it already implies Memory mode was the ticket's intent - an
 * `instanceof` check here would compare against *this route handler's own*
 * bundled class reference, which Next.js's dev bundler can load as a
 * distinct module instance from the one that actually constructed the
 * `globalThis`-shared singleton, making the check spuriously fail.
 */
export async function PUT(request: Request) {
  try {
    await resolveAdminContext();

    const objectKey = new URL(request.url).searchParams.get("key");
    if (!objectKey) {
      return NextResponse.json({ ok: false, error: "Missing 'key' query parameter." }, { status: 400 });
    }

    const buffer = Buffer.from(await request.arrayBuffer());
    const mimeType = request.headers.get("content-type") || "application/octet-stream";
    await getStorageProvider().upload({ objectKey, buffer, mimeType });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sunucu hatası";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("Admin") ? 401 : 500 });
  }
}
