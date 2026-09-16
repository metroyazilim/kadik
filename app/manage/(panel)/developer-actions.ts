"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { grantDeveloperMode, revokeDeveloperMode, isDeveloperModeActive } from "@/lib/content-model/developer-mode";

type ActionState = { error?: string; success?: string; active?: boolean };

export async function checkDeveloperModeAction(): Promise<ActionState> {
  const active = await isDeveloperModeActive();
  return { active };
}

export async function enableDeveloperModeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await resolveAdminContext();
    if (!admin) return { error: "Oturum açmanız gerekiyor." };

    const password = formData.get("password");
    if (typeof password !== "string" || password.length === 0) {
      return { error: "Şifre gereklidir." };
    }

    const user = await prisma.adminUser.findUnique({ where: { id: admin.actorId } });
    if (!user || user.role !== "SUPER_ADMIN") {
      return { error: "Developer Mode yalnızca SUPER_ADMIN yetkisi gerektirir." };
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return { error: "Geçersiz şifre." };
    }

    await grantDeveloperMode(user.id);
    revalidatePath("/manage");

    return { success: "Developer Mode 15 dakika süreyle aktif edildi.", active: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Developer Mode açılamadı." };
  }
}

export async function disableDeveloperModeAction(): Promise<ActionState> {
  await revokeDeveloperMode();
  revalidatePath("/manage");
  return { success: "Developer Mode kapatıldı.", active: false };
}
