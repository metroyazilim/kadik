"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { endAdminSession, recordAudit, requireAdmin, startAdminSession } from "@/lib/admin-auth";

const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
type LoginState = { error?: string };


export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const input = LoginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!input.success) return { error: "E-posta ve şifre gerekli." };
  try {
    const user = await prisma.adminUser.findUnique({ where: { email: input.data.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(input.data.password, user.passwordHash))) return { error: "E-posta veya şifre hatalı." };
    await recordAudit({ action: "login", entity: "session", userId: user.id });
    await startAdminSession(user);
  } catch {
    return { error: "Yönetim hizmetine şu anda ulaşılamıyor. Lütfen kısa bir süre sonra tekrar deneyin." };
  }
  redirect("/manage");
}

export async function logoutAction() {
  const session = await requireAdmin();
  await prisma.adminUser.update({ where: { id: session.id }, data: { tokenVersion: { increment: 1 } } });
  await recordAudit({ action: "logout", entity: "session", userId: session.id });
  await endAdminSession();
  redirect("/manage/login");
}
