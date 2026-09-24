"use client";

import { FormEvent, createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KadikMotion } from "./KadikMotion";
import GoogleTranslateWidget from "./GoogleTranslateWidget";
import type { PublicTeamMemberListItem } from "@/lib/public-content/team";
import type { KadikAnnouncementView, KadikEventView, KadikGalleryItemView } from "@/lib/kadik-content/collection-types";
import {
  KADIK_DICT,
  KADIK_PATHS,
  kadikPostPath,
  type KadikDictionary,
  type KadikLocale,
  type KadikPageKey,
} from "@/lib/kadik-i18n";

const ASSET_ROOT = "/kadik";
const BRAND_SHORT = "KADİK";

/** BCP 47 tag for `Date#toLocaleDateString`/string comparison helpers. */
const DATE_LOCALE: Record<KadikLocale, string> = { en: "en-GB" };

/**
 * Every exported page component is provided at its root, so `Header`,
 * `Footer`, `Banner` and `Shell` never need `locale` or `active` threaded
 * through as props - they read this instead.
 */
const KadikPageContext = createContext<{ locale: KadikLocale; active: KadikPageKey; dict: KadikDictionary }>({
  locale: "en",
  active: "home",
  dict: KADIK_DICT.en,
});

function useKadikPage() {
  return useContext(KadikPageContext);
}

function useKadikDict(): KadikDictionary {
  return useKadikPage().dict;
}

/** Every exported page receives the admin-managed dictionary (`lib/kadik-content`)
 * from its server route; `KADIK_DICT` is only the factory fallback. */
type KadikPageProps = { locale: KadikLocale; dict?: KadikDictionary };

function KadikPage({ locale, active, dict, children }: { locale: KadikLocale; active: KadikPageKey; dict: KadikDictionary; children: React.ReactNode }) {
  return <KadikPageContext.Provider value={{ locale, active, dict }}>{children}</KadikPageContext.Provider>;
}

/** Yönetim panelinde yazılıp yayınlanan `post` kayıtlarının public projeksiyonu.
 * Sunucu sayfaları `lib/public-content/post.ts` çıktısını bu istemci-güvenli
 * şekle indirger; bu bileşen hiçbir zaman asset id'si veya Prisma tipi görmez. */
export type KadikPostListItem = Readonly<{
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  dateLabel: string;
  image: string;
}>;

export type KadikArticleBlock =
  | { type: "text"; html: string }
  | { type: "image"; url: string; caption: string | null }
  | { type: "kpi"; heading: string | null; items: readonly { label: string; value: string }[] }
  | { type: "banner"; heading: string; text: string; ctaLabel: string | null; ctaUrl: string | null }
  | { type: "quote"; text: string; author: string | null };

export type KadikPostDetailData = KadikPostListItem & Readonly<{ author: string; blocks: readonly KadikArticleBlock[] }>;

function Button({ href = "#", children, tone = "blue" }: { href?: string; children: React.ReactNode; tone?: "blue" | "red" | "light" }) {
  return <Link className={`kadik-button kadik-button-${tone}`} href={href}>{children}<span aria-hidden="true">↗</span></Link>;
}

function ContactForm() {
  const { locale } = useKadikPage();
  const t = useKadikDict().contactForm;
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/kadik/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: form.get("name") || t.defaultName, email: form.get("email"), phone: form.get("phone"), subject: form.get("subject"), message: form.get("message") || t.defaultMessage, consent: form.get("consent") === "on", locale,
      }) });
      setStatus(response.ok ? t.success : t.error);
      if (response.ok) formElement.reset();
    } catch { setStatus(t.error); }
    setBusy(false);
  }
  return <form className="kadik-form" onSubmit={submit}>
    <div className="kadik-form-grid"><input required name="name" placeholder={t.namePlaceholder} /><input required type="email" name="email" placeholder={t.emailPlaceholder} /></div>
    <input name="subject" placeholder={t.subjectPlaceholder} />
    <textarea required name="message" rows={5} placeholder={t.messagePlaceholder} />
    <label className="kadik-consent"><input required type="checkbox" name="consent" /> <span>{t.consent}</span></label>
    <button className="kadik-button kadik-button-red" disabled={busy}>{busy ? t.submitting : t.submit}<span aria-hidden="true">↗</span></button>
    {status && <p className="kadik-form-status" role="status">{status}</p>}
  </form>;
}

/** Membership application form: company/sector information is collected via
 * free-text fields (the campaign-era "how would you like to contribute"
 * dropdown has been removed). Fields are compiled into a single application
 * body without breaking the `/api/kadik/contact` contract; the subject line
 * makes the application distinguishable in the message list. */
function MembershipForm() {
  const { locale } = useKadikPage();
  const t = useKadikDict().membershipForm;
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const company = value("company");
    const details = ([
      [t.fieldLabels.company, company],
      [t.fieldLabels.position, value("position")],
      [t.fieldLabels.sector, value("sector")],
      [t.fieldLabels.city, value("city")],
      [t.fieldLabels.website, value("website")],
      [t.fieldLabels.reference, value("reference")],
    ] as const).filter(([, field]) => field.length > 0).map(([label, field]) => `${label}: ${field}`);
    const message = [value("message"), details.length > 0 ? "" : null, ...details].filter((line) => line !== null).join("\n").trim();
    try {
      const response = await fetch("/api/kadik/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: value("name"), email: value("email"), phone: value("phone"),
        subject: company ? `${t.subjectFallback}: ${company}` : t.subjectFallback,
        message, consent: form.get("consent") === "on", locale,
      }) });
      setStatus(response.ok ? t.success : t.error);
      if (response.ok) formElement.reset();
    } catch { setStatus(t.error); }
    setBusy(false);
  }
  return <form className="kadik-form" onSubmit={submit} aria-label={t.ariaLabel}>
    <div className="kadik-form-grid">
      <label className="kadik-field"><span>{t.name}</span><input required name="name" autoComplete="name" placeholder={t.namePlaceholder} /></label>
      <label className="kadik-field"><span>{t.email}</span><input required type="email" name="email" autoComplete="email" placeholder="name@company.com" /></label>
    </div>
    <div className="kadik-form-grid">
      <label className="kadik-field"><span>{t.phone}</span><input required name="phone" inputMode="tel" autoComplete="tel" placeholder={t.phonePlaceholder} /></label>
      <label className="kadik-field"><span>{t.company}</span><input required name="company" autoComplete="organization" placeholder={t.companyPlaceholder} /></label>
    </div>
    <div className="kadik-form-grid">
      <label className="kadik-field"><span>{t.position}</span><input required name="position" autoComplete="organization-title" placeholder={t.positionPlaceholder} /></label>
      <label className="kadik-field"><span>{t.sector}</span><input required name="sector" placeholder={t.sectorPlaceholder} /></label>
    </div>
    <div className="kadik-form-grid">
      <label className="kadik-field"><span>{t.city}</span><input name="city" autoComplete="address-level2" placeholder={t.cityPlaceholder} /></label>
      <label className="kadik-field"><span>{t.website}</span><input name="website" inputMode="url" placeholder={t.websitePlaceholder} /></label>
    </div>
    <label className="kadik-field"><span>{t.reference}</span><input name="reference" placeholder={t.referencePlaceholder} /></label>
    <label className="kadik-field"><span>{t.note}</span><textarea required name="message" rows={5} placeholder={t.notePlaceholder} /></label>
    <label className="kadik-consent"><input required type="checkbox" name="consent" /> <span>{t.consent}</span></label>
    <button className="kadik-button kadik-button-red" disabled={busy}>{busy ? t.submitting : t.submit}<span aria-hidden="true">↗</span></button>
    {status && <p className="kadik-form-status" role="status">{status}</p>}
  </form>;
}

function useNavItems() {
  const { locale } = useKadikPage();
  const t = useKadikDict();
  const p = (key: KadikPageKey) => KADIK_PATHS[key][locale];
  return [
    { label: t.nav.home, href: p("home"), key: "home" as const },
    {
      label: t.nav.corporate,
      href: p("about"),
      key: "about" as const,
      children: [
        { label: t.nav.about, href: p("about") },
        { label: t.nav.board, href: p("board") },
        { label: t.nav.contact, href: p("contact") },
      ],
    },
    {
      label: t.nav.activities,
      href: p("events"),
      key: "events" as const,
      children: [
        { label: t.nav.events, href: p("events") },
        { label: t.nav.announcements, href: p("issues") },
        { label: t.nav.news, href: p("posts") },
      ],
    },
    { label: t.nav.membership, href: p("membership"), key: "membership" as const },
    { label: t.nav.news, href: p("posts"), key: "posts" as const },
    { label: t.nav.gallery, href: p("gallery"), key: "gallery" as const },
  ];
}


function Header() {
  const { locale, active } = useKadikPage();
  const t = useKadikDict();
  const navItems = useNavItems();
  const [open, setOpen] = useState(false);
  const isCorporatePage = active === "about" || active === "board" || active === "contact";
  const isActivityPage = active === "events" || active === "issues" || active === "posts";
  return <header className="kadik-header">
    <div className="kadik-header-inner">
      <Link href={KADIK_PATHS.home[locale]} className="kadik-logo" aria-label={`${t.brandFull}`}>
        <img src={`${ASSET_ROOT}/kadik-logo.png`} alt="" />
        <span className="kadik-brand-lockup"><strong>{BRAND_SHORT}</strong><small>{t.brandFull}</small></span>
      </Link>
      <nav className="kadik-nav" aria-label={t.nav.mainMenu}>{navItems.map((item) => <div className="kadik-nav-item" key={item.href}>
        <Link className={active === item.key || (item.key === "about" && isCorporatePage) || (item.key === "events" && isActivityPage) ? "is-active" : ""} href={item.href}>{item.label}</Link>
        {item.children && <div className="kadik-dropdown">{item.children.map((child) => <Link key={child.href} href={child.href}>{child.label}</Link>)}</div>}
      </div>)}</nav>
      <GoogleTranslateWidget pageLanguage={locale} />
      <button className="kadik-menu-button" onClick={() => setOpen(!open)} aria-label={t.nav.openMenu} aria-expanded={open}><span /><span /><span /></button>
    </div>
    {open && <nav className="kadik-mobile-nav" aria-label={t.nav.mobileMenu}>{navItems.map((item) => <div key={item.href}>
      <Link className={active === item.key || (item.key === "about" && isCorporatePage) || (item.key === "events" && isActivityPage) ? "is-active" : ""} href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
      {item.children?.map((child) => <Link className="kadik-mobile-child" key={child.href} href={child.href} onClick={() => setOpen(false)}>{child.label}</Link>)}
    </div>)}</nav>}
  </header>;
}

function Footer() {
  const { locale } = useKadikPage();
  const t = useKadikDict();
  const p = (key: KadikPageKey) => KADIK_PATHS[key][locale];
  return <footer className="kadik-footer"><div className="kadik-footer-grid">
    <div><div className="kadik-footer-logo"><img src={`${ASSET_ROOT}/kadik-logo.png`} alt="" /><span className="kadik-brand-lockup"><strong>{BRAND_SHORT}</strong><small>{t.brandFull}</small></span></div><p>{t.footer.tagline}</p></div>
    <div><h3>{t.footer.corporate}</h3><Link href={p("about")}>{t.nav.about}</Link><Link href={p("board")}>{t.nav.board}</Link><Link href={p("membership")}>{t.nav.membership}</Link><Link href={p("contact")}>{t.nav.contact}</Link><Link href={p("privacy")}>{t.footer.privacy}</Link></div>
    <div><h3>{t.footer.activities}</h3><Link href={p("events")}>{t.nav.events}</Link><Link href={p("issues")}>{t.nav.announcements}</Link><Link href={p("posts")}>{t.nav.news}</Link><Link href={p("gallery")}>{t.nav.gallery}</Link></div>
    <div><h3>{t.footer.followUs}</h3><p className="kadik-socials">{t.footer.socials.facebook && <Link href={t.footer.socials.facebook} aria-label="Facebook">f</Link>}{t.footer.socials.youtube && <Link href={t.footer.socials.youtube} aria-label="YouTube">▶</Link>}{t.footer.socials.x && <Link href={t.footer.socials.x} aria-label="X">𝕏</Link>}{t.footer.socials.linkedin && <Link href={t.footer.socials.linkedin} aria-label="LinkedIn">in</Link>}{t.footer.socials.instagram && <Link href={t.footer.socials.instagram} aria-label="Instagram">◎</Link>}</p><Button href={p("contact")}>{t.footer.contactCta}</Button></div>
  </div><div className="kadik-footer-bottom"><span>© 2026 {t.brandFull}. {t.footer.rightsReserved}</span><span><Link href={p("privacy")}>{t.footer.privacy}</Link><Link href={p("terms")}>{t.footer.terms}</Link><Link href={p("charter")}>{t.footer.charter}</Link></span></div></footer>;
}

function Banner({ title }: { title: string }) {
  const { locale } = useKadikPage();
  const t = useKadikDict();
  return <><Header /><section className="kadik-banner"><div className="kadik-banner-overlay" /><div className="kadik-container kadik-banner-content"><h1>{title}</h1><p><Link href={KADIK_PATHS.home[locale]}>{t.breadcrumbHome}</Link><span>›</span>{title.toUpperCase()}</p></div></section></>;
}

function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  return <KadikMotion><Banner title={title} /><main>{children}</main><Footer /></KadikMotion>;
}

function SectionHeading({ eyebrow, title }: { eyebrow?: string; title: string }) { return <div className="kadik-section-heading">{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>; }

function BoardPreview({ members }: { members: readonly PublicTeamMemberListItem[] }) {
  const { locale } = useKadikPage();
  const t = useKadikDict().home;
  return <section className="kadik-section kadik-board-preview"><div className="kadik-container">
    <div className="kadik-section-heading kadik-board-heading"><span>{t.boardKicker}</span><h2>{t.boardTitle}</h2><p>{t.boardText}</p><Button href={KADIK_PATHS.board[locale]}>{t.boardCta}</Button></div>
    {members.length > 0 ? <div className="kadik-board-grid">{members.map((member) => <article className="kadik-board-card" key={member.entityId}><img src={member.image.url} alt={member.name} /><div><span>{member.role}</span><h3>{member.name}</h3></div></article>)}</div> : <div className="kadik-board-empty"><strong>{t.boardEmptyTitle}</strong><p>{t.boardEmptyText}</p><Link href={KADIK_PATHS.board[locale]}>{t.boardEmptyLink}</Link></div>}
  </div></section>;
}

export function KadikHome({ locale, dict = KADIK_DICT[locale], team = [], posts = [] }: KadikPageProps & { team?: readonly PublicTeamMemberListItem[]; posts?: readonly KadikPostListItem[] }) {
  const t = dict;
  const p = (key: KadikPageKey) => KADIK_PATHS[key][locale];
  return <KadikPage locale={locale} active="home" dict={dict}><KadikMotion><Header /><main>
    <section className="kadik-hero" style={t.home.heroImage.url ? { backgroundImage: `url(${t.home.heroImage.url})` } : undefined}><div className="kadik-hero-overlay" /><div className="kadik-hero-content"><span className="kadik-hero-kicker">{t.home.heroKicker}</span><h1>{t.home.heroTitleLine1}<br />{t.home.heroTitleLine2}</h1><p>{t.home.heroSubtitle}</p><Button href={p("membership")} tone="red">{t.home.heroCta}</Button></div></section>
    <section className="kadik-section kadik-intro kadik-container"><div><SectionHeading eyebrow={t.home.introEyebrow} title={t.home.introTitle} /></div><div><p className="kadik-lead">{t.home.introLead}</p><p>{t.home.introText}</p><Button href={p("about")}>{t.home.introCta}</Button></div></section>
    <section className="kadik-section kadik-dark-section"><div className="kadik-container"><SectionHeading eyebrow={t.home.principlesEyebrow} title={t.home.principlesTitle} /><div className="kadik-card-grid kadik-card-grid-3">{t.home.principles.map((principle) => <article className="kadik-principle-card" key={principle.title}><span>{principle.number}</span><h3>{principle.title}</h3><p>{principle.text}</p><Link href={p("events")}>{t.home.principlesLink}</Link></article>)}</div></div></section>
    <section className="kadik-image-band" style={t.home.bandImage.url ? { backgroundImage: `url(${t.home.bandImage.url})` } : undefined}><div className="kadik-image-band-overlay" /><div className="kadik-container"><span className="kadik-image-kicker">{t.home.bandKicker}</span><h2>{t.home.bandTitleLine1}<br />{t.home.bandTitleLine2}</h2><Button href={p("membership")} tone="red">{t.home.bandCta}</Button></div></section>
    <BoardPreview members={team} />
    <section className="kadik-section kadik-container"><SectionHeading eyebrow={t.home.newsEyebrow} title={t.home.newsTitle} />
      {posts.length > 0 ? <><div className="kadik-post-grid">{posts.slice(0, 3).map((post) => <PostCard key={post.slug} post={post} />)}</div><div className="kadik-center"><Button href={p("posts")}>{t.home.newsCta}</Button></div></> : <p className="kadik-empty-state" role="status">{t.home.newsEmpty}</p>}
    </section>
  </main><Footer /></KadikMotion></KadikPage>;
}

export function KadikBoard({ locale, dict = KADIK_DICT[locale], members }: KadikPageProps & { members: readonly PublicTeamMemberListItem[] }) {
  const t = dict.board;
  return <KadikPage locale={locale} active="board" dict={dict}><Shell title={t.pageTitle}><section className="kadik-section kadik-container">
    <div className="kadik-board-intro"><SectionHeading eyebrow={t.introEyebrow} title={t.introTitle} /><p className="kadik-lead">{t.introLead}</p></div>
    {members.length > 0 ? <div className="kadik-board-grid kadik-board-grid-page">{members.map((member) => <article className="kadik-board-card" key={member.entityId}><img src={member.image.url} alt={member.name} /><div><span>{member.role}</span><h3>{member.name}</h3></div></article>)}</div> : <div className="kadik-board-empty"><strong>{t.emptyTitle}</strong><p>{t.emptyText}</p></div>}
  </section></Shell></KadikPage>;
}

function PostCard({ post }: { post: KadikPostListItem }) {
  const { locale } = useKadikPage();
  const t = useKadikDict();
  return <article className="kadik-post-card"><Link href={kadikPostPath(locale, post.slug)}><img src={post.image} alt="" /><div className="kadik-post-card-body"><span>{post.category.toLocaleUpperCase(locale)} · {post.dateLabel}</span><h3>{post.title}</h3><p>{post.excerpt}</p><b>{t.home.readMore}</b></div></Link></article>;
}

export function KadikAbout({ locale, dict = KADIK_DICT[locale] }: KadikPageProps) {
  const t = dict.about;
  const boardHref = KADIK_PATHS.board[locale];
  return <KadikPage locale={locale} active="about" dict={dict}><Shell title={t.pageTitle}>
    <section className="kadik-section kadik-container kadik-two-col"><div><SectionHeading title={t.heroTitle} /></div><div><p className="kadik-lead">{t.lead}</p><p>{t.text}</p><Button href={boardHref}>{t.cta}</Button></div></section>
    {t.image.url && <section className="kadik-container"><img className="kadik-wide-image" src={t.image.url} alt={t.wideImageAlt} /></section>}
    <section className="kadik-section kadik-stats"><div className="kadik-container"><SectionHeading eyebrow={t.statsEyebrow} title={t.statsTitle} /><div className="kadik-stat-grid">{t.stats.map((stat) => <div key={stat.label}><strong>{stat.number}</strong><span>{stat.label}</span></div>)}</div></div></section>
    <section className="kadik-section kadik-container"><SectionHeading eyebrow={t.storyEyebrow} title={t.storyTitle} /><div className="kadik-timeline">{t.timeline.map((entry) => <article key={entry.year}><span>{entry.year}</span><div><h3>{entry.title}</h3><p>{entry.text}</p></div></article>)}</div></section>
  </Shell></KadikPage>;
}

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

function formatEventDate(locale: KadikLocale, date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(DATE_LOCALE[locale], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function eventTime(event: KadikEventView): string | null {
  if (!event.startTime) return null;
  return event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime;
}

/** "Send the details to my email": posts to `/api/kadik/events/<id>/email`. */
function EventEmailForm({ event }: { event: KadikEventView }) {
  const t = useKadikDict().events;
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "unavailable">("idle");
  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    setStatus("sending");
    try {
      const response = await fetch(`/api/kadik/events/${encodeURIComponent(event.id)}/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), website: form.get("website") }),
      });
      setStatus(response.ok ? "sent" : response.status === 503 ? "unavailable" : "error");
    } catch {
      setStatus("error");
    }
  }
  if (status === "sent") return <p className="kadik-form-status" role="status">{t.emailSuccess}</p>;
  return <form className="kadik-event-email" onSubmit={submit}>
    <h3>{t.emailHeading}</h3>
    <div>
      <input required type="email" name="email" autoComplete="email" placeholder={t.emailPlaceholder} aria-label={t.emailPlaceholder} />
      {/* Honeypot: hidden from people, filled by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="kadik-honeypot" />
      <button className="kadik-button kadik-button-red" disabled={status === "sending"}>{status === "sending" ? t.emailSending : t.emailSubmit}</button>
    </div>
    <small>{t.emailNote}</small>
    {status === "error" && <p className="kadik-form-status" role="status">{t.emailError}</p>}
    {status === "unavailable" && <p className="kadik-form-status" role="status">{t.emailUnavailable}</p>}
  </form>;
}

/** Event details window: name, date, and - only when filled in - time, place and description. */
function EventDialog({ event, onClose }: { event: KadikEventView | null; onClose: () => void }) {
  const { locale } = useKadikPage();
  const t = useKadikDict().events;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!event) return;
    const node = dialog.current;
    node?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { node?.close(); document.body.style.overflow = previous; };
  }, [event]);
  const time = event ? eventTime(event) : null;
  return <dialog ref={dialog} className="kadik-event-modal" aria-labelledby="kadik-event-title" onCancel={onClose} onClick={(click) => { if (click.target === click.currentTarget) onClose(); }}>
    {event && <div className="kadik-event-modal-panel">
      <button className="kadik-event-modal-close" aria-label={t.close} onClick={onClose}>×</button>
      <div className="kadik-event-modal-body">
        <h2 id="kadik-event-title">{event.title}</h2>
        <dl className="kadik-event-facts">
          <div><dt>{t.dateLabel}</dt><dd><time dateTime={event.date}>{formatEventDate(locale, event.date)}</time></dd></div>
          {time && <div><dt>{t.timeLabel}</dt><dd>{time}</dd></div>}
          {event.location && <div><dt>{t.locationLabel}</dt><dd>{event.location}</dd></div>}
        </dl>
        {event.descriptionHtml && <div className="kadik-event-description" dangerouslySetInnerHTML={{ __html: event.descriptionHtml }} />}
        <EventEmailForm key={event.id} event={event} />
      </div>
    </div>}
  </dialog>;
}

export function KadikEvents({ locale, dict = KADIK_DICT[locale], events = [], initialEventId }: KadikPageProps & { events?: readonly KadikEventView[]; initialEventId?: string }) {
  const t = dict.events;
  const linked = initialEventId ? events.find((event) => event.id === initialEventId) ?? null : null;
  // Opens on the current month (or the month of an event linked with
  // `?event=<id>`, e.g. from the details email); server and client agree
  // because both run within the same request window.
  const [month, setMonth] = useState(() => {
    if (linked) { const [year, monthNumber] = linked.date.split("-").map(Number); return new Date(year, monthNumber - 1, 1); }
    const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [day, setDay] = useState(() => dateKey(new Date()));
  const [mode, setMode] = useState(t.viewMonth);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [openEvent, setOpenEvent] = useState<KadikEventView | null>(linked);
  const first = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - first + 1));
  const found = events.filter((event) => event.title.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  const list = found.filter((event) => mode === t.viewDay ? event.date === day : mode === t.viewList ? true : event.date.startsWith(dateKey(month).slice(0, 7)));
  return <KadikPage locale={locale} active="events" dict={dict}><Shell title={t.pageTitle}><section className="kadik-section kadik-container">
    <form className="kadik-event-toolbar" onSubmit={(event) => { event.preventDefault(); setSearch(query); }}>
      <input aria-label={t.searchAria} placeholder={t.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} />
      <button type="submit">{t.searchButton}</button><div>{[t.viewList, t.viewMonth, t.viewDay].map((view) => <button key={view} type="button" aria-pressed={mode === view} className={mode === view ? "is-selected" : ""} onClick={() => setMode(view)}>{view}</button>)}</div>
    </form>
    <div className="kadik-calendar-head">
      <button aria-label={t.prevMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
      <button aria-label={t.nextMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
      <button className="is-today" onClick={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setDay(dateKey(today)); }}>{t.thisMonth}</button>
      <strong aria-live="polite">{month.toLocaleDateString(DATE_LOCALE[locale], { month: "long", year: "numeric" })}</strong>
      {mode === t.viewDay && <input aria-label={t.dateFieldAria} type="date" value={day} onChange={(event) => setDay(event.target.value)} />}
    </div>
    {mode === t.viewMonth ? <div className="kadik-calendar"><div className="kadik-weekdays">{t.weekdays.map((label) => <span key={label}>{label}</span>)}</div><div className="kadik-days">{cells.map((date) => <div className={`kadik-day ${date.getMonth() !== month.getMonth() ? "is-outside" : ""}`} key={dateKey(date)}>
      <button aria-label={`${date.toLocaleDateString(DATE_LOCALE[locale])} ${t.dayCellAria}`} onClick={() => { setDay(dateKey(date)); setMode(t.viewDay); }}>{date.getDate()}</button>
      {found.filter((event) => event.date === dateKey(date)).map((event) => <button type="button" className="kadik-day-event" key={event.id} onClick={() => setOpenEvent(event)}>{event.startTime ? `${event.startTime} ` : ""}{event.title}</button>)}
    </div>)}</div></div> : <div className="kadik-event-list">{list.map((event) => {
      const time = eventTime(event);
      return <article key={event.id}>
        <div>
          <time dateTime={event.date}>{formatEventDate(locale, event.date)}{time ? ` · ${time}` : ""}</time>
          <h2>{event.title}</h2>
          {event.location && <p>{event.location}</p>}
          <button type="button" className="kadik-button kadik-button-blue" onClick={() => setOpenEvent(event)}>{t.details}<span aria-hidden="true">↗</span></button>
        </div>
      </article>;
    })}{list.length === 0 && <p role="status">{t.noResults}</p>}</div>}
  </section><EventDialog event={openEvent} onClose={() => setOpenEvent(null)} /></Shell></KadikPage>;
}

export function KadikMembership({ locale, dict = KADIK_DICT[locale] }: KadikPageProps) {
  const t = dict.membership;
  return <KadikPage locale={locale} active="membership" dict={dict}><Shell title={t.pageTitle}><section className="kadik-section kadik-container kadik-membership-grid">
    <div>
      <SectionHeading eyebrow={t.eyebrow} title={t.title} />
      <p className="kadik-lead">{t.lead}</p>
      <p>{t.text}</p>
      <ol className="kadik-membership-steps">
        {t.steps.map((step) => <li key={step.number}><b>{step.number}</b><span>{step.text}</span></li>)}
      </ol>
    </div>
    <MembershipForm />
  </section></Shell></KadikPage>;
}

export function KadikIssues({ locale, dict = KADIK_DICT[locale], announcements = [] }: KadikPageProps & { announcements?: readonly KadikAnnouncementView[] }) {
  const t = dict.announcements;
  const contactHref = KADIK_PATHS.contact[locale];
  return <KadikPage locale={locale} active="issues" dict={dict}><Shell title={t.pageTitle}>
    <section className="kadik-section kadik-container"><SectionHeading eyebrow={t.eyebrow} title={t.title} /><p className="kadik-intro-copy">{t.lead}</p>
      {announcements.length === 0 ? <p className="kadik-empty-state" role="status">{t.empty}</p> : <div className="kadik-issue-grid">{announcements.map((item, i) => <article key={item.id}>
        <span>{String(i + 1).padStart(2, "0")}</span>
        {item.date && <time dateTime={item.date}>{formatEventDate(locale, item.date)}</time>}
        <h3>{item.title}</h3>
        {item.text && <p>{item.text}</p>}
        <Link href={item.linkUrl ?? contactHref}>{item.linkLabel ?? t.itemCta}</Link>
      </article>)}</div>}
    </section>
    <section className="kadik-cta-band"><div className="kadik-container"><h2>{t.ctaTitle}</h2><Button href={contactHref} tone="red">{t.ctaButton}</Button></div></section>
  </Shell></KadikPage>;
}

export function KadikPosts({ locale, dict = KADIK_DICT[locale], posts = [], initialCategory }: KadikPageProps & { posts?: readonly KadikPostListItem[]; initialCategory?: string }) {
  const t = dict.news;
  const issuesHref = KADIK_PATHS.issues[locale];
  const postsHref = KADIK_PATHS.posts[locale];
  const categories = Array.from(new Set(posts.map((post) => post.category))).sort((first, second) => first.localeCompare(second, locale));
  const initial = categories.find((category) => category.toLocaleLowerCase(locale) === (initialCategory ?? "").toLocaleLowerCase(locale));
  const [filter, setFilter] = useState(initial ?? t.all);
  const [search, setSearch] = useState("");
  const visible = posts.filter((post) => (filter === t.all || post.category === filter) && post.title.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  return <KadikPage locale={locale} active="posts" dict={dict}><Shell title={t.pageTitle}><section className="kadik-section kadik-container"><div className="kadik-posts-layout"><div>
    <div className="kadik-filter-row"><span>{t.typeLabel}</span>{[t.all, ...categories].map((item) => <button type="button" aria-pressed={filter === item} className={filter === item ? "is-selected" : ""} key={item} onClick={() => {
      setFilter(item);
      const url = new URL(window.location.href);
      if (item === t.all) url.searchParams.delete("category"); else url.searchParams.set("category", item.toLocaleLowerCase(locale));
      window.history.replaceState(null, "", url);
    }}>{item}</button>)}</div>
    <div className="kadik-list-posts">{visible.map((post) => <PostCard key={post.slug} post={post} />)}{visible.length === 0 && <p className="kadik-empty-state" role="status">{posts.length === 0 ? t.emptyNoContent : t.emptyNoMatch}</p>}</div>
    </div><aside className="kadik-sidebar"><div><h3>{t.searchHeading}</h3><input aria-label={t.searchAria} placeholder={t.searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div><h3>{t.categoriesHeading}</h3>{categories.map((category) => <Link key={category} href={`${postsHref}?category=${category.toLocaleLowerCase(locale)}`}>{category} ({posts.filter((post) => post.category === category).length})</Link>)}<Link href={issuesHref}>{t.announcementsLink}</Link></div></aside></div></section></Shell></KadikPage>;
}

function ArticleBlocks({ blocks }: { blocks: readonly KadikArticleBlock[] }) {
  return <>{blocks.map((block, index) => {
    switch (block.type) {
      case "text":
        // Panel tarafında `validateAndSanitizeRichText` ile temizlenmiş HTML.
        return <section key={index} dangerouslySetInnerHTML={{ __html: block.html }} />;
      case "image":
        return <figure className="kadik-figure" key={index}><img src={block.url} alt={block.caption ?? ""} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
      case "kpi":
        return <section key={index}>{block.heading && <h2>{block.heading}</h2>}<div className="kadik-kpi-block">{block.items.map((item) => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div></section>;
      case "quote":
        return <blockquote className="kadik-quote-block" key={index}><p>{block.text}</p>{block.author && <cite>{block.author}</cite>}</blockquote>;
      case "banner":
        return <aside className="kadik-banner-block" key={index}><h3>{block.heading}</h3><p>{block.text}</p>{block.ctaLabel && block.ctaUrl && <Button href={block.ctaUrl} tone="red">{block.ctaLabel}</Button>}</aside>;
    }
  })}</>;
}

export function KadikPostDetail({ locale, dict = KADIK_DICT[locale], post }: KadikPageProps & { post: KadikPostDetailData }) {
  const t = dict.article;
  return <KadikPage locale={locale} active="post" dict={dict}><Shell title={post.title}><article className="kadik-section kadik-container kadik-article">
    <div className="kadik-article-meta">{post.category.toLocaleUpperCase(locale)} · {post.dateLabel} · {post.author.toLocaleUpperCase(locale)}</div>
    <img className="kadik-article-image" src={post.image} alt="" />
    {post.excerpt && <p className="kadik-lead">{post.excerpt}</p>}
    <ArticleBlocks blocks={post.blocks} />
    <div className="kadik-article-tags">{t.tagsLabel} <span>{post.category.toLocaleUpperCase(locale)}</span><span>{t.brandTag}</span><span>{t.industryTag}</span></div>
  </article></Shell></KadikPage>;
}

/** Global 404 surface: uses the same header/banner/footer shell and links
 * the visitor back to the home page and the real site sections
 * (`app/not-found.tsx` always renders this with `locale="en"` - the apex
 * 404 has no locale context to detect a visitor's preferred language from). */
export function KadikNotFound({ locale, dict = KADIK_DICT[locale] }: KadikPageProps) {
  const t = dict.notFound;
  const homeHref = KADIK_PATHS.home[locale];
  const contactHref = KADIK_PATHS.contact[locale];
  return <KadikPage locale={locale} active="notfound" dict={dict}><Shell title={t.pageTitle}><section className="kadik-section kadik-container kadik-404">
    <div>
      <p className="kadik-404-code">{t.code}</p>
      <h2>{t.heading}</h2>
      <p>{t.text}</p>
      <div className="kadik-404-actions"><Button href={homeHref} tone="red">{t.home}</Button><Button href={contactHref} tone="light">{t.contactCta}</Button></div>
    </div>
    <nav className="kadik-404-links" aria-label={t.linksLabel}>
      {t.links.map((link, index) => <Link key={`${index}-${link.key}`} href={KADIK_PATHS[link.key][locale]}><strong>{link.title}</strong><span>{link.text}</span></Link>)}
    </nav>
  </section></Shell></KadikPage>;
}

export function KadikContact({ locale, dict = KADIK_DICT[locale] }: KadikPageProps) {
  const t = dict.contact;
  return <KadikPage locale={locale} active="contact" dict={dict}><Shell title={t.pageTitle}><section className="kadik-section kadik-container"><div className="kadik-contact-grid"><div><SectionHeading eyebrow={t.eyebrow} title={t.title} /><p>{t.lead}</p><div className="kadik-contact-items"><p><b>{t.addressLabel}</b>{t.address}</p><p><b>{t.phoneLabel}</b>{t.phone}</p><p><b>{t.emailLabel}</b>{t.email}</p></div></div><ContactForm /></div></section></Shell></KadikPage>;
}

export function KadikGallery({ locale, dict = KADIK_DICT[locale], items = [] }: KadikPageProps & { items?: readonly KadikGalleryItemView[] }) {
  const t = dict.gallery;
  const categories = Array.from(new Set(items.map((item) => item.category).filter((category) => category.length > 0)));
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState(t.all);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!active) return;
    const node = dialog.current;
    node?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { node?.close(); document.body.style.overflow = previous; };
  }, [active]);
  return <KadikPage locale={locale} active="gallery" dict={dict}><Shell title={t.pageTitle}><section className="kadik-section kadik-container">
    <div className="kadik-gallery-filter">{[t.all, ...categories].map((category) => <button key={category} aria-pressed={filter === category} className={filter === category ? "is-selected" : ""} onClick={() => setFilter(category)}>{category}</button>)}</div>
    {items.length === 0 && <p className="kadik-empty-state" role="status">{t.empty}</p>}
    <div className="kadik-gallery-grid">{items.map((item, index) => ({ ...item, index })).filter((item) => filter === t.all || item.category === filter).map(({ id, image, index, category, caption }) => <button key={id} aria-label={caption || `${category} ${index + 1}`} onClick={() => setActive(image)}><img src={image} alt={caption} /><span>{String(index + 1).padStart(2, "0")}</span></button>)}</div>
  </section><dialog ref={dialog} className="kadik-lightbox" aria-label={t.lightboxAria} onCancel={() => setActive(null)} onClick={(event) => { if (event.target === event.currentTarget) setActive(null); }}>
    <button autoFocus aria-label={t.close} onClick={() => setActive(null)}>×</button>{active && <img src={active} alt={t.enlargedAlt} />}
  </dialog></Shell></KadikPage>;
}

export function KadikLegal({ locale, dict = KADIK_DICT[locale], terms = false, charter = false }: KadikPageProps & { terms?: boolean; charter?: boolean }) {
  const active = charter ? "charter" : terms ? "terms" : "privacy";
  const page = dict[active];
  return <KadikPage locale={locale} active={active} dict={dict}><Shell title={page.title}><section className="kadik-section kadik-container kadik-legal"><p className="kadik-lead">{page.lead}</p>{page.sections.map((section, index) => <section key={`${index}-${section.heading}`}><h2>{section.heading}</h2><p>{section.text}</p></section>)}</section></Shell></KadikPage>;
}
