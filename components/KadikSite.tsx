"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KadikMotion } from "./KadikMotion";
import type { PublicTeamMemberListItem } from "@/lib/public-content/team";

const ASSET_ROOT = "/kadik";
const BRAND_SHORT = "KADİK";
const BRAND_FULL = "KYBELE ATASEVER DÜNYA İŞ KONSEYİ";
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

type PageKey = "home" | "about" | "board" | "events" | "membership" | "issues" | "posts" | "post" | "contact" | "gallery" | "privacy" | "terms" | "notfound";

const navItems = [
  { label: "Ana Sayfa", href: "/", key: "home" },
  {
    label: "Kurumsal",
    href: "/hakkimizda",
    key: "about",
    children: [
      { label: "Hakkımızda", href: "/hakkimizda" },
      { label: "Kurul Üyeleri", href: "/kurul-uyeleri" },
      { label: "İletişim", href: "/iletisim" },
    ],
  },
  {
    label: "Faaliyetler",
    href: "/etkinlikler",
    key: "events",
    children: [
      { label: "Etkinlikler", href: "/etkinlikler" },
      { label: "Duyurular", href: "/duyurular" },
      { label: "Yayınlar", href: "/yazilar" },
    ],
  },
  { label: "Üyelik", href: "/uyelik", key: "membership" },
  {
    label: "Haberler",
    href: "/yazilar",
    key: "posts",
    children: [
      { label: "Makaleler", href: "/yazilar?kategori=makale" },
      { label: "Haberler", href: "/yazilar?kategori=haber" },
      { label: "Blog", href: "/yazilar?kategori=blog" },
    ],
  },
  { label: "Galeri", href: "/galeri", key: "gallery" },
] as const;

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
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/kadik/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: form.get("name") || "Konsey ziyaretçisi", email: form.get("email"), phone: form.get("phone"), subject: form.get("subject"), message: form.get("message") || "Konsey iletişim formu", consent: form.get("consent") === "on",
      }) });
      setStatus(response.ok ? "Mesajınız alındı. Ekibimiz en kısa sürede size dönecek." : "Form gönderilemedi. Lütfen daha sonra tekrar deneyin.");
      if (response.ok) formElement.reset();
    } catch { setStatus("Form gönderilemedi. Lütfen daha sonra tekrar deneyin."); }
    setBusy(false);
  }
  return <form className="kadik-form" onSubmit={submit}>
    <div className="kadik-form-grid"><input required name="name" placeholder="Adınız Soyadınız" /><input required type="email" name="email" placeholder="E-posta adresiniz" /></div>
    <input name="subject" placeholder="Konu" />
    <textarea required name="message" rows={5} placeholder="Mesajınız" />
    <label className="kadik-consent"><input required type="checkbox" name="consent" /> <span>Gönderdiğim bilgilerin saklanmasını ve benimle iletişime geçilmesini kabul ediyorum.</span></label>
    <button className="kadik-button kadik-button-red" disabled={busy}>{busy ? "Gönderiliyor…" : "Mesaj Gönder"}<span aria-hidden="true">↗</span></button>
    {status && <p className="kadik-form-status" role="status">{status}</p>}
  </form>;
}

/** Üyelik başvuru formu: şirket/sektör bilgisi serbest metin alanlarıyla
 * toplanır (kampanya döneminden kalan "nasıl katkı sunabilirsiniz" dropdown'ı
 * kaldırıldı). Alanlar `/api/kadik/contact` sözleşmesini bozmadan tek bir
 * başvuru gövdesine derlenir; konu satırı başvuruyu mesaj listesinde
 * ayırt edilebilir kılar. */
function MembershipForm() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const company = value("company");
    const details = ([
      ["Şirket / kurum", company],
      ["Görev / unvan", value("position")],
      ["Sektör", value("sector")],
      ["Şehir", value("city")],
      ["Web sitesi", value("website")],
      ["Referans üye", value("reference")],
    ] as const).filter(([, field]) => field.length > 0).map(([label, field]) => `${label}: ${field}`);
    const message = [value("message"), details.length > 0 ? "" : null, ...details].filter((line) => line !== null).join("\n").trim();
    try {
      const response = await fetch("/api/kadik/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: value("name"), email: value("email"), phone: value("phone"),
        subject: company ? `Üyelik başvurusu: ${company}` : "Üyelik başvurusu",
        message, consent: form.get("consent") === "on",
      }) });
      setStatus(response.ok ? "Başvurunuz alındı. Konsey sekreteryası değerlendirme sonrasında sizinle iletişime geçecek." : "Başvuru gönderilemedi. Lütfen daha sonra tekrar deneyin.");
      if (response.ok) formElement.reset();
    } catch { setStatus("Başvuru gönderilemedi. Lütfen daha sonra tekrar deneyin."); }
    setBusy(false);
  }
  return <form className="kadik-form" onSubmit={submit} aria-label="Üyelik başvuru formu">
    <div className="kadik-form-grid">
      <label className="kadik-field"><span>Ad Soyad</span><input required name="name" autoComplete="name" placeholder="Adınız Soyadınız" /></label>
      <label className="kadik-field"><span>E-posta</span><input required type="email" name="email" autoComplete="email" placeholder="ornek@sirket.com" /></label>
    </div>
    <div className="kadik-form-grid">
      <label className="kadik-field"><span>Telefon</span><input required name="phone" inputMode="tel" autoComplete="tel" placeholder="+90 5xx xxx xx xx" /></label>
      <label className="kadik-field"><span>Şirket / kurum</span><input required name="company" autoComplete="organization" placeholder="Şirketinizin adı" /></label>
    </div>
    <div className="kadik-form-grid">
      <label className="kadik-field"><span>Görev / unvan</span><input required name="position" autoComplete="organization-title" placeholder="Genel müdür, kurucu, yönetici…" /></label>
      <label className="kadik-field"><span>Sektör</span><input required name="sector" placeholder="İnşaat, tekstil, lojistik, teknoloji…" /></label>
    </div>
    <div className="kadik-form-grid">
      <label className="kadik-field"><span>Şehir</span><input name="city" autoComplete="address-level2" placeholder="İstanbul" /></label>
      <label className="kadik-field"><span>Web sitesi (opsiyonel)</span><input name="website" inputMode="url" placeholder="www.sirketiniz.com" /></label>
    </div>
    <label className="kadik-field"><span>Referans üye (opsiyonel)</span><input name="reference" placeholder="Sizi konseye yönlendiren üye" /></label>
    <label className="kadik-field"><span>Başvuru notu</span><textarea required name="message" rows={5} placeholder="Faaliyet alanınız, üyelikten beklentiniz ve katkı sunmak istediğiniz sektör kurulu" /></label>
    <label className="kadik-consent"><input required type="checkbox" name="consent" /> <span>Başvuru bilgilerimin üyelik değerlendirmesi için saklanmasını ve benimle iletişime geçilmesini kabul ediyorum.</span></label>
    <button className="kadik-button kadik-button-red" disabled={busy}>{busy ? "Gönderiliyor…" : "Üyelik Başvurusu Gönder"}<span aria-hidden="true">↗</span></button>
    {status && <p className="kadik-form-status" role="status">{status}</p>}
  </form>;
}

function Header({ active }: { active: PageKey }) {
  const [open, setOpen] = useState(false);
  const isCorporatePage = active === "about" || active === "board" || active === "contact";
  const isActivityPage = active === "events" || active === "issues" || active === "posts";
  return <header className="kadik-header">
    <div className="kadik-header-inner">
      <Link href="/" className="kadik-logo" aria-label={`${BRAND_FULL} ana sayfa`}>
        <img src={`${ASSET_ROOT}/kadik-logo.png`} alt="" />
        <span className="kadik-brand-lockup"><strong>{BRAND_SHORT}</strong><small>{BRAND_FULL}</small></span>
      </Link>
      <nav className="kadik-nav" aria-label="Ana menü">{navItems.map((item) => <div className="kadik-nav-item" key={item.href}>
        <Link className={active === item.key || (item.key === "about" && isCorporatePage) || (item.key === "events" && isActivityPage) ? "is-active" : ""} href={item.href}>{item.label}</Link>
        {"children" in item && <div className="kadik-dropdown">{item.children.map((child) => <Link key={child.href} href={child.href}>{child.label}</Link>)}</div>}
      </div>)}</nav>
      <button className="kadik-menu-button" onClick={() => setOpen(!open)} aria-label="Menüyü aç" aria-expanded={open}><span /><span /><span /></button>
    </div>
    {open && <nav className="kadik-mobile-nav" aria-label="Mobil menü">{navItems.map((item) => <div key={item.href}>
      <Link className={active === item.key || (item.key === "about" && isCorporatePage) || (item.key === "events" && isActivityPage) ? "is-active" : ""} href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
      {"children" in item && item.children.map((child) => <Link className="kadik-mobile-child" key={child.href} href={child.href} onClick={() => setOpen(false)}>{child.label}</Link>)}
    </div>)}</nav>}
  </header>;
}

function Footer() {
  return <footer className="kadik-footer"><div className="kadik-footer-grid">
    <div><div className="kadik-footer-logo"><img src={`${ASSET_ROOT}/kadik-logo.png`} alt="" /><span className="kadik-brand-lockup"><strong>{BRAND_SHORT}</strong><small>{BRAND_FULL}</small></span></div><p>İş dünyasını ortak akıl, güven ve uluslararası iş birlikleri etrafında buluşturan bağımsız bir konsey.</p></div>
    <div><h3>Kurumsal</h3><Link href="/hakkimizda">Hakkımızda</Link><Link href="/kurul-uyeleri">Kurul Üyeleri</Link><Link href="/uyelik">Üyelik</Link><Link href="/iletisim">İletişim</Link><Link href="/gizlilik-politikasi">Gizlilik</Link></div>
    <div><h3>Faaliyetler</h3><Link href="/etkinlikler">Etkinlikler</Link><Link href="/duyurular">Duyurular</Link><Link href="/yazilar">Yayınlar</Link><Link href="/galeri">Galeri</Link></div>
    <div><h3>Bizi Takip Edin</h3><p className="kadik-socials"><Link href="#facebook">f</Link><Link href="#youtube">▶</Link><Link href="#x">𝕏</Link></p><Button href="/iletisim">Bize Ulaşın</Button></div>
  </div><div className="kadik-footer-bottom"><span>© 2026 {BRAND_FULL}. Tüm hakları saklıdır.</span><span><Link href="/gizlilik-politikasi">Gizlilik</Link><Link href="/kullanim-sartlari">Kullanım Koşulları</Link></span></div></footer>;
}

function Banner({ title, active }: { title: string; active: PageKey }) {
  return <><Header active={active} /><section className="kadik-banner"><div className="kadik-banner-overlay" /><div className="kadik-container kadik-banner-content"><h1>{title}</h1><p><Link href="/">ANASAYFA</Link><span>›</span>{title.toUpperCase()}</p></div></section></>;
}

function Shell({ children, title, active }: { children: React.ReactNode; title: string; active: PageKey }) {
  return <KadikMotion><Banner title={title} active={active} /><main>{children}</main><Footer /></KadikMotion>;
}

function SectionHeading({ eyebrow, title }: { eyebrow?: string; title: string }) { return <div className="kadik-section-heading">{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>; }

function BoardPreview({ members }: { members: readonly PublicTeamMemberListItem[] }) {
  return <section className="kadik-section kadik-board-preview"><div className="kadik-container">
    <div className="kadik-section-heading kadik-board-heading"><span>KYBELE ATASEVER DÜNYA İŞ KONSEYİ</span><h2>Kurul üyelerimiz</h2><p>Farklı sektörlerden iş insanlarını ortak akıl ve yeni iş birlikleri için aynı masada buluşturuyoruz.</p><Button href="/kurul-uyeleri">Tüm kurul</Button></div>
    {members.length > 0 ? <div className="kadik-board-grid">{members.map((member) => <article className="kadik-board-card" key={member.entityId}><img src={member.image.url} alt={member.name} /><div><span>{member.role}</span><h3>{member.name}</h3></div></article>)}</div> : <div className="kadik-board-empty"><strong>Kurul kadrosu hazırlanıyor.</strong><p>Kurul üyelerini yönetim panelindeki “Kurul Üyeleri” bölümünden ekleyip yayınlayabilirsiniz.</p><Link href="/kurul-uyeleri">Kurul üyeleri sayfasını görüntüle ↗</Link></div>}
  </div></section>;
}

export function KadikHome({ team = [], posts = [] }: { team?: readonly PublicTeamMemberListItem[]; posts?: readonly KadikPostListItem[] }) {
  return <KadikMotion><Header active="home" /><main>
    <section className="kadik-hero"><div className="kadik-hero-overlay" /><div className="kadik-hero-content"><span className="kadik-hero-kicker">KYBELE ATASEVER DÜNYA İŞ KONSEYİ</span><h1>İş dünyasını<br />geleceğe bağlıyoruz.</h1><p>Güven, ortak akıl ve sürdürülebilir iş birlikleri.</p><Button href="/uyelik" tone="red">Üyelik hakkında</Button></div></section>
    <section className="kadik-section kadik-intro kadik-container"><div><SectionHeading eyebrow="KONSEYİMİZ" title="Sınırları aşan bir iş ağı." /></div><div><p className="kadik-lead">Kybele ve KADİK; girişimcileri, şirket yöneticilerini ve sektör liderlerini ortak değerler etrafında buluşturan bir dünya iş konseyi olarak çalışır.</p><p>Bilgi paylaşımını, ticari bağlantıları ve yeni nesil iş birliklerini güçlendiren programlar düzenliyoruz.</p><Button href="/hakkimizda">Konseyi tanıyın</Button></div></section>
    <section className="kadik-section kadik-dark-section"><div className="kadik-container"><SectionHeading eyebrow="FAALİYET ALANLARIMIZ" title="Üyelerimiz için gerçek bağlantılar, somut fırsatlar." /><div className="kadik-card-grid kadik-card-grid-3">{[["01", "İş geliştirme", "Yeni pazarlara açılmak ve doğru ortaklarla buluşmak için programlar."], ["02", "Sektör kurulları", "Sektörel deneyimi ortak akılla büyüten çalışma grupları."], ["03", "Uluslararası ağ", "Dünya genelinde yatırım, ticaret ve temsil bağlantıları."]].map(([number, title, text]) => <article className="kadik-principle-card" key={title}><span>{number}</span><h3>{title}</h3><p>{text}</p><Link href="/etkinlikler">Faaliyetleri keşfet ↗</Link></article>)}</div></div></section>
    <section className="kadik-image-band" style={{ backgroundImage: `url(${images.band})` }}><div className="kadik-image-band-overlay" /><div className="kadik-container"><span className="kadik-image-kicker">İŞ BİRLİĞİ · VİZYON · GÜVEN</span><h2>Birlikte büyüyen<br />bir iş ekosistemi.</h2><Button href="/uyelik" tone="red">Üye olun</Button></div></section>
    <BoardPreview members={team} />
    <section className="kadik-section kadik-container"><SectionHeading eyebrow="GÜNCEL" title="Konseyden haberler" />
      {posts.length > 0 ? <><div className="kadik-post-grid">{posts.slice(0, 3).map((post) => <PostCard key={post.slug} post={post} />)}</div><div className="kadik-center"><Button href="/yazilar">Tüm yayınlar</Button></div></> : <p className="kadik-empty-state" role="status">Yayınlar hazırlanıyor. Yönetim panelindeki “Yayınlar ve Haberler” bölümünden yazı ekleyip yayınladığınızda bu alan otomatik güncellenir.</p>}
    </section>
  </main><Footer /></KadikMotion>;
}

export function KadikBoard({ members }: { members: readonly PublicTeamMemberListItem[] }) {
  return <Shell title="Kurul Üyeleri" active="board"><section className="kadik-section kadik-container">
    <div className="kadik-board-intro"><SectionHeading eyebrow="KONSEY YÖNETİMİ" title="Kurul üyelerimiz" /><p className="kadik-lead">Kybele ve KADİK Dünya İş Konseyi üyeleriyle tanışın; farklı sektörleri temsil eden iş insanlarımızla bağlantı kurun.</p></div>
    {members.length > 0 ? <div className="kadik-board-grid kadik-board-grid-page">{members.map((member) => <article className="kadik-board-card" key={member.entityId}><img src={member.image.url} alt={member.name} /><div><span>{member.role}</span><h3>{member.name}</h3></div></article>)}</div> : <div className="kadik-board-empty"><strong>Kurul üyeleri yakında burada.</strong><p>Yeni kurul üyeleri yönetim panelinden eklenip yayınlandığında bu sayfada görünecek.</p></div>}
  </section></Shell>;
}

function PostCard({ post }: { post: KadikPostListItem }) { return <article className="kadik-post-card"><Link href={`/yazilar/${post.slug}`}><img src={post.image} alt="" /><div className="kadik-post-card-body"><span>{post.category.toLocaleUpperCase("tr")} · {post.dateLabel}</span><h3>{post.title}</h3><p>{post.excerpt}</p><b>Devamını oku ↗</b></div></Link></article>; }

export function KadikAbout() { return <Shell title="Hakkımızda" active="about"><section className="kadik-section kadik-container kadik-two-col"><div><SectionHeading title="Birlikte büyüyen bir ekosistem." /></div><div><p className="kadik-lead">Kybele ve KADİK; girişimcileri, şirket yöneticilerini ve sektör liderlerini güvene dayalı bir dünya iş ağı içinde buluşturur.</p><p>Konseyimiz; ticari bağlantıları güçlendiren, bilgi paylaşımını artıran ve üyelerinin uluslararası ölçekte gelişimine katkı sunan programlar tasarlar.</p><Button href="/kurul-uyeleri">Kurul üyelerini tanıyın</Button></div></section><section className="kadik-container"><img className="kadik-wide-image" src={images.about} alt="İş insanlarının toplantısı" /></section><section className="kadik-section kadik-stats"><div className="kadik-container"><SectionHeading eyebrow="RAKAMLARLA" title="Ortak değerlerimiz" /><div className="kadik-stat-grid">{[["01", "Güven odaklı ağ"], ["02", "Sektör kurulu"], ["03", "Uluslararası vizyon"], ["04", "Sürdürülebilir büyüme"]].map(([number, label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}</div></div></section><section className="kadik-section kadik-container"><SectionHeading eyebrow="KONSEYİN HİKÂYESİ" title="Fikirden küresel iş ağına" /><div className="kadik-timeline">{[["2024", "Kybele vizyonu doğdu", "İş dünyasının farklı sektörlerini ortak hedeflerde buluşturma fikriyle yola çıktık."], ["2025", "KADİK ağı kuruldu", "Üyelerimiz için bilgi, bağlantı ve gelişim odaklı bir yapı oluşturduk."], ["2026", "Dünya iş konseyi", "Yeni pazarlara açılan, güvenilir ve sürdürülebilir iş birliklerini büyütüyoruz."]].map(([year, title, text]) => <article key={year}><span>{year}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section></Shell>; }

const calendarEvents = [
  { date: "2026-09-08", title: "Sektör kurulları ortak toplantısı" },
  { date: "2026-09-15", title: "İhracat ve dış pazarlar paneli" },
  { date: "2026-09-17", title: "Üye şirketler tanışma buluşması" },
  { date: "2026-09-29", title: "Finansmana erişim çalıştayı" },
];
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function KadikEvents() {
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const [day, setDay] = useState("2026-09-17");
  const [mode, setMode] = useState("Ay");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const first = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - first + 1));
  const found = calendarEvents.filter((event) => event.title.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")));
  const list = found.filter((event) => mode === "Gün" ? event.date === day : event.date.startsWith(dateKey(month).slice(0, 7)));
  return <Shell title="Etkinlikler" active="events"><section className="kadik-section kadik-container">
    <form className="kadik-event-toolbar" onSubmit={(event) => { event.preventDefault(); setSearch(query); }}>
      <input aria-label="Etkinliklerde ara" placeholder="Etkinliklerde ara" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button type="submit">Etkinlik bul</button><div>{["Liste", "Ay", "Gün"].map((view) => <button key={view} type="button" aria-pressed={mode === view} className={mode === view ? "is-selected" : ""} onClick={() => setMode(view)}>{view}</button>)}</div>
    </form>
    <div className="kadik-calendar-head">
      <button aria-label="Önceki ay" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
      <button aria-label="Sonraki ay" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
      <button className="is-today" onClick={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setDay(dateKey(today)); }}>BU AY</button>
      <strong aria-live="polite">{month.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</strong>
      {mode === "Gün" && <input aria-label="Etkinlik tarihi" type="date" value={day} onChange={(event) => setDay(event.target.value)} />}
    </div>
    {mode === "Ay" ? <div className="kadik-calendar"><div className="kadik-weekdays">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((label) => <span key={label}>{label}</span>)}</div><div className="kadik-days">{cells.map((date) => <div className={`kadik-day ${date.getMonth() !== month.getMonth() ? "is-outside" : ""}`} key={dateKey(date)}>
      <button aria-label={`${date.toLocaleDateString("tr-TR")} etkinlikleri`} onClick={() => { setDay(dateKey(date)); setMode("Gün"); }}>{date.getDate()}</button>
      {found.filter((event) => event.date === dateKey(date)).map((event) => <Link key={event.title} href="/etkinlikler">{event.title}</Link>)}
    </div>)}</div></div> : <div className="kadik-event-list">{list.map((event) => <article key={event.date + event.title}><time dateTime={event.date}>{event.date}</time><h2>{event.title}</h2><Button href="/uyelik">Katıl</Button></article>)}{list.length === 0 && <p role="status">Bu tarih için etkinlik bulunamadı.</p>}</div>}
  </section></Shell>;
}

export function KadikMembership() {
  return <Shell title="Üyelik Başvurusu" active="membership"><section className="kadik-section kadik-container kadik-membership-grid">
    <div>
      <SectionHeading eyebrow="KONSEY AİLESİ" title="İş ağınızı büyütün." />
      <p className="kadik-lead">Kybele ve KADİK üyeliğiyle bilgiye, bağlantıya ve yeni ticari fırsatlara daha yakın olun.</p>
      <p>Üyelik; şirket sahipleri, yöneticiler ve profesyoneller için kurumsal bir başvuru süreciyle işler. Başvurunuz konsey sekreteryası tarafından değerlendirilir, ardından sizi uygun sektör kurulu ve çalışma gruplarıyla buluştururuz.</p>
      <ol className="kadik-membership-steps">
        <li><b>01</b><span>Başvuru formunu şirket ve sektör bilgilerinizle doldurun.</span></li>
        <li><b>02</b><span>Sekreterya başvurunuzu inceler ve sizinle ön görüşme yapar.</span></li>
        <li><b>03</b><span>Yönetim kurulu değerlendirmesinin ardından üyelik kaydınız tamamlanır.</span></li>
        <li><b>04</b><span>Sektör kurullarına, etkinliklere ve iş birliği programlarına katılmaya başlarsınız.</span></li>
      </ol>
    </div>
    <MembershipForm />
  </section></Shell>;
}

export function KadikIssues() { return <Shell title="Duyurular" active="issues"><section className="kadik-section kadik-container"><SectionHeading eyebrow="KONSEYDEN" title="Gündem ve duyurular" /><p className="kadik-intro-copy">Üyelerimizi etkinlikler, sektör kurulları, iş fırsatları ve konsey çalışmalarındaki gelişmeler hakkında düzenli olarak bilgilendiriyoruz.</p><div className="kadik-issue-grid">{["Sektör kurulları", "Üyelik duyuruları", "Uluslararası iş fırsatları", "Eğitim ve gelişim", "Ticaret heyetleri", "Konsey buluşmaları", "Yayınlar", "İş birlikleri"].map((issue, i) => <article key={issue}><span>0{i + 1}</span><h3>{issue}</h3><p>İş dünyasının gündemini, üyelerimizin gelişimini ve yeni bağlantıları destekleyen güncel başlıklar.</p><Link href="/iletisim">Detaylı bilgi ↗</Link></article>)}</div></section><section className="kadik-cta-band"><div className="kadik-container"><h2>Konsey gündeminden haberdar olun.</h2><Button href="/iletisim" tone="red">Bize ulaşın</Button></div></section></Shell>; }

export function KadikPosts({ posts = [], initialCategory }: { posts?: readonly KadikPostListItem[]; initialCategory?: string }) {
  const categories = Array.from(new Set(posts.map((post) => post.category))).sort((first, second) => first.localeCompare(second, "tr"));
  const initial = categories.find((category) => category.toLocaleLowerCase("tr") === (initialCategory ?? "").toLocaleLowerCase("tr"));
  const [filter, setFilter] = useState(initial ?? "Tümü");
  const [search, setSearch] = useState("");
  const visible = posts.filter((post) => (filter === "Tümü" || post.category === filter) && post.title.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")));
  return <Shell title="Yayınlar" active="posts"><section className="kadik-section kadik-container"><div className="kadik-posts-layout"><div>
    <div className="kadik-filter-row"><span>Yazı türü:</span>{["Tümü", ...categories].map((item) => <button type="button" aria-pressed={filter === item} className={filter === item ? "is-selected" : ""} key={item} onClick={() => {
      setFilter(item);
      const url = new URL(window.location.href);
      if (item === "Tümü") url.searchParams.delete("kategori"); else url.searchParams.set("kategori", item.toLocaleLowerCase("tr"));
      window.history.replaceState(null, "", url);
    }}>{item}</button>)}</div>
    <div className="kadik-list-posts">{visible.map((post) => <PostCard key={post.slug} post={post} />)}{visible.length === 0 && <p className="kadik-empty-state" role="status">{posts.length === 0 ? "Yayınlar hazırlanıyor. Yönetim panelinden yazı ekleyip yayınladığınızda burada listelenir." : "Aramanıza uygun yazı bulunamadı."}</p>}</div>
    </div><aside className="kadik-sidebar"><div><h3>Arama</h3><input aria-label="Yazılarda ara" placeholder="Ara…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div><h3>Kategoriler</h3>{categories.map((category) => <Link key={category} href={`/yazilar?kategori=${category.toLocaleLowerCase("tr")}`}>{category} ({posts.filter((post) => post.category === category).length})</Link>)}<Link href="/duyurular">Duyurular</Link></div></aside></div></section></Shell>;
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

export function KadikPostDetail({ post }: { post: KadikPostDetailData }) {
  return <Shell title={post.title} active="post"><article className="kadik-section kadik-container kadik-article">
    <div className="kadik-article-meta">{post.category.toLocaleUpperCase("tr")} · {post.dateLabel} · {post.author.toLocaleUpperCase("tr")}</div>
    <img className="kadik-article-image" src={post.image} alt="" />
    {post.excerpt && <p className="kadik-lead">{post.excerpt}</p>}
    <ArticleBlocks blocks={post.blocks} />
    <div className="kadik-article-tags">ETİKETLER: <span>{post.category.toLocaleUpperCase("tr")}</span><span>KADİK</span><span>İŞ DÜNYASI</span></div>
  </article></Shell>;
}

/** Global 404 yüzeyi: aynı başlık/banner/footer kabuğunu kullanır, ziyaretçiyi
 * ana sayfa ve gerçek site bölümlerine geri bağlar (`app/not-found.tsx`). */
export function KadikNotFound() {
  return <Shell title="Sayfa Bulunamadı" active="notfound"><section className="kadik-section kadik-container kadik-404">
    <div>
      <p className="kadik-404-code">404</p>
      <h2>Aradığınız sayfaya ulaşamadık.</h2>
      <p>Bağlantı taşınmış, adresi değişmiş ya da yayından kaldırılmış olabilir. Konsey içeriklerine aşağıdaki bölümlerden ulaşabilir, aradığınızı bulamazsanız sekreteryaya yazabilirsiniz.</p>
      <div className="kadik-404-actions"><Button href="/" tone="red">Ana sayfaya dön</Button><Button href="/iletisim" tone="light">İletişime geçin</Button></div>
    </div>
    <nav className="kadik-404-links" aria-label="Site bölümleri">
      <Link href="/hakkimizda"><strong>Hakkımızda</strong><span>Konseyin vizyonu, çalışma alanları ve hikâyesi.</span></Link>
      <Link href="/kurul-uyeleri"><strong>Kurul Üyeleri</strong><span>Yönetim kurulu ve sektör temsilcilerimiz.</span></Link>
      <Link href="/yazilar"><strong>Yayınlar</strong><span>Haberler, makaleler ve konsey değerlendirmeleri.</span></Link>
      <Link href="/etkinlikler"><strong>Etkinlikler</strong><span>Toplantı, panel ve program takvimi.</span></Link>
      <Link href="/uyelik"><strong>Üyelik Başvurusu</strong><span>Konsey ailesine katılmak için başvuru formu.</span></Link>
      <Link href="/galeri"><strong>Galeri</strong><span>Faaliyetlerimizden fotoğraf seçkisi.</span></Link>
    </nav>
  </section></Shell>;
}

export function KadikContact() { return <Shell title="İletişim" active="contact"><section className="kadik-section kadik-container"><div className="kadik-contact-grid"><div><SectionHeading eyebrow="KONSEY SEKRETERYASI" title="İş birliğini konuşalım." /><p>Üyelik, sektör kurulları, etkinlikler ve uluslararası iş bağlantıları hakkında bize ulaşın.</p><div className="kadik-contact-items"><p><b>Adres</b>İstanbul, Türkiye</p><p><b>Telefon</b>+90 (212) 000 00 00</p><p><b>E-posta</b>merhaba@kadik.org</p></div></div><ContactForm /></div></section></Shell>; }

export function KadikGallery() {
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tümü");
  const dialog = useRef<HTMLDialogElement>(null);
  const categories = ["Etkinlikler", "Toplantılar", "İş Gezileri"];
  useEffect(() => {
    if (!active) return;
    const node = dialog.current;
    node?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { node?.close(); document.body.style.overflow = previous; };
  }, [active]);
  return <Shell title="Galeri" active="gallery"><section className="kadik-section kadik-container">
    <div className="kadik-gallery-filter">{["Tümü", ...categories].map((category) => <button key={category} aria-pressed={filter === category} className={filter === category ? "is-selected" : ""} onClick={() => setFilter(category)}>{category}</button>)}</div>
    <div className="kadik-gallery-grid">{images.gallery.map((image, i) => ({ image, index: i, category: categories[i % categories.length] })).filter((item) => filter === "Tümü" || item.category === filter).map(({ image, index, category }) => <button key={image} aria-label={`${category} görseli ${index + 1} büyüt`} onClick={() => setActive(image)}><img src={image} alt={`KADIK ${category.toLocaleLowerCase("tr")} ${index + 1}`} /><span>0{index + 1}</span></button>)}</div>
  </section><dialog ref={dialog} className="kadik-lightbox" aria-label="Galeri görseli" onCancel={() => setActive(null)} onClick={(event) => { if (event.target === event.currentTarget) setActive(null); }}>
    <button autoFocus aria-label="Kapat" onClick={() => setActive(null)}>×</button>{active && <img src={active} alt="Büyütülmüş galeri görseli" />}
  </dialog></Shell>;
}

const legalSections = [["1. Giriş", "Kybele ve KADİK olarak kişisel verilerinizin korunmasına önem veriyoruz. Bu metin, web sitemizi kullanırken hangi bilgilerin toplandığını ve nasıl kullanıldığını açıklar."], ["2. Toplanan veriler", "İletişim ve üyelik formlarında paylaştığınız bilgiler yalnızca talebinizi karşılamak ve sizinle iletişim kurmak amacıyla işlenir."], ["3. Saklama ve güvenlik", "Veriler yetkisiz erişime karşı korunan sistemlerde, gerekli olduğu süre boyunca saklanır. Yasal yükümlülükler dışında üçüncü kişilerle paylaşılmaz."], ["4. Haklarınız", "Kişisel verilerinize erişme, düzeltme, silme ve işlemeye itiraz etme hakkına sahipsiniz. Talepleriniz için merhaba@kadik.org adresinden bize ulaşabilirsiniz."]];
export function KadikLegal({ terms = false }: { terms?: boolean }) { return <Shell title={terms ? "Kullanım Koşulları" : "Gizlilik Politikası"} active={terms ? "terms" : "privacy"}><section className="kadik-section kadik-container kadik-legal"><p className="kadik-lead">Bu metin, Kybele ve KADİK web sitesini kullanırken haklarınızı ve sorumluluklarınızı açıklar.</p>{(terms ? [["1. Hizmetin kullanımı", "Siteyi yalnızca hukuka uygun amaçlarla kullanmayı kabul edersiniz. İçerikleri izinsiz çoğaltamaz, site güvenliğini tehlikeye atacak girişimlerde bulunamazsınız."], ["2. İçerik ve bağlantılar", "Sitedeki içerikler bilgilendirme amacıyla sunulur. Harici bağlantıların içeriklerinden Kybele ve KADİK sorumlu değildir."], ["3. Değişiklikler", "Koşullar gerektiğinde güncellenebilir. Güncel metin bu sayfada yayınlanır."]] : legalSections).map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}</section></Shell>; }
