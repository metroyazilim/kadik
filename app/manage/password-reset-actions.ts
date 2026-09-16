"use server";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/admin-auth";
import { sendMail } from "@/lib/mail";

/** A reset link is valid for one hour and for exactly one redemption. */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 12;

export type RequestResetState = { error?: string; success?: string };
export type ApplyResetState = { error?: string; success?: string };

const RequestSchema = z.object({ email: z.string().trim().email() });
const ApplySchema = z
  .object({
    token: z.string().trim().min(16),
    password: z.string().min(MIN_PASSWORD_LENGTH),
    passwordConfirm: z.string().min(MIN_PASSWORD_LENGTH),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    message: "Şifreler eşleşmiyor.",
  });

function resetBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Always reports the same neutral success message, whether or not the
 * address belongs to an admin: a differing response would turn this form
 * into an account-enumeration oracle. Only the token's SHA-256 hash is
 * persisted, so the emailed secret exists nowhere but the recipient's inbox.
 */
export async function requestPasswordResetAction(
  _previous: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const neutral = {
    success: "Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.",
  };

  const input = RequestSchema.safeParse({ email: formData.get("email") });
  if (!input.success) return { error: "Geçerli bir e-posta adresi girin." };

  const email = input.data.email.toLowerCase();
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) return neutral;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Any earlier unused grant is burned first, so a forwarded older mail
  // cannot still reset the password after a new request.
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  const link = `${resetBaseUrl()}/manage/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: "Starter Kurumsal yönetim paneli - şifre sıfırlama",
    text: `Şifrenizi sıfırlamak için bu bağlantıyı açın (1 saat geçerlidir):\n\n${link}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.`,
    html: `<p>Şifrenizi sıfırlamak için aşağıdaki bağlantıyı açın. Bağlantı <strong>1 saat</strong> geçerlidir.</p><p><a href="${link}">Şifremi sıfırla</a></p><p>Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>`,
  });

  await recordAudit({ action: "password.reset.requested", entity: "AdminUser", userId: user.id });
  return neutral;
}

export async function applyPasswordResetAction(
  _previous: ApplyResetState,
  formData: FormData,
): Promise<ApplyResetState> {
  const input = ApplySchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!input.success) {
    const mismatch = input.error.issues.some((issue) => issue.message === "Şifreler eşleşmiyor.");
    return {
      error: mismatch
        ? "Şifreler eşleşmiyor."
        : `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`,
    };
  }

  const tokenHash = createHash("sha256").update(input.data.token).digest("hex");
  const grant = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  const invalid = { error: "Bağlantı geçersiz veya süresi dolmuş. Yeni bir sıfırlama isteyin." };
  if (!grant || grant.usedAt || grant.expiresAt.getTime() < Date.now()) return invalid;

  // Constant-time confirmation that the looked-up row really is this token's
  // row, so a hash-prefix collision cannot short-circuit the lookup.
  const stored = Buffer.from(grant.tokenHash, "hex");
  const presented = Buffer.from(tokenHash, "hex");
  if (stored.length !== presented.length || !timingSafeEqual(stored, presented)) return invalid;

  const passwordHash = await bcrypt.hash(input.data.password, 12);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: grant.id }, data: { usedAt: new Date() } }),
    // Bumping `tokenVersion` invalidates every existing session cookie, so a
    // stolen session cannot survive the password change that locks it out.
    prisma.adminUser.update({
      where: { id: grant.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    }),
  ]);

  await recordAudit({ action: "password.reset.completed", entity: "AdminUser", userId: grant.userId });
  return { success: "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz." };
}
