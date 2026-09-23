"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, CheckCircle2, Info, ChevronLeft, ChevronRight, ExternalLink, FileText, Newspaper, Pencil, RotateCcw, Save } from "lucide-react";
import { MediaField } from "@/components/admin/MediaField";
import { useToast } from "@/components/admin/Toast";
import { card, cn, fieldInput, fieldLabel, fieldTextarea, helpText, primaryButton, secondaryButton } from "@/components/admin/ui";
import type { KadikImage } from "@/lib/kadik-i18n";
import { saveKadikOrganizationAction, saveKadikSeoAction } from "../pages/kadik-actions";
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

/** Site-wide organisation facts behind the schema.org Organization JSON-LD. */
export type SiteSeo = Readonly<{
  organization: Readonly<Record<"name" | "alternateName" | "description" | "foundingDate" | "locality" | "countryCode" | "eventVenue", string>>;
  socials: Readonly<Record<"facebook" | "youtube" | "x" | "linkedin" | "instagram", string>>;
  email: string;
  phone: string;
  /** The Organization JSON-LD as currently published. */
  jsonLd: string;
}>;

const SITE_KEY = "site:organization";

const ORG_FIELDS: readonly Readonly<{ key: keyof SiteSeo["organization"]; label: string; hint?: string; multiline?: boolean }>[] = [
  { key: "name", label: "Kurumun resmi adı" },
  { key: "alternateName", label: "Kısa ad / marka", hint: "Google'ın kurumu tanıması için kullanılan kısa ad (ör. KADİK)." },
  { key: "description", label: "Kurum açıklaması", multiline: true },
  { key: "foundingDate", label: "Kuruluş yılı", hint: "Yıl ya da tarih: 2025 veya 2025-03-01." },
  { key: "locality", label: "Şehir" },
  { key: "countryCode", label: "Ülke kodu", hint: "İki harfli ISO kodu (Birleşik Krallık: GB, Türkiye: TR)." },
  { key: "eventVenue", label: "Etkinliklerin varsayılan yeri", hint: "Takvimdeki etkinlikler Google'a bu yerde gösterilir." },
];

const SOCIAL_FIELDS: readonly Readonly<{ key: keyof SiteSeo["socials"]; label: string }>[] = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X (Twitter)" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
];

type SiteDraft = Readonly<{ organization: SiteSeo["organization"]; socials: SiteSeo["socials"] }>;

const isHttp = (value: string) => /^https?:\/\/\S+\.\S+/i.test(value.trim());

function siteChecks(site: SiteSeo, draft: SiteDraft): readonly Check[] {
  const org = draft.organization;
  return [
    { label: "Resmi ad ve kısa ad dolu", ok: Boolean(org.name.trim() && org.alternateName.trim()) },
    { label: `Kurum açıklaması (${DESCRIPTION_MIN}-${DESCRIPTION_LIMIT * 2} karakter)`, ok: org.description.trim().length >= DESCRIPTION_MIN && org.description.trim().length <= DESCRIPTION_LIMIT * 2 },
    { label: "Kuruluş yılı, şehir ve ülke dolu", ok: Boolean(org.foundingDate.trim() && org.locality.trim() && /^[A-Z]{2}$/.test(org.countryCode.trim())) },
    { label: "E-posta ve telefon (İletişim sayfasından)", ok: Boolean(site.email.trim() && site.phone.trim()) },
    { label: "Sosyal medya hesabı (önerilir, zorunlu değil)", ok: Object.values(draft.socials).some(isHttp), optional: true },
  ];
}

function SiteDetail({ site, draft, saved, onChange, onSaved }: { site: SiteSeo; draft: SiteDraft; saved: SiteDraft; onChange: (draft: SiteDraft) => void; onSaved: (draft: SiteDraft) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const badSocial = SOCIAL_FIELDS.filter(({ key }) => {
    const value = draft.socials[key].trim();
    return value !== "" && !value.startsWith("#") && !isHttp(value);
  });

  const save = () =>
    startTransition(async () => {
      const result = await saveKadikOrganizationAction({ ...draft.organization }, { ...draft.socials });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        onSaved(draft);
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <div className={cn(card, "p-5")}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">Site geneli</p>
        <h2 className="mt-1 text-lg font-bold text-brand-text">Kurum bilgileri ve yapılandırılmış veri</h2>
        <p className={cn(helpText, "mt-1 max-w-2xl")}>
          Google, sitedeki her sayfada bu bilgileri schema.org JSON-LD olarak okur (Organization, WebSite, sayfa, breadcrumb, etkinlik, kurul üyesi ve haber verisi otomatik üretilir).
          E-posta ve telefon İletişim sayfasından gelir.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className={cn(card, "space-y-5 p-5")}>
          <div className="grid gap-4 md:grid-cols-2">
            {ORG_FIELDS.map((field) => (
              <div key={field.key} className={field.multiline ? "md:col-span-2" : undefined}>
                <label className={fieldLabel} htmlFor={`org-${field.key}`}>
                  {field.label}
                </label>
                {field.multiline ? (
                  <textarea
                    id={`org-${field.key}`}
                    className={fieldTextarea}
                    rows={3}
                    value={draft.organization[field.key]}
                    onChange={(event) => onChange({ ...draft, organization: { ...draft.organization, [field.key]: event.target.value } })}
                  />
                ) : (
                  <input
                    id={`org-${field.key}`}
                    className={fieldInput}
                    value={draft.organization[field.key]}
                    onChange={(event) => onChange({ ...draft, organization: { ...draft.organization, [field.key]: event.target.value } })}
                  />
                )}
                {field.hint ? <p className={cn(helpText, "mt-1")}>{field.hint}</p> : null}
              </div>
            ))}
          </div>

          <div className="border-t border-brand-border pt-4">
            <p className={fieldLabel}>Resmi sosyal medya hesapları</p>
            <p className={cn(helpText, "mt-1")}>{"Footer'da görünür ve Google'a kurumun hesapları olarak bildirilir (sameAs). Boş bırakılan gösterilmez."}</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {SOCIAL_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className={fieldLabel} htmlFor={`social-${field.key}`}>
                    {field.label}
                  </label>
                  <input
                    id={`social-${field.key}`}
                    className={fieldInput}
                    inputMode="url"
                    placeholder="https://"
                    value={draft.socials[field.key].startsWith("#") ? "" : draft.socials[field.key]}
                    onChange={(event) => onChange({ ...draft, socials: { ...draft.socials, [field.key]: event.target.value } })}
                  />
                </div>
              ))}
            </div>
            {badSocial.length ? (
              <p className="mt-2 text-xs font-semibold text-brand-danger">
                Geçerli bir adres girin (https:// ile başlamalı): {badSocial.map((field) => field.label).join(", ")}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-brand-border pt-4">
            {dirty ? <span className="mr-auto text-xs font-bold text-brand-warning">Kaydedilmemiş değişiklik var</span> : null}
            {dirty ? (
              <button type="button" className={secondaryButton} onClick={() => onChange(saved)} disabled={pending}>
                Vazgeç
              </button>
            ) : null}
            <button type="button" className={primaryButton} onClick={save} disabled={pending || !dirty || badSocial.length > 0}>
              <Save className="size-3.5" aria-hidden="true" />
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className={cn(card, "p-4")}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-muted">Kontrol listesi</p>
            <ul className="space-y-1.5 text-sm">
              {siteChecks(site, draft).map((check) => (
                <li key={check.label} className="flex items-center gap-2">
                  {check.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-brand-success" aria-hidden="true" />
                  ) : check.optional ? (
                    <Info className="size-4 shrink-0 text-brand-muted" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-brand-warning" aria-hidden="true" />
                  )}
                  <span className={check.ok ? "text-brand-text" : "text-brand-muted"}>{check.label}</span>
                </li>
              ))}
            </ul>
            {!site.email.trim() || !site.phone.trim() ? (
              <Link href="/manage/pages/contact" className="mt-2 inline-block text-xs font-semibold text-brand-primary hover:underline">
                İletişim bilgilerini düzenle
              </Link>
            ) : null}
          </div>
          <div className={cn(card, "p-4")}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-muted">Yayındaki JSON-LD (Organization)</p>
            <pre className="max-h-[420px] overflow-auto rounded-[var(--radius-sm)] bg-brand-invert p-3 font-mono text-[11px] leading-5 text-brand-on-invert">{site.jsonLd}</pre>
            <p className={cn(helpText, "mt-2")}>Kaydettikten sonra güncellenir.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const TITLE_MIN = 20;
const TITLE_LIMIT = 60;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_LIMIT = 160;
const SITE_HOST = "kadiklondon.org";

const keyOf = (entry: SeoEntry) => `${entry.kind}:${entry.id}`;
const draftOf = (entry: SeoEntry): Draft => ({ title: entry.title, description: entry.description, image: entry.image });

/** `optional` checks are recommendations: shown, but never block the ✓. */
type Check = Readonly<{ label: string; ok: boolean; optional?: boolean }>;

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
  site,
  pages,
  posts,
  initialItem,
}: {
  site: SiteSeo;
  pages: readonly SeoEntry[];
  posts: readonly SeoEntry[];
  initialItem: string | null;
}) {
  const all = useMemo(() => [...pages, ...posts], [pages, posts]);
  const [selectedKey, setSelectedKey] = useState(() =>
    initialItem === SITE_KEY || (initialItem && all.some((entry) => keyOf(entry) === initialItem))
      ? initialItem
      : all[0]
        ? keyOf(all[0])
        : SITE_KEY,
  );
  const initialSite: SiteDraft = { organization: site.organization, socials: site.socials };
  const [siteSaved, setSiteSaved] = useState<SiteDraft>(initialSite);
  const [siteDraft, setSiteDraft] = useState<SiteDraft>(initialSite);
  const siteDirty = JSON.stringify(siteDraft) !== JSON.stringify(siteSaved);
  const siteComplete = siteChecks(site, siteDraft).every((check) => check.ok || check.optional);
  const [saved, setSaved] = useState<Record<string, Draft>>(() => Object.fromEntries(all.map((entry) => [keyOf(entry), draftOf(entry)])));
  const [drafts, setDrafts] = useState<Record<string, Draft>>(saved);

  const dirtyKeys = useMemo(
    () => new Set(all.map(keyOf).filter((key) => JSON.stringify(drafts[key]) !== JSON.stringify(saved[key]))),
    [all, drafts, saved],
  );

  useEffect(() => {
    if (dirtyKeys.size === 0 && !siteDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyKeys, siteDirty]);

  const selectKey = (key: string) => {
    setSelectedKey(key);
    const url = new URL(window.location.href);
    url.searchParams.set("item", key);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const select = (entry: SeoEntry) => selectKey(keyOf(entry));

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
            onChange={(event) => selectKey(event.target.value)}
          >
            <option value={SITE_KEY}>{siteComplete ? "✓ " : "• "}Kurum bilgileri (site geneli)</option>
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
          <div>
            <p className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
              <Building2 className="size-3.5" aria-hidden="true" />
              Site geneli
            </p>
            <ul>
              <SidebarItem
                entry={{ kind: "page", id: "organization", label: "Kurum bilgileri", path: "/", title: "", description: "", image: { url: "", assetId: null }, defaultTitle: "", defaultDescription: "", defaultImage: { url: "", assetId: null }, editHref: "" }}
                active={selectedKey === SITE_KEY}
                complete={siteComplete}
                dirty={siteDirty}
                onSelect={() => selectKey(SITE_KEY)}
              />
            </ul>
          </div>
          {group("Sayfalar", FileText, pages)}
          {group("Haberler", Newspaper, posts)}
        </nav>
      </aside>

      <div className="min-w-0">
        {selectedKey === SITE_KEY ? (
          <SiteDetail site={site} draft={siteDraft} saved={siteSaved} onChange={setSiteDraft} onSaved={setSiteSaved} />
        ) : current ? (
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
