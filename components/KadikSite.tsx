"use client";

import { FormEvent, createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KadikMotion } from "./KadikMotion";
import GoogleTranslateWidget from "./GoogleTranslateWidget";
import type { PublicTeamMemberListItem } from "@/lib/public-content/team";
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

const images = {
  hero: `${ASSET_ROOT}/is-hero.webp`,
  about: `${ASSET_ROOT}/is-hakkimizda.webp`,
  band: `${ASSET_ROOT}/is-band.webp`,
  gallery: [
    `${ASSET_ROOT}/is-galeri-1.webp`,
    `${ASSET_ROOT}/is-galeri-2.webp`,
    `${ASSET_ROOT}/is-galeri-3.webp`,
    `${ASSET_ROOT}/is-galeri-4.webp`,
    `${ASSET_ROOT}/is-galeri-5.webp`,
    `${ASSET_ROOT}/is-galeri-6.webp`,
    `${ASSET_ROOT}/is-galeri-7.webp`,
    `${ASSET_ROOT}/is-galeri-8.webp`,
    `${ASSET_ROOT}/is-galeri-9.webp`,
  ],
};

/** BCP 47 tag for `Date#toLocaleDateString`/string comparison helpers. */
const DATE_LOCALE: Record<KadikLocale, string> = { en: "en-GB", tr: "tr-TR" };

/**
 * Every exported page component is provided at its root, so `Header`,
 * `Footer`, `Banner`, `Shell` and the language switcher never need `locale`
 * or `active` threaded through as props - they read this instead.
 */
const KadikPageContext = createContext<{ locale: KadikLocale; active: KadikPageKey }>({
  locale: "en",
  active: "home",
});

function useKadikPage() {
  return useContext(KadikPageContext);
}

function useKadikDict(): KadikDictionary {
  return KADIK_DICT[useKadikPage().locale];
}

function KadikPage({ locale, active, children }: { locale: KadikLocale; active: KadikPageKey; children: React.ReactNode }) {
  return <KadikPageContext.Provider value={{ locale, active }}>{children}</KadikPageContext.Provider>;
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

/** EN/TR toggle: resolves the current page's address in the other locale via
 * `KADIK_PATHS`. Post detail pages fall back to the news list root in the
 * other locale (`KADIK_PATHS.post`) - the exact translated slug for a given
 * article is not guaranteed to exist, so the switcher never guesses one. */
function LanguageSwitcher() {
  const { locale, active } = useKadikPage();
  const other: KadikLocale = locale === "en" ? "tr" : "en";
  const t = useKadikDict();
  return <Link className="kadik-lang-switch" href={KADIK_PATHS[active][other]} hrefLang={other} aria-label={t.langSwitch.label}>{other.toUpperCase()}</Link>;
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
      <LanguageSwitcher />
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
    <div><h3>{t.footer.followUs}</h3><p className="kadik-socials"><Link href="#facebook">f</Link><Link href="#youtube">▶</Link><Link href="#x">𝕏</Link></p><Button href={p("contact")}>{t.footer.contactCta}</Button></div>
  </div><div className="kadik-footer-bottom"><span>© 2026 {t.brandFull}. {t.footer.rightsReserved}</span><span><Link href={p("privacy")}>{t.footer.privacy}</Link><Link href={p("terms")}>{t.footer.terms}</Link></span></div></footer>;
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

export function KadikHome({ locale, team = [], posts = [] }: { locale: KadikLocale; team?: readonly PublicTeamMemberListItem[]; posts?: readonly KadikPostListItem[] }) {
  const t = KADIK_DICT[locale];
  const p = (key: KadikPageKey) => KADIK_PATHS[key][locale];
  return <KadikPage locale={locale} active="home"><KadikMotion><Header /><main>
    <section className="kadik-hero"><div className="kadik-hero-overlay" /><div className="kadik-hero-content"><span className="kadik-hero-kicker">{t.home.heroKicker}</span><h1>{t.home.heroTitleLine1}<br />{t.home.heroTitleLine2}</h1><p>{t.home.heroSubtitle}</p><Button href={p("membership")} tone="red">{t.home.heroCta}</Button></div></section>
    <section className="kadik-section kadik-intro kadik-container"><div><SectionHeading eyebrow={t.home.introEyebrow} title={t.home.introTitle} /></div><div><p className="kadik-lead">{t.home.introLead}</p><p>{t.home.introText}</p><Button href={p("about")}>{t.home.introCta}</Button></div></section>
    <section className="kadik-section kadik-dark-section"><div className="kadik-container"><SectionHeading eyebrow={t.home.principlesEyebrow} title={t.home.principlesTitle} /><div className="kadik-card-grid kadik-card-grid-3">{t.home.principles.map((principle) => <article className="kadik-principle-card" key={principle.title}><span>{principle.number}</span><h3>{principle.title}</h3><p>{principle.text}</p><Link href={p("events")}>{t.home.principlesLink}</Link></article>)}</div></div></section>
    <section className="kadik-image-band" style={{ backgroundImage: `url(${images.band})` }}><div className="kadik-image-band-overlay" /><div className="kadik-container"><span className="kadik-image-kicker">{t.home.bandKicker}</span><h2>{t.home.bandTitleLine1}<br />{t.home.bandTitleLine2}</h2><Button href={p("membership")} tone="red">{t.home.bandCta}</Button></div></section>
    <BoardPreview members={team} />
    <section className="kadik-section kadik-container"><SectionHeading eyebrow={t.home.newsEyebrow} title={t.home.newsTitle} />
      {posts.length > 0 ? <><div className="kadik-post-grid">{posts.slice(0, 3).map((post) => <PostCard key={post.slug} post={post} />)}</div><div className="kadik-center"><Button href={p("posts")}>{t.home.newsCta}</Button></div></> : <p className="kadik-empty-state" role="status">{t.home.newsEmpty}</p>}
    </section>
  </main><Footer /></KadikMotion></KadikPage>;
}

export function KadikBoard({ locale, members }: { locale: KadikLocale; members: readonly PublicTeamMemberListItem[] }) {
  const t = KADIK_DICT[locale].board;
  return <KadikPage locale={locale} active="board"><Shell title={t.pageTitle}><section className="kadik-section kadik-container">
    <div className="kadik-board-intro"><SectionHeading eyebrow={t.introEyebrow} title={t.introTitle} /><p className="kadik-lead">{t.introLead}</p></div>
    {members.length > 0 ? <div className="kadik-board-grid kadik-board-grid-page">{members.map((member) => <article className="kadik-board-card" key={member.entityId}><img src={member.image.url} alt={member.name} /><div><span>{member.role}</span><h3>{member.name}</h3></div></article>)}</div> : <div className="kadik-board-empty"><strong>{t.emptyTitle}</strong><p>{t.emptyText}</p></div>}
  </section></Shell></KadikPage>;
}

function PostCard({ post }: { post: KadikPostListItem }) {
  const { locale } = useKadikPage();
  const t = useKadikDict();
  return <article className="kadik-post-card"><Link href={kadikPostPath(locale, post.slug)}><img src={post.image} alt="" /><div className="kadik-post-card-body"><span>{post.category.toLocaleUpperCase(locale)} · {post.dateLabel}</span><h3>{post.title}</h3><p>{post.excerpt}</p><b>{t.home.readMore}</b></div></Link></article>;
}

export function KadikAbout({ locale }: { locale: KadikLocale }) {
  const t = KADIK_DICT[locale].about;
  const boardHref = KADIK_PATHS.board[locale];
  return <KadikPage locale={locale} active="about"><Shell title={t.pageTitle}>
    <section className="kadik-section kadik-container kadik-two-col"><div><SectionHeading title={t.heroTitle} /></div><div><p className="kadik-lead">{t.lead}</p><p>{t.text}</p><Button href={boardHref}>{t.cta}</Button></div></section>
    <section className="kadik-container"><img className="kadik-wide-image" src={images.about} alt={t.wideImageAlt} /></section>
    <section className="kadik-section kadik-stats"><div className="kadik-container"><SectionHeading eyebrow={t.statsEyebrow} title={t.statsTitle} /><div className="kadik-stat-grid">{t.stats.map((stat) => <div key={stat.label}><strong>{stat.number}</strong><span>{stat.label}</span></div>)}</div></div></section>
    <section className="kadik-section kadik-container"><SectionHeading eyebrow={t.storyEyebrow} title={t.storyTitle} /><div className="kadik-timeline">{t.timeline.map((entry) => <article key={entry.year}><span>{entry.year}</span><div><h3>{entry.title}</h3><p>{entry.text}</p></div></article>)}</div></section>
  </Shell></KadikPage>;
}

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export function KadikEvents({ locale }: { locale: KadikLocale }) {
  const t = KADIK_DICT[locale].events;
  const membershipHref = KADIK_PATHS.membership[locale];
  const eventsHref = KADIK_PATHS.events[locale];
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const [day, setDay] = useState("2026-09-17");
  const [mode, setMode] = useState(t.viewMonth);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const first = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - first + 1));
  const found = t.events.filter((event) => event.title.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  const list = found.filter((event) => mode === t.viewDay ? event.date === day : event.date.startsWith(dateKey(month).slice(0, 7)));
  return <KadikPage locale={locale} active="events"><Shell title={t.pageTitle}><section className="kadik-section kadik-container">
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
      {found.filter((event) => event.date === dateKey(date)).map((event) => <Link key={event.title} href={eventsHref}>{event.title}</Link>)}
    </div>)}</div></div> : <div className="kadik-event-list">{list.map((event) => <article key={event.date + event.title}><time dateTime={event.date}>{event.date}</time><h2>{event.title}</h2><Button href={membershipHref}>{t.join}</Button></article>)}{list.length === 0 && <p role="status">{t.noResults}</p>}</div>}
  </section></Shell></KadikPage>;
}

export function KadikMembership({ locale }: { locale: KadikLocale }) {
  const t = KADIK_DICT[locale].membership;
  return <KadikPage locale={locale} active="membership"><Shell title={t.pageTitle}><section className="kadik-section kadik-container kadik-membership-grid">
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

export function KadikIssues({ locale }: { locale: KadikLocale }) {
  const t = KADIK_DICT[locale].announcements;
  const contactHref = KADIK_PATHS.contact[locale];
  return <KadikPage locale={locale} active="issues"><Shell title={t.pageTitle}>
    <section className="kadik-section kadik-container"><SectionHeading eyebrow={t.eyebrow} title={t.title} /><p className="kadik-intro-copy">{t.lead}</p><div className="kadik-issue-grid">{t.items.map((issue, i) => <article key={issue}><span>0{i + 1}</span><h3>{issue}</h3><p>{t.itemText}</p><Link href={contactHref}>{t.itemCta}</Link></article>)}</div></section>
    <section className="kadik-cta-band"><div className="kadik-container"><h2>{t.ctaTitle}</h2><Button href={contactHref} tone="red">{t.ctaButton}</Button></div></section>
  </Shell></KadikPage>;
}

export function KadikPosts({ locale, posts = [], initialCategory }: { locale: KadikLocale; posts?: readonly KadikPostListItem[]; initialCategory?: string }) {
  const t = KADIK_DICT[locale].news;
  const issuesHref = KADIK_PATHS.issues[locale];
  const postsHref = KADIK_PATHS.posts[locale];
  const categories = Array.from(new Set(posts.map((post) => post.category))).sort((first, second) => first.localeCompare(second, locale));
  const initial = categories.find((category) => category.toLocaleLowerCase(locale) === (initialCategory ?? "").toLocaleLowerCase(locale));
  const [filter, setFilter] = useState(initial ?? t.all);
  const [search, setSearch] = useState("");
  const visible = posts.filter((post) => (filter === t.all || post.category === filter) && post.title.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  return <KadikPage locale={locale} active="posts"><Shell title={t.pageTitle}><section className="kadik-section kadik-container"><div className="kadik-posts-layout"><div>
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

export function KadikPostDetail({ locale, post }: { locale: KadikLocale; post: KadikPostDetailData }) {
  const t = KADIK_DICT[locale].article;
  return <KadikPage locale={locale} active="post"><Shell title={post.title}><article className="kadik-section kadik-container kadik-article">
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
export function KadikNotFound({ locale }: { locale: KadikLocale }) {
  const t = KADIK_DICT[locale].notFound;
  const homeHref = KADIK_PATHS.home[locale];
  const contactHref = KADIK_PATHS.contact[locale];
  return <KadikPage locale={locale} active="notfound"><Shell title={t.pageTitle}><section className="kadik-section kadik-container kadik-404">
    <div>
      <p className="kadik-404-code">{t.code}</p>
      <h2>{t.heading}</h2>
      <p>{t.text}</p>
      <div className="kadik-404-actions"><Button href={homeHref} tone="red">{t.home}</Button><Button href={contactHref} tone="light">{t.contactCta}</Button></div>
    </div>
    <nav className="kadik-404-links" aria-label={t.linksLabel}>
      {t.links.map((link) => <Link key={link.key} href={KADIK_PATHS[link.key][locale]}><strong>{link.title}</strong><span>{link.text}</span></Link>)}
    </nav>
  </section></Shell></KadikPage>;
}

export function KadikContact({ locale }: { locale: KadikLocale }) {
  const t = KADIK_DICT[locale].contact;
  return <KadikPage locale={locale} active="contact"><Shell title={t.pageTitle}><section className="kadik-section kadik-container"><div className="kadik-contact-grid"><div><SectionHeading eyebrow={t.eyebrow} title={t.title} /><p>{t.lead}</p><div className="kadik-contact-items"><p><b>{t.addressLabel}</b>{t.address}</p><p><b>{t.phoneLabel}</b>{t.phone}</p><p><b>{t.emailLabel}</b>{t.email}</p></div></div><ContactForm /></div></section></Shell></KadikPage>;
}

export function KadikGallery({ locale }: { locale: KadikLocale }) {
  const t = KADIK_DICT[locale].gallery;
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
  return <KadikPage locale={locale} active="gallery"><Shell title={t.pageTitle}><section className="kadik-section kadik-container">
    <div className="kadik-gallery-filter">{[t.all, ...t.categories].map((category) => <button key={category} aria-pressed={filter === category} className={filter === category ? "is-selected" : ""} onClick={() => setFilter(category)}>{category}</button>)}</div>
    <div className="kadik-gallery-grid">{images.gallery.map((image, i) => ({ image, index: i, category: t.categories[i % t.categories.length] })).filter((item) => filter === t.all || item.category === filter).map(({ image, index, category }) => <button key={image} aria-label={`${category} ${index + 1}`} onClick={() => setActive(image)}><img src={image} alt={`KADIK ${category.toLocaleLowerCase(locale)} ${index + 1}`} /><span>0{index + 1}</span></button>)}</div>
  </section><dialog ref={dialog} className="kadik-lightbox" aria-label={t.lightboxAria} onCancel={() => setActive(null)} onClick={(event) => { if (event.target === event.currentTarget) setActive(null); }}>
    <button autoFocus aria-label={t.close} onClick={() => setActive(null)}>×</button>{active && <img src={active} alt={t.enlargedAlt} />}
  </dialog></Shell></KadikPage>;
}

export function KadikLegal({ locale, terms = false }: { locale: KadikLocale; terms?: boolean }) {
  const t = KADIK_DICT[locale].legal;
  const sections = terms ? t.termsSections : t.privacySections;
  return <KadikPage locale={locale} active={terms ? "terms" : "privacy"}><Shell title={terms ? t.termsTitle : t.privacyTitle}><section className="kadik-section kadik-container kadik-legal"><p className="kadik-lead">{t.lead}</p>{sections.map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}</section></Shell></KadikPage>;
}
