import { notFound } from "next/navigation";
import type { ContentLocale } from "@prisma/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { getAdminDictionary } from "@/lib/content";
import type { Dictionary } from "@/lib/i18n/types";
import {
  isPageCopyKey,
  PAGE_COPY_DEFINITIONS,
} from "@/lib/page-copy-registry";
import { getAboutEditViewAction } from "../../actions";
import { AboutEditorPanel } from "../../AboutEditorPanel";
import { PageCopyEditor } from "../../PageCopyEditor";

const LOCALES = ["tr", "en"] as const satisfies readonly ContentLocale[];

export default async function PageCopyEditorPage({
  params,
}: {
  params: Promise<{ pageKey: string }>;
}) {
  const { pageKey } = await params;
  if (!isPageCopyKey(pageKey) || pageKey === "home") notFound();
  const dictionaries = Object.fromEntries(
    await Promise.all(
      LOCALES.map(async (locale) => [locale, await getAdminDictionary(locale)] as const),
    ),
  ) as Record<ContentLocale, Dictionary>;
  const aboutData = pageKey === "about" ? await getAboutEditViewAction() : null;
  const definition = PAGE_COPY_DEFINITIONS[pageKey];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Sayfa İçeriği"
        title={definition.label}
        description="Component ve sayfa düzeni kodda sabittir. Buradan yalnızca ziyaretçinin gördüğü metinleri düzenleyin."
        backHref="/manage/pages"
        backLabel="Sayfalara dön"
      />
      <PageCopyEditor pageKey={pageKey} dictionaries={dictionaries} />
      {aboutData ? <AboutEditorPanel data={aboutData} /> : null}
    </div>
  );
}
