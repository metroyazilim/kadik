import Link from "next/link";
import { ExternalLink, FileText, LayoutTemplate, Pencil } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { card, cn, helpText, secondaryButton, tableBody, tableCell, tableHeadCell, tableHeadRow, tableRow, table, tableWrap } from "@/components/admin/ui";
import { KADIK_PAGE_DEFINITIONS } from "@/lib/kadik-content/pages";
import { ensureKadikPagesSeeded, listKadikPageSummaries } from "@/lib/kadik-content/store";

/**
 * The single entry point for every KADİK public page - home included. Each
 * row opens the page's own editor route (`/manage/pages/<key>`).
 */
export default async function PagesPage() {
  // First visit after the migration moves the shipped copy into the database.
  await ensureKadikPagesSeeded().catch((error: unknown) => console.error("KADIK page seed failed", error));
  const summaries = await listKadikPageSummaries();
  const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Site İçeriği"
        title="Sayfalar"
        description="Sitedeki her sayfanın yazıları, görselleri ve SEO bilgileri buradan düzenlenir. Kaydettiğiniz değişiklik hemen yayına girer."
      />

      <div className={tableWrap}>
        <table className={table}>
          <thead>
            <tr className={tableHeadRow}>
              <th className={tableHeadCell}>Sayfa</th>
              <th className={cn(tableHeadCell, "hidden md:table-cell")}>Adres</th>
              <th className={cn(tableHeadCell, "hidden lg:table-cell")}>Son güncelleme</th>
              <th className={cn(tableHeadCell, "text-end")}>
                <span className="sr-only">İşlemler</span>
              </th>
            </tr>
          </thead>
          <tbody className={tableBody}>
            {summaries.map(({ key, updatedAt }) => {
              const definition = KADIK_PAGE_DEFINITIONS[key];
              const Icon = definition.publicPath ? FileText : LayoutTemplate;
              return (
                <tr key={key} className={tableRow}>
                  <td className={tableCell}>
                    <Link href={`/manage/pages/${key}`} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-primary/10 text-brand-primary">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-brand-text">{definition.label}</span>
                        <span className={cn(helpText, "block")}>{definition.description}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={cn(tableCell, "hidden font-mono text-xs text-brand-muted md:table-cell")}>
                    {definition.publicPath ?? "Tüm sayfalar"}
                  </td>
                  <td className={cn(tableCell, "hidden text-xs text-brand-muted lg:table-cell")}>
                    {updatedAt ? dateFormat.format(updatedAt) : "-"}
                  </td>
                  <td className={cn(tableCell, "text-end")}>
                    <div className="flex justify-end gap-2">
                      {definition.publicPath ? (
                        <a
                          href={definition.publicPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(secondaryButton, "hidden sm:inline-flex")}
                          aria-label={`${definition.label} sayfasını yeni sekmede aç`}
                        >
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      ) : null}
                      <Link href={`/manage/pages/${key}`} className={secondaryButton}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Düzenle
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={cn(card, "p-5 text-sm text-brand-muted")}>
        {"Kurul üyeleri ve haberler kendi ekranlarından yönetilir:"}{" "}
        <Link className="font-semibold text-brand-primary hover:underline" href="/manage/team">
          Kurul Üyeleri
        </Link>
        {" · "}
        <Link className="font-semibold text-brand-primary hover:underline" href="/manage/posts">
          Yayınlar ve Haberler
        </Link>
      </div>
    </div>
  );
}
