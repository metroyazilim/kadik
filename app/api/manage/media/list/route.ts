import { NextResponse } from "next/server";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { prisma } from "@/lib/db";
import { listMediaAssets } from "@/lib/media/service";
import type { MediaKind } from "@/lib/media/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await resolveAdminContext();

    const { searchParams } = new URL(request.url);
    const kindParam = searchParams.get("kind");
    const query = searchParams.get("query") || undefined;
    const archivedParam = searchParams.get("archived");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);

    const kind: MediaKind | undefined =
      kindParam === "image" || kindParam === "document" ? kindParam : undefined;
    const archived = archivedParam === "true" ? true : archivedParam === "false" ? false : undefined;

    const result = await listMediaAssets(prisma, {
      kind,
      query,
      archived,
      page,
      pageSize,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sunucu hatası";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Admin") ? 401 : 500 }
    );
  }
}
