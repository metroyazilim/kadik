import Link from "next/link";
import { card, cn, secondaryButton, sectionTitle } from "@/components/admin/ui";
import { PAGE_COPY_DEFINITIONS, PAGE_COPY_KEYS } from "@/lib/page-copy-registry";

/**
 * Collection index pages (hizmetler, ürünler, projeler, blog, SSS), the legal
 * texts and the shared site shell are not standalone pages an editor "adds":
 * their copy belongs to the settings centre. `/manage/pages` therefore lists
 * only real pages, and these live here.
 */
export function SettingsOwnedCopy() {
  const keys = PAGE_COPY_KEYS.filter((key) => PAGE_COPY_DEFINITIONS[key].group === "settings");

  return (
    <section className="space-y-3">
      <div>
        <h2 className={sectionTitle}>Liste ve yasal sayfa metinleri</h2>
        <p className="mt-1 text-xs leading-5 text-brand-muted">
          Hizmet, ürün, proje, blog, SSS liste sayfaları ile yasal metinlerin sabit yazıları burada yönetilir.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {keys.map((key) => {
          const definition = PAGE_COPY_DEFINITIONS[key];
          return (
            <div key={key} className={cn(card, "flex flex-col justify-between gap-3 p-4")}>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                  {definition.publicPath}
                </span>
                <p className="text-sm font-semibold text-brand-text">{definition.label}</p>
                <p className="text-xs leading-5 text-brand-muted">{definition.description}</p>
              </div>
              <Link href={`/manage/pages/copy/${key}`} className={secondaryButton}>
                Metinleri düzenle
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
