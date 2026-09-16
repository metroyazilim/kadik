import Link from "next/link";
import { card, cn, sectionTitle, secondaryButton } from "@/components/admin/ui";
import {
  PAGE_COPY_DEFINITIONS,
  PAGE_COPY_KEYS,
} from "@/lib/page-copy-registry";
import { AllPagesTranslation } from "./AllPagesTranslation";

const HOME_KEY = "home";

/** Every public page with editable fixed copy or collection/settings ownership. */
export async function PagesPanel() {

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-brand-text">Tüm sayfa metinleri</p>
          <p className="mt-1 text-xs leading-5 text-brand-muted">
            Çeviri tek seferde bütün sayfaları kapsar; sonuç kaydedilip yayına alınır.
          </p>
        </div>
        <AllPagesTranslation />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {PAGE_COPY_KEYS.filter((key) => PAGE_COPY_DEFINITIONS[key].group === "page").map((key) => {
        const definition = PAGE_COPY_DEFINITIONS[key];
        return (
          <div key={key} className={cn(card, "flex flex-col justify-between gap-4 p-5")}>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                {definition.publicPath}
              </span>
              <h2 className={sectionTitle}>{definition.label}</h2>
              <p className="text-xs leading-5 text-brand-muted">{definition.description}</p>
            </div>
            <Link
              href={key === HOME_KEY ? "/manage/home" : `/manage/pages/copy/${key}`}
              className={secondaryButton}
            >
              Görüntüle ve düzenle
            </Link>
          </div>
        );
      })}
      </div>
    </div>
  );
}
