"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { exportEntityForTranslation, importTranslationsAtomically } from "@/lib/content-model/translation-export-import";
import { repairAiJsonText } from "@/lib/content-model/ai-json";

type ActionState = { error?: string; success?: string; payloadJson?: string };

export async function exportTranslationAction(entityId: string): Promise<ActionState> {
  try {
    const admin = await resolveAdminContext();
    if (!admin) return { error: "Oturum açmanız gerekiyor." };

    const bundle = await exportEntityForTranslation(prisma, entityId, "tr", ["en"]);
    return { success: "Global çeviri paketi başarıyla dışarı aktarıldı.", payloadJson: JSON.stringify(bundle, null, 2) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Çeviri dışa aktarılamadı." };
  }
}

export async function importTranslationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await resolveAdminContext();
    if (!admin) return { error: "Oturum açmanız gerekiyor." };

    const entityId = formData.get("entityId");
    const jsonStr = formData.get("translationsJson");
    if (typeof entityId !== "string" || typeof jsonStr !== "string") {
      return { error: "Geçersiz çeviri verisi." };
    }

    const parsed = JSON.parse(repairAiJsonText(jsonStr)) as { translations: Record<string, unknown> };
    await importTranslationsAtomically(prisma, {
      entityId,
      translations: parsed.translations ?? parsed,
      adminContext: admin,
    });

    revalidatePath("/manage");
    return { success: "Global İngilizce çeviri kaydedildi ve yayına alındı." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Çeviri içe aktarılamadı." };
  }
}
