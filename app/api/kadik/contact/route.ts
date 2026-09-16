import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = String(payload?.name ?? "").trim();
  const email = String(payload?.email ?? "").trim().toLowerCase();
  const message = String(payload?.message ?? "").trim();
  const subject = String(payload?.subject ?? "").trim() || "Kadık iletişim formu";
  const phone = String(payload?.phone ?? "").trim() || null;
  if (!name || !email || !email.includes("@") || !message) return NextResponse.json({ error: "Geçerli alanları doldurun." }, { status: 400 });
  const submissionHash = createHash("sha256").update([name, email, phone ?? "", subject, message, Math.floor(Date.now() / 600000)].join("\n")).digest("hex");
  try {
    await prisma.message.create({ data: { locale: "tr", name, email, phone, subject, message, submissionHash } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Kadık contact submission failed", error);
    return NextResponse.json({ error: "Mesaj kaydedilemedi." }, { status: 503 });
  }
}
