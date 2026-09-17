import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  message: z.string().trim().min(1).max(10000),
  subject: z.string().trim().max(200).nullish(),
  phone: z.string().trim().max(40).nullish(),
  consent: z.literal(true),
});

export async function POST(request: Request) {
  const parsed = contactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçerli alanları doldurun ve onay kutusunu işaretleyin." }, { status: 400 });
  const { name, email, message } = parsed.data;
  const subject = parsed.data.subject || "KADIK iletişim formu";
  const phone = parsed.data.phone || null;
  const submissionHash = createHash("sha256").update([name, email, phone ?? "", subject, message, Math.floor(Date.now() / 600000)].join("\n")).digest("hex");
  try {
    await prisma.message.create({ data: { locale: "tr", name, email, phone, subject, message, submissionHash } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ ok: true });
    console.error("Kadık contact submission failed", error);
    return NextResponse.json({ error: "Mesaj kaydedilemedi." }, { status: 503 });
  }
}
