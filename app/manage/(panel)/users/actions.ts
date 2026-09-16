"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";

export type UserActionState = { error?: string; success?: string };

const ROLES = ["SUPER_ADMIN", "ADMIN", "AUTHOR"] as const;

const CreateUserSchema = z.object({
  name: z.string().trim().min(2, "Ad Soyad en az 2 karakter olmalı.").max(120),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin."),
  role: z.enum(ROLES),
  password: z.string().min(10, "Şifre en az 10 karakter olmalı.").max(200),
});

/**
 * Every mutation here is gated on the *database* role of the caller, never
 * on the role carried in the session cookie, so a role change takes effect
 * on the next action rather than on the next login. Only SUPER_ADMIN may
 * create, re-role, reset or delete an account - ADMIN and AUTHOR see the
 * list read-only.
 */
async function requireSuperAdmin(): Promise<
  { ok: true; actorId: string } | { ok: false; error: string }
> {
  const admin = await resolveAdminContext();
  if (!admin) return { ok: false, error: "Oturum açmanız gerekiyor." };

  const actor = await prisma.adminUser.findUnique({
    where: { id: admin.actorId },
    select: { role: true },
  });
  if (actor?.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Bu işlem yalnızca SUPER_ADMIN yetkisiyle yapılabilir." };
  }
  return { ok: true, actorId: admin.actorId };
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createAdminUserAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { error: gate.error };

  const input = CreateUserSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    role: text(formData, "role"),
    password: text(formData, "password"),
  });
  if (!input.success) {
    return { error: input.error.issues[0]?.message ?? "Girdiler geçersiz." };
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email: input.data.email },
    select: { id: true },
  });
  if (existing) return { error: "Bu e-posta zaten kayıtlı." };

  const passwordHash = await bcrypt.hash(input.data.password, 12);
  const created = await prisma.adminUser.create({
    data: {
      name: input.data.name,
      email: input.data.email,
      role: input.data.role,
      passwordHash,
    },
    select: { id: true, email: true, role: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "user.create",
      entity: "AdminUser",
      entityId: created.id,
      userId: gate.actorId,
      metadata: { email: created.email, role: created.role },
    },
  });

  revalidatePath("/manage/users");
  return { success: `${input.data.email} eklendi.` };
}

export async function changeAdminUserRoleAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { error: gate.error };

  const userId = text(formData, "userId");
  const roleValue = text(formData, "role");
  if (!ROLES.includes(roleValue as AdminRole)) return { error: "Geçersiz rol." };
  const role = roleValue as AdminRole;

  const target = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!target) return { error: "Kullanıcı bulunamadı." };
  if (target.role === role) return { success: "Rol zaten güncel." };

  // The panel must never be able to lock itself out of its own
  // administration: the last SUPER_ADMIN cannot be demoted.
  if (target.role === "SUPER_ADMIN") {
    const superAdmins = await prisma.adminUser.count({ where: { role: "SUPER_ADMIN" } });
    if (superAdmins <= 1) return { error: "Son SUPER_ADMIN'in rolü düşürülemez." };
  }

  await prisma.adminUser.update({
    where: { id: userId },
    // A role change is a privilege change: invalidate live sessions so the
    // new role is enforced immediately, not after the cookie expires.
    data: { role, tokenVersion: { increment: 1 } },
  });
  await prisma.auditLog.create({
    data: {
      action: "user.role.change",
      entity: "AdminUser",
      entityId: userId,
      userId: gate.actorId,
      metadata: { email: target.email, from: target.role, to: role },
    },
  });

  revalidatePath("/manage/users");
  return { success: `${target.email} rolü ${role} oldu.` };
}

export async function resetAdminUserPasswordAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { error: gate.error };

  const userId = text(formData, "userId");
  const password = text(formData, "password");
  if (password.length < 10) return { error: "Şifre en az 10 karakter olmalı." };

  const target = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!target) return { error: "Kullanıcı bulunamadı." };

  await prisma.adminUser.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 12), tokenVersion: { increment: 1 } },
  });
  await prisma.auditLog.create({
    data: {
      action: "user.password.reset",
      entity: "AdminUser",
      entityId: userId,
      userId: gate.actorId,
      metadata: { email: target.email },
    },
  });

  revalidatePath("/manage/users");
  return { success: `${target.email} şifresi güncellendi; açık oturumları kapandı.` };
}

export async function deleteAdminUserAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { error: gate.error };

  const userId = text(formData, "userId");
  if (userId === gate.actorId) return { error: "Kendi hesabınızı silemezsiniz." };

  const target = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  if (!target) return { error: "Kullanıcı bulunamadı." };
  if (target.role === "SUPER_ADMIN") {
    const superAdmins = await prisma.adminUser.count({ where: { role: "SUPER_ADMIN" } });
    if (superAdmins <= 1) return { error: "Son SUPER_ADMIN silinemez." };
  }

  // The trail is written before the row disappears. `AuditLog.userId` is
  // `onDelete: SetNull`, so the deleted user's own history stays readable -
  // only the actor pointer is cleared. Reset tokens have no FK, so the
  // pending ones are removed explicitly rather than left orphaned.
  await prisma.auditLog.create({
    data: {
      action: "user.delete",
      entity: "AdminUser",
      entityId: userId,
      userId: gate.actorId,
      metadata: { email: target.email, role: target.role },
    },
  });
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.adminUser.delete({ where: { id: userId } }),
  ]);

  revalidatePath("/manage/users");
  return { success: `${target.email} silindi.` };
}
