import { NextResponse } from "next/server";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { prisma } from "@/lib/db";
import { createMediaAsset } from "@/lib/media/service";
import { MediaValidationError, validateUploadBuffer } from "@/lib/media/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const context = await resolveAdminContext();

    const formData = await request.formData();
    const file = formData.get("file");
    const altText = (formData.get("altText") as string) || undefined;
    const caption = (formData.get("caption") as string) || undefined;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz dosya yüklemesi: 'file' alanı zorunludur." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalFilename = (file as File).name || "uploaded-file";
    const claimedMime = file.type || undefined;

    // Strict validation
    const validated = validateUploadBuffer(buffer, originalFilename, claimedMime);

    // Save asset
    const asset = await createMediaAsset(prisma, validated, context, { altText, caption });

    return NextResponse.json({ ok: true, asset }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Sunucu hatası";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Admin") ? 401 : 500 }
    );
  }
}
