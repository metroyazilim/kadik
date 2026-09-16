"use server";

import { revalidatePath } from "next/cache";
import { getAdminDictionary, saveAdminDictionary } from "@/lib/content";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { prisma } from "@/lib/db";
import { isLocale } from "@/lib/i18n/config";
import {
  applyPageCopyFields,
  isPageCopyKey,
  pageCopyGroups,
  PAGE_COPY_KEYS,
} from "@/lib/page-copy-registry";

export type PageCopyActionState = Readonly<{
  status: "success" | "error";
  message: string;
}>;

const PUBLIC_PATHS = [
  "/",
  "/hakkimizda",
  "/servisler",
  "/urunler",
  "/projeler",
  "/blog",
  "/sss",
  "/iletisim",
  "/misyon-ve-vizyon",
  "/gizlilik-politikasi",
  "/kullanim-sartlari",
  "/arama",
] as const;

export async function savePageCopyAction(
  pageKeyValue: string,
  localeValue: string,
  values: Readonly<Record<string, string>>,
): Promise<PageCopyActionState> {
  try {
    const context = await resolveAdminContext();
    if (!isPageCopyKey(pageKeyValue) || !isLocale(localeValue)) {
      return { status: "error", message: "Geçersiz sayfa veya dil." };
    }
    const current = await getAdminDictionary(localeValue);
    const allowedPaths = new Set(
      pageCopyGroups(pageKeyValue, current).flatMap((group) =>
        group.fields.map((field) => field.path),
      ),
    );
    if (Object.keys(values).some((path) => !allowedPaths.has(path))) {
      return { status: "error", message: "Sayfaya ait olmayan bir alan gönderildi." };
    }
    const updated = applyPageCopyFields(pageKeyValue, current, values);
    await saveAdminDictionary(localeValue, updated);
    await prisma.auditLog.create({
      data: {
        action: "page.copy.publish",
        entity: "PageCopy",
        entityId: pageKeyValue,
        userId: context.actorId,
        metadata: { locale: localeValue, fieldCount: Object.keys(values).length },
      },
    });
    revalidatePath(`/manage/pages/${pageKeyValue}`);
    for (const path of PUBLIC_PATHS) revalidatePath(path);
    return { status: "success", message: `${localeValue.toUpperCase()} metinleri kaydedildi ve yayınlandı.` };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Sayfa metinleri kaydedilemedi.",
    };
  }
}

/**
 * Every editable page string in one bundle, keyed `pageKey` -> `dotted.path`.
 * The whole site's fixed copy is translated with a single prompt instead of
 * fourteen separate ones.
 */
export async function exportAllPageCopyAction(): Promise<
  Readonly<{ status: "success"; source: Record<string, Record<string, string>> }> | PageCopyActionState
> {
  try {
    await resolveAdminContext();
    const dictionary = await getAdminDictionary("tr");
    const source: Record<string, Record<string, string>> = {};
    for (const key of PAGE_COPY_KEYS) {
      const fields = pageCopyGroups(key, dictionary).flatMap((group) => group.fields);
      if (fields.length === 0) continue;
      source[key] = Object.fromEntries(fields.map((field) => [field.path, field.value]));
    }
    return { status: "success", source };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Sayfa metinleri okunamadı." };
  }
}

/**
 * Applies `{ locale: { pageKey: { path: text } } }` for every page and
 * locale in one pass. Page copy has no draft stage - writing the dictionary
 * is publishing - so this goes live exactly like the single-page save does.
 */
export async function importAllPageCopyAction(
  translations: Record<string, unknown>,
): Promise<PageCopyActionState> {
  try {
    const context = await resolveAdminContext();
    let written = 0;

    for (const [localeValue, perPage] of Object.entries(translations)) {
      if (localeValue === "tr" || !isLocale(localeValue) || !perPage || typeof perPage !== "object") continue;
      let dictionary = await getAdminDictionary(localeValue);

      for (const [pageKeyValue, values] of Object.entries(perPage as Record<string, unknown>)) {
        if (!isPageCopyKey(pageKeyValue) || !values || typeof values !== "object") continue;
        const allowed = new Set(
          pageCopyGroups(pageKeyValue, dictionary).flatMap((group) => group.fields.map((field) => field.path)),
        );
        const accepted: Record<string, string> = {};
        for (const [path, value] of Object.entries(values as Record<string, unknown>)) {
          if (typeof value === "string" && allowed.has(path)) accepted[path] = value;
        }
        if (Object.keys(accepted).length === 0) continue;
        dictionary = applyPageCopyFields(pageKeyValue, dictionary, accepted);
        written += Object.keys(accepted).length;
      }

      await saveAdminDictionary(localeValue, dictionary);
      await prisma.auditLog.create({
        data: {
          action: "page.copy.publish",
          entity: "PageCopy",
          entityId: "all-pages",
          userId: context.actorId,
          metadata: { locale: localeValue, source: "translation-import" },
        },
      });
    }

    if (written === 0) {
      return { status: "error", message: "Çeviri bulunamadı; JSON `en` altında sayfa anahtarları içermeli." };
    }

    revalidatePath("/manage/pages");
    for (const path of PUBLIC_PATHS) revalidatePath(path);
    return { status: "success", message: `${written} alan çevrildi, kaydedildi ve yayına alındı.` };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Çeviriler kaydedilemedi." };
  }
}
