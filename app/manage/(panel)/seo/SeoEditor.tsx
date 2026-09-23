"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, FileText, Newspaper, Pencil, RotateCcw, Save } from "lucide-react";
import { MediaField } from "@/components/admin/MediaField";
import { useToast } from "@/components/admin/Toast";
import { card, cn, fieldInput, fieldLabel, fieldTextarea, helpText, primaryButton, secondaryButton } from "@/components/admin/ui";
import type { KadikImage } from "@/lib/kadik-i18n";
import { saveKadikSeoAction } from "../pages/kadik-actions";
import { savePostSeoAction } from "../posts/actions";

export type SeoEntry = Readonly<{
  kind: "page" | "post";
  id: string;
  label: string;
  path: string;
  title: string;
  description: string;
  image: KadikImage;
  /** What the site uses when a field is left empty. */
  defaultTitle: string;
  defaultDescription: string;
  defaultImage: KadikImage;
  editHref: string;
}>;

type Draft = Readonly<{ title: string; description: string; image: KadikImage }>;

const TITLE_MIN = 20;
const TITLE_LIMIT = 60;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_LIMIT = 160;
const SITE_HOST = "kadiklondon.org";

const keyOf = (entry: SeoEntry) => `${entry.kind}:${entry.id}`;
const draftOf = (entry: SeoEntry): Draft => ({ title: entry.title, description: entry.description, image: entry.image });

type Check = Readonly<{ label: string; ok: boolean }>;

/** The checklist behind the ✓ in the sidebar: every item filled in and within Google's display limits. */
function checksFor(entry: SeoEntry, draft: Draft): readonly Check[] {
  const title = draft.title.trim();
  const description = draft.description.trim();
  const checks: Check[] = [
    { label: `Başlık dolu (${TITLE_MIN}-${TITLE_LIMIT} karakter)`, ok: title.length >= TITLE_MIN && title.length <= TITLE_LIMIT },
    { label: `Açıklama dolu (${DESCRIPTION_MIN}-${DESCRIPTION_LIMIT} karakter)`, ok: description.length >= DESCRIPTION_MIN && description.length <= DESCRIPTION_LIMIT },
  ];
  checks.push(
    entry.kind === "page"
      ? { label: "Paylaşım görseli seçili", ok: Boolean(draft.image.url) }
      : { label: "Kapak görseli var (paylaşım görseli)", ok: Boolean(draft.image.url) },
  );
  return checks;
}

const isComplete = (entry: SeoEntry, draft: Draft) => checksFor(entry, draft).every((check) => check.ok);

function Counter({ value, min, limit }: { value: number; min: number; limit: number }) {
  const tone = value > limit ? "text-brand-danger" : value >= min ? "text-brand-success" : "text-brand-muted";
  return <span className={cn("font-normal normal-case tracking-normal", tone)}>{value}/{limit}</span>;
}

function SidebarItem({
  entry,
  active,
  complete,
  dirty,
  onSelect,
}: {
  entry: SeoEntry;
  active: boolean;
  complete: boolean;
  dirty: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm transition-colors",
          active ? "bg-brand-primary/10 font-semibold text-brand-text" : "text-brand-muted hover:bg-brand-muted-surface hover:text-brand-text",
        )}
      >
        {complete ? (
          <CheckCircle2 className="size-4 shrink-0 text-brand-success" aria-label="Tamamlandı" />
        ) : (
          <AlertCircle className="size-4 shrink-0 text-brand-warning" aria-label="Eksik" />
        )}
        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
        {dirty ? <span className="size-2 shrink-0 rounded-full bg-brand-warning" title="Kaydedilmemiş değişiklik" aria-label="Kaydedilmemiş" /> : null}
      </button>
    </li>
  );
}

function SeoDetail({
  entry,
  draft,
  saved,
  onChange,
  onSaved,
  previous,
  next,
  onNavigate,
}: {
  entry: SeoEntry;
  draft: Draft;
  saved: Draft;
  onChange: (draft: Draft) => void;
  onSaved: (draft: Draft) => void;
  previous: SeoEntry | null;
  next: SeoEntry | null;
  onNavigate: (entry: SeoEntry) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const isPage = entry.kind === "page";
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const shownTitle = draft.title.trim() || entry.defaultTitle;
  const shownDescription = draft.description.trim() || entry.defaultDescription;
  const shownImage = draft.image.url || entry.defaultImage.url;
  const checks = checksFor(entry, draft);
  const isDefault =
    draft.title === entry.defaultTitle && draft.description === entry.defaultDescription && draft.image.url === entry.defaultImage.url;

  const save = () =>
    startTransition(async () => {
      const result = isPage
        ? await saveKadikSeoAction(entry.id, draft)
        : await savePostSeoAction(entry.id, { title: draft.title, description: draft.description });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        onSaved(draft);
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <div className={cn(card, "flex flex-wrap items-start justify-between gap-3 p-5")}>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">{isPage ? "Sayfa" : "Haber"}</p>
          <h2 className="mt-1 text-lg font-bold text-brand-text">{entry.label}</h2>
          <p className="font-mono text-xs text-brand-muted">{entry.path}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={entry.path} target="_blank" rel="noopener noreferrer" className={secondaryButton} aria-label={`${entry.label} sayfasını yeni sekmede aç`}>
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Sitede gör
          </a>
          <Link href={entry.editHref} className={secondaryButton}>
            <Pencil className="size-3.5" aria-hidden="true" />
            {isPage ? "Sayfa içeriği" : "Haberi düzenle"}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className={cn(card, "space-y-5 p-5")}>
          <div>
            <label className={cn(fieldLabel, "flex justify-between")} htmlFor="seo-title">
              Başlık (title) <Counter value={draft.title.length} min={TITLE_MIN} limit={TITLE_LIMIT} />
            </label>
            <input
              id="seo-title"
              className={fieldInput}
              value={draft.title}
              placeholder={entry.defaultTitle}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
            />
            <p className={cn(helpText, "mt-1")}>Tarayıcı sekmesinde ve Google sonucunun mavi satırında görünür. Anahtar kelime başa, marka sona.</p>
          </div>

          <div>
            <label className={cn(fieldLabel, "flex justify-between")} htmlFor="seo-description">
              Açıklama (meta description) <Counter value={draft.description.length} min={DESCRIPTION_MIN} limit={DESCRIPTION_LIMIT} />
            </label>
            <textarea
              id="seo-description"
              className={fieldTextarea}
              rows={4}
              value={draft.description}
              placeholder={entry.defaultDescription || "Sayfayı 1-2 cümlede anlatın."}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
            />
            <p className={cn(helpText, "mt-1")}>Google sonucunun altındaki gri metin. Sayfada ne bulunacağını ve neden tıklanacağını söyleyin.</p>
          </div>

          {isPage ? (
            <div>
              <MediaField
                label="Paylaşım görseli (Facebook, LinkedIn, WhatsApp, X)"
                value={draft.image.url}
                assetId={draft.image.assetId ?? undefined}
                contextLabel={entry.label}
                onChange={(payload) => onChange({ ...draft, image: { url: payload.url, assetId: payload.assetId ?? null } })}
                description="Önerilen boyut 1200×630. Boş bırakılırsa sitenin varsayılan görseli kullanılır."
              />
            </div>
          ) : (
            <div className="rounded-[var(--radius-sm)] border border-brand-border bg-brand-page p-3 text-xs text-brand-muted">
              Haberlerde paylaşım görseli olarak haberin kapak görseli kullanılır.{" "}
              <Link href={entry.editHref} className="font-semibold text-brand-primary hover:underline">
                Kapak görselini değiştir
              </Link>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-brand-border pt-4">
            {dirty ? <span className="mr-auto text-xs font-bold text-brand-warning">Kaydedilmemiş değişiklik var</span> : null}
            {dirty ? (
              <button type="button" className={secondaryButton} onClick={() => onChange(saved)} disabled={pending}>
                Vazgeç
              </button>
            ) : null}
            {isPage && !isDefault ? (
              <button
                type="button"
                className={secondaryButton}
                onClick={() => onChange({ title: entry.defaultTitle, description: entry.defaultDescription, image: entry.defaultImage })}
                disabled={pending}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Önerilen metin
              </button>
            ) : null}
            <button type="button" className={primaryButton} onClick={save} disabled={pending || !dirty}>
              <Save className="size-3.5" aria-hidden="true" />
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className={cn(card, "p-4")} aria-label="Google önizlemesi">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-muted">Google önizlemesi</p>
            <p className="truncate text-xs text-brand-muted">
              {SITE_HOST}
              {entry.path === "/" ? "" : ` › ${entry.path.replace(/^\//, "").split("/").join(" › ")}`}
            </p>
            <p className="mt-1 line-clamp-2 text-base leading-snug text-brand-primary">{shownTitle}</p>
            <p className="mt-1 line-clamp-3 text-sm text-brand-muted">{shownDescription || "Açıklama yok - Google sayfadan kendisi bir metin seçer."}</p>
          </div>

          <div className={cn(card, "overflow-hidden")} aria-label="Sosyal medya önizlemesi">
            <p className="px-4 pt-4 text-[10px] font-bold uppercase tracking-widest text-brand-muted">Paylaşım önizlemesi</p>
            <div className="m-4 overflow-hidden rounded-[var(--radius-sm)] border border-brand-border">
              {shownImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownImage} alt="" className="aspect-[1200/630] w-full object-cover" />
              ) : (
                <div className="flex aspect-[1200/630] items-center justify-center bg-brand-page text-xs text-brand-muted">Görsel yok</div>
              )}
              <div className="space-y-0.5 bg-brand-page p-3">
                <p className="text-[11px] uppercase text-brand-muted">{SITE_HOST}</p>
                <p className="line-clamp-2 text-sm font-semibold text-brand-text">{shownTitle}</p>
                <p className="line-clamp-2 text-xs text-brand-muted">{shownDescription}</p>
              </div>
            </div>
          </div>

          <div className={cn(card, "p-4")}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-muted">Kontrol listesi</p>
            <ul className="space-y-1.5 text-sm">
              {checks.map((check) => (
                <li key={check.label} className="flex items-center gap-2">
                  {check.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-brand-success" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-brand-warning" aria-hidden="true" />
                  )}
                  <span className={check.ok ? "text-brand-text" : "text-brand-muted"}>{check.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-2">
        {previous ? (
          <button type="button" className={secondaryButton} onClick={() => onNavigate(previous)}>
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            {previous.label}
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button type="button" className={secondaryButton} onClick={() => onNavigate(next)}>
            {next.label}
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Two-pane SEO workspace: its own item sidebar (pages, then news) with a ✓
 * for every entry whose checklist is complete, and the selected entry's
 * editor on the right. Drafts are kept per entry, so switching items never
 * loses typing; unsaved entries carry a dot.
 */
export function SeoWorkspace({
  pages,
  posts,
  initialItem,
}: {
  pages: readonly SeoEntry[];
  posts: readonly SeoEntry[];
  initialItem: string | null;
}) {
  const all = useMemo(() => [...pages, ...posts], [pages, posts]);
  const [selectedKey, setSelectedKey] = useState(() =>
    initialItem && all.some((entry) => keyOf(entry) === initialItem) ? initialItem : all[0] ? keyOf(all[0]) : "",
  );
  const [saved, setSaved] = useState<Record<string, Draft>>(() => Object.fromEntries(all.map((entry) => [keyOf(entry), draftOf(entry)])));
  const [drafts, setDrafts] = useState<Record<string, Draft>>(saved);

  const dirtyKeys = useMemo(
    () => new Set(all.map(keyOf).filter((key) => JSON.stringify(drafts[key]) !== JSON.stringify(saved[key]))),
    [all, drafts, saved],
  );

  useEffect(() => {
    if (dirtyKeys.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyKeys]);

  const select = (entry: SeoEntry) => {
    const key = keyOf(entry);
    setSelectedKey(key);
    const url = new URL(window.location.href);
    url.searchParams.set("item", key);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const index = all.findIndex((entry) => keyOf(entry) === selectedKey);
  const current = index >= 0 ? all[index] : null;
  const completeCount = (list: readonly SeoEntry[]) => list.filter((entry) => isComplete(entry, drafts[keyOf(entry)] ?? draftOf(entry))).length;

  const group = (title: string, Icon: typeof FileText, list: readonly SeoEntry[]) => (
    <div>
      <p className="flex items-center justify-between px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5" aria-hidden="true" />
          {title}
        </span>
        <span>
          {completeCount(list)}/{list.length}
        </span>
      </p>
      {list.length === 0 ? <p className="px-2.5 text-xs text-brand-muted">Kayıt yok.</p> : null}
      <ul className="space-y-0.5">
        {list.map((entry) => {
          const key = keyOf(entry);
          return (
            <SidebarItem
              key={key}
              entry={entry}
              active={key === selectedKey}
              complete={isComplete(entry, drafts[key] ?? draftOf(entry))}
              dirty={dirtyKeys.has(key)}
              onSelect={() => select(entry)}
            />
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside aria-label="SEO kayıtları" className="lg:sticky lg:top-[72px] lg:self-start">
        <label className="mb-3 block lg:hidden">
          <span className="sr-only">Düzenlenecek kayıt</span>
          <select
            className={fieldInput}
            value={selectedKey}
            onChange={(event) => {
              const entry = all.find((candidate) => keyOf(candidate) === event.target.value);
              if (entry) select(entry);
            }}
          >
            <optgroup label="Sayfalar">
              {pages.map((entry) => (
                <option key={keyOf(entry)} value={keyOf(entry)}>
                  {isComplete(entry, drafts[keyOf(entry)] ?? draftOf(entry)) ? "✓ " : "• "}
                  {entry.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Haberler">
              {posts.map((entry) => (
                <option key={keyOf(entry)} value={keyOf(entry)}>
                  {isComplete(entry, drafts[keyOf(entry)] ?? draftOf(entry)) ? "✓ " : "• "}
                  {entry.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <nav className={cn(card, "hidden max-h-[calc(100vh-110px)] space-y-4 overflow-y-auto p-3 lg:block")}>
          {group("Sayfalar", FileText, pages)}
          {group("Haberler", Newspaper, posts)}
        </nav>
      </aside>

      <div className="min-w-0">
        {current ? (
          <SeoDetail
            key={selectedKey}
            entry={current}
            draft={drafts[selectedKey] ?? draftOf(current)}
            saved={saved[selectedKey] ?? draftOf(current)}
            onChange={(draft) => setDrafts((all) => ({ ...all, [selectedKey]: draft }))}
            onSaved={(draft) => setSaved((all) => ({ ...all, [selectedKey]: draft }))}
            previous={index > 0 ? all[index - 1] : null}
            next={index < all.length - 1 ? all[index + 1] : null}
            onNavigate={select}
          />
        ) : (
          <p className="text-sm text-brand-muted">Düzenlenecek kayıt yok.</p>
        )}
      </div>
    </div>
  );
}
