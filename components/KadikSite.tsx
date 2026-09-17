"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KadikMotion } from "./KadikMotion";

const ASSET_ROOT = "/kadik";
const images = {
  hero: `${ASSET_ROOT}/post-6-copyright.jpg`,
  about: `${ASSET_ROOT}/post-6-copyright-1170x858.jpg`,
  campaign: `${ASSET_ROOT}/post-1-copyright.jpg`,
  gallery: [
    `${ASSET_ROOT}/post-12-copyright.jpg`,
    `${ASSET_ROOT}/post-10-copyright.jpg`,
    `${ASSET_ROOT}/post-11-copyright.jpg`,
    `${ASSET_ROOT}/post-7-copyright.jpg`,
    `${ASSET_ROOT}/post-6-copyright.jpg`,
    `${ASSET_ROOT}/post-5-copyright.jpg`,
    `${ASSET_ROOT}/post-4-copyright.jpg`,
    `${ASSET_ROOT}/post-3-copyright.jpg`,
    `${ASSET_ROOT}/post-1-copyright.jpg`,
  ],
};

type PageKey = "home" | "about" | "events" | "volunteer" | "issues" | "posts" | "post" | "contact" | "gallery" | "privacy" | "terms";

const navItems = [
  { label: "Anasayfa", href: "/", key: "home" },
  { label: "Hakkımızda", href: "/hakkimizda", key: "about" },
  {
    label: "Hizmetler",
    href: "/etkinlikler",
    key: "services",
    children: [
      { label: "Etkinlikler", href: "/etkinlikler" },
      { label: "Gönüllülük", href: "/gonulluluk" },
      { label: "Duyurular", href: "/duyurular" },
    ],
  },
  {
    label: "Yazılar",
    href: "/yazilar",
    key: "posts",
    children: [
      { label: "Makaleler", href: "/yazilar?kategori=makale" },
      { label: "Haberler", href: "/yazilar?kategori=haber" },
      { label: "Blog", href: "/yazilar?kategori=blog" },
    ],
  },
  { label: "Galeri", href: "/galeri", key: "gallery" },
  { label: "İletişim", href: "/iletisim", key: "contact" },
] as const;

const posts = [
  { category: "HABER", date: "24 Ekim 2026", title: "Vergi dolandırıcılığıyla mücadelede en başarılı yöntemler nelerdir?", image: `${ASSET_ROOT}/post-1-copyright.jpg`, href: "/what-are-the-most-successful-methods-to-fight-against-tax-scam" },
  { category: "MAKALE", date: "20 Ekim 2026", title: "Birlikte kuracağımız güçlü yarınlar", image: `${ASSET_ROOT}/post-3-copyright-760x428.jpg`, href: "/yazilar" },
  { category: "BLOG", date: "12 Ekim 2026", title: "Mahallelerimizde dayanışmayı büyütüyoruz", image: `${ASSET_ROOT}/post-4-copyright-760x428.jpg`, href: "/yazilar" },
  { category: "HABER", date: "04 Ekim 2026", title: "Gönüllü ağımız her gün genişliyor", image: `${ASSET_ROOT}/post-6-copyright.jpg`, href: "/yazilar" },
];

function Button({ href = "#", children, tone = "blue" }: { href?: string; children: React.ReactNode; tone?: "blue" | "red" | "light" }) {
  return <Link className={`kadik-button kadik-button-${tone}`} href={href}>{children}<span aria-hidden="true">↗</span></Link>;
}

function ContactForm({ compact = false, volunteer = false }: { compact?: boolean; volunteer?: boolean }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/kadik/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: form.get("name") || "Kampanya ziyaretçisi", email: form.get("email"), phone: form.get("phone"), subject: volunteer ? `Gönüllülük başvurusu: ${form.get("subject") || "Genel"}` : form.get("subject"), message: form.get("message") || "Kampanya formu", consent: form.get("consent") === "on",
      }) });
      setStatus(response.ok ? "Mesajınız alındı. Ekibimiz en kısa sürede size dönecek." : "Form gönderilemedi. Lütfen daha sonra tekrar deneyin.");
      if (response.ok) formElement.reset();
    } catch { setStatus("Form gönderilemedi. Lütfen daha sonra tekrar deneyin."); }
    setBusy(false);
  }
  return <form className={`kadik-form ${compact ? "kadik-form-compact" : ""}`} onSubmit={submit}>
    {compact && <input required type="email" name="email" placeholder="E-posta adresiniz" />}
    {!compact && <div className="kadik-form-grid"><input required name="name" placeholder="Adınız Soyadınız" /><input required type="email" name="email" placeholder="E-posta adresiniz" /></div>}
    {volunteer && <div className="kadik-form-grid"><input name="phone" placeholder="Telefon numaranız" /><select name="subject" defaultValue=""><option value="" disabled>Nasıl katkı sunabilirsiniz?</option><option>Kapı kapı çalışma</option><option>Telefon görüşmeleri</option><option>Etkinlik düzenleme</option><option>Diğer</option></select></div>}
    {!compact && !volunteer && <input name="subject" placeholder="Konu" />}
    {!compact && <textarea required name="message" rows={5} placeholder={volunteer ? "Bize kendinizden bahsedin" : "Mesajınız"} />}
    <label className="kadik-consent"><input required type="checkbox" name="consent" /> <span>Gönderdiğim bilgilerin saklanmasını ve benimle iletişime geçilmesini kabul ediyorum.</span></label>
    <button className="kadik-button kadik-button-red" disabled={busy}>{busy ? "Gönderiliyor…" : volunteer ? "Gönüllü Ol" : compact ? "Kampanyaya Katıl" : "Mesaj Gönder"}<span aria-hidden="true">↗</span></button>
    {status && <p className="kadik-form-status" role="status">{status}</p>}
  </form>;
}

function Header({ active }: { active: PageKey }) {
  const [open, setOpen] = useState(false);
  const isServicesPage = ["events", "volunteer", "issues"].includes(active);
  return <header className="kadik-header">
    <div className="kadik-header-inner">
      <Link href="/" className="kadik-logo"><span className="kadik-brand-mark" aria-hidden="true">✦</span><span className="kadik-brand-text">KADIK</span></Link>
      <nav className="kadik-nav" aria-label="Ana menü">{navItems.map((item) => <div className="kadik-nav-item" key={item.href}>
        <Link className={active === item.key || (item.key === "services" && isServicesPage) ? "is-active" : ""} href={item.href}>{item.label}</Link>
        {"children" in item && <div className="kadik-dropdown">{item.children.map((child) => <Link key={child.href} href={child.href}>{child.label}</Link>)}</div>}
      </div>)}</nav>
      <button className="kadik-menu-button" onClick={() => setOpen(!open)} aria-label="Menüyü aç" aria-expanded={open}><span /><span /><span /></button>
    </div>
    {open && <nav className="kadik-mobile-nav" aria-label="Mobil menü">{navItems.map((item) => <div key={item.href}>
      <Link className={active === item.key || (item.key === "services" && isServicesPage) ? "is-active" : ""} href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
      {"children" in item && item.children.map((child) => <Link className="kadik-mobile-child" key={child.href} href={child.href} onClick={() => setOpen(false)}>{child.label}</Link>)}
    </div>)}</nav>}
  </header>;
}

function Footer() {
  return <footer className="kadik-footer"><div className="kadik-footer-grid">
    <div><div className="kadik-footer-logo"><span className="kadik-brand-mark" aria-hidden="true">✦</span><span className="kadik-brand-text">KADIK</span></div><p>Birlikte daha adil, özgür ve dayanışmacı bir gelecek kuruyoruz.</p></div>
    <div><h3>Hızlı Erişim</h3><Link href="/hakkimizda">Hakkımızda</Link><Link href="/etkinlikler">Etkinlikler</Link><Link href="/gonulluluk">Gönüllülük</Link><Link href="/duyurular">Duyurular</Link></div>
    <div><h3>İletişim</h3><p>İstanbul, Türkiye</p><Link href="tel:+902120000000">+90 (212) 000 00 00</Link><Link href="mailto:merhaba@kadik.org">merhaba@kadik.org</Link></div>
    <div><h3>Bizi Takip Edin</h3><p className="kadik-socials"><Link href="#facebook">f</Link><Link href="#youtube">▶</Link><Link href="#x">𝕏</Link></p><Button href="/iletisim">Bize Ulaşın</Button></div>
  </div><div className="kadik-footer-bottom"><span>© 2026 Kadık. Tüm hakları saklıdır.</span><span><Link href="/gizlilik-politikasi">Gizlilik</Link><Link href="/kullanim-sartlari">Kullanım Koşulları</Link></span></div></footer>;
}

function Banner({ title, active }: { title: string; active: PageKey }) {
  return <><Header active={active} /><section className="kadik-banner"><div className="kadik-banner-overlay" /><div className="kadik-container kadik-banner-content"><h1>{title}</h1><p><Link href="/">ANASAYFA</Link><span>›</span>{title.toUpperCase()}</p></div></section></>;
}

function Shell({ children, title, active }: { children: React.ReactNode; title: string; active: PageKey }) {
  return <KadikMotion><Banner title={title} active={active} /><main>{children}</main><Footer /></KadikMotion>;
}

function SectionHeading({ eyebrow, title }: { eyebrow?: string; title: string }) { return <div className="kadik-section-heading">{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>; }

export function KadikHome() {
  return <KadikMotion><Header active="home" /><main>
    <section className="kadik-hero"><div className="kadik-hero-overlay" /><div className="kadik-hero-content"><h1>Değişim için<br />birlikteyiz</h1><p>Yan yana, omuz omuza.</p><ContactForm compact /></div></section>
    <section className="kadik-section kadik-intro kadik-container"><div><SectionHeading eyebrow="BİZİMLE TANIŞIN" title="Geleceğe birlikte yön verelim." /></div><div><p className="kadik-lead">Çalışanların kendini güvende hissettiği, gençlerin fırsatlara ulaştığı ve her komşumuzun söz sahibi olduğu bir şehir için çalışıyoruz.</p><p>Dayanışmayı büyütmek için mahallelerde buluşuyor, sorunları birlikte dinliyor ve kalıcı çözümleri birlikte hayata geçiriyoruz.</p><Button href="/hakkimizda">Hikâyemizi keşfet</Button></div></section>
    <section className="kadik-section kadik-dark-section"><div className="kadik-container"><SectionHeading eyebrow="ÖNCELİKLERİMİZ" title="Sesimizi birleştirerek değişimi büyütüyoruz." /><div className="kadik-card-grid kadik-card-grid-3">{["Adil ve güvenli çalışma", "Eğitimde fırsat eşitliği", "Yaşanabilir mahalleler"].map((title, i) => <article className="kadik-principle-card" key={title}><span>0{i + 1}</span><h3>{title}</h3><p>Her kararın merkezine insanı ve dayanışmayı koyuyoruz.</p><Link href="/duyurular">Detayları gör ↗</Link></article>)}</div></div></section>
    <section className="kadik-image-band" style={{ backgroundImage: `url(${images.campaign})` }}><div className="kadik-image-band-overlay" /><div className="kadik-container"><h2>Birlikte daha güçlü,<br />birlikte daha özgür.</h2><Button href="/gonulluluk" tone="red">Gönüllü ol</Button></div></section>
    <section className="kadik-section kadik-container"><SectionHeading eyebrow="GÜNCEL" title="Sahadan notlar" /><div className="kadik-post-grid">{posts.slice(0, 3).map((post) => <PostCard key={post.title} post={post} />)}</div><div className="kadik-center"><Button href="/yazilar">Tüm yazılar</Button></div></section>
  </main><Footer /></KadikMotion>;
}

function PostCard({ post }: { post: typeof posts[number] }) { return <article className="kadik-post-card"><Link href={post.href}><img src={post.image} alt="" /><div className="kadik-post-card-body"><span>{post.category} · {post.date}</span><h3>{post.title}</h3><p>Birlikte düşünmek, birlikte üretmek ve birlikte değiştirmek için…</p><b>Devamını oku ↗</b></div></Link></article>; }

export function KadikAbout() { return <Shell title="Hakkımızda" active="about"><section className="kadik-section kadik-container kadik-two-col"><div><SectionHeading title="Yeni bir yön seçiyoruz." /></div><div><p className="kadik-lead">Çocuklarımızın iyi eğitim aldığı, yaşlılarımızın güvende olduğu, herkes için sağlıklı ve müreffeh bir toplum için çalışıyoruz.</p><p>İnandığımız değişim, yalnızca seçim günlerinde değil; her gün mahallelerde, iş yerlerinde ve hayatın içinde kurulur.</p><Button href="/gonulluluk">Bize katıl</Button></div></section><section className="kadik-container"><img className="kadik-wide-image" src={images.about} alt="Birlikte çalışan gönüllüler" /></section><section className="kadik-section kadik-stats"><div className="kadik-container"><SectionHeading eyebrow="RAKAMLARLA" title="Birlikte başardıklarımız" /><div className="kadik-stat-grid">{[["18", "Mahalle buluşması"], ["42", "Gönüllü ekip"], ["12", "Sosyal proje"], ["7", "Yıllık deneyim"]].map(([number, label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}</div></div></section><section className="kadik-section kadik-container"><SectionHeading eyebrow="HİKÂYEMİZ" title="Dünden bugüne dayanışma" /><div className="kadik-timeline">{[["2019", "İlk mahalle buluşmaları", "Komşularımızın sesini dinlemek için yola çıktık."], ["2022", "Gönüllü ağımız büyüdü", "Farklı alanlarda çalışan ekiplerimizi bir araya getirdik."], ["2026", "Yeni bir dönem", "Şehrin her köşesinde birlikte üretmeye devam ediyoruz."]].map(([year, title, text]) => <article key={year}><span>{year}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section></Shell>; }

const calendarEvents = [
  { date: "2026-09-01", title: "Gönüllü buluşması" },
  { date: "2026-09-02", title: "Birlikte değiştiriyoruz" },
  { date: "2026-09-17", title: "Mahalle dayanışma buluşması" },
  { date: "2026-09-26", title: "Gönüllü ekip çalışması" },
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
      {found.filter((event) => event.date === dateKey(date)).map((event) => <Link key={event.title} href="/gonulluluk">{event.title}</Link>)}
    </div>)}</div></div> : <div className="kadik-event-list">{list.map((event) => <article key={event.date + event.title}><time dateTime={event.date}>{event.date}</time><h2>{event.title}</h2><Button href="/gonulluluk">Katıl</Button></article>)}{list.length === 0 && <p role="status">Bu tarih için etkinlik bulunamadı.</p>}</div>}
  </section></Shell>;
}

export function KadikVolunteer() { return <Shell title="Gönüllülük" active="volunteer"><section className="kadik-section kadik-container kadik-volunteer"><div><SectionHeading title="Bize katılın!" /><p className="kadik-lead">Kampanyamızda yer almak için formu doldurun.</p><p>Birlikte kapı kapı çalışabilir, etkinlikler düzenleyebilir, fikirlerinizi paylaşabilirsiniz.</p></div><ContactForm volunteer /></section></Shell>; }

const issues = ["İş ve ekonomi", "Sağlık ve sosyal güvence", "Çevre", "Bütçe ve adalet", "Güvenli mahalleler", "Gaziler", "Eğitim", "Kadınların eşitliği"];
export function KadikIssues() { return <Shell title="Duyurular" active="issues"><section className="kadik-section kadik-container"><SectionHeading eyebrow="ÖNCELİKLER" title="Değişim için ilkelerimiz" /><p className="kadik-intro-copy">Şehrimizin geleceğine dair kararları şeffaflık, dayanışma ve ortak akılla alıyoruz.</p><div className="kadik-issue-grid">{issues.map((issue, i) => <article key={issue}><span>0{i + 1}</span><h3>{issue}</h3><p>Herkes için daha adil ve yaşanabilir bir hayat kurmak için somut adımlar.</p><Link href="/iletisim">Daha fazla bilgi ↗</Link></article>)}</div></section><section className="kadik-cta-band"><div className="kadik-container"><h2>Değişim için desteğine ihtiyacımız var.</h2><Button href="/gonulluluk" tone="red">Şimdi katıl</Button></div></section></Shell>; }

export function KadikPosts({ initialCategory }: { initialCategory?: string }) {
  const categories: Record<string, string> = { makale: "Makale", haber: "Haber", blog: "Blog" };
  const [filter, setFilter] = useState(categories[initialCategory ?? ""] ?? "Tümü");
  const [search, setSearch] = useState("");
  const visible = posts.filter((post) => (filter === "Tümü" || post.category === filter.toLocaleUpperCase("tr")) && post.title.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")));
  return <Shell title="Yazılar" active="posts"><section className="kadik-section kadik-container"><div className="kadik-posts-layout"><div>
    <div className="kadik-filter-row"><span>Yazı türü:</span>{["Tümü", "Makale", "Haber", "Blog"].map((item) => <button aria-pressed={filter === item} className={filter === item ? "is-selected" : ""} key={item} onClick={() => {
      setFilter(item);
      const url = new URL(window.location.href);
      if (item === "Tümü") url.searchParams.delete("kategori"); else url.searchParams.set("kategori", item.toLocaleLowerCase("tr"));
      window.history.replaceState(null, "", url);
    }}>{item}</button>)}</div>
    <div className="kadik-list-posts">{visible.map((post) => <PostCard key={post.title} post={post} />)}{visible.length === 0 && <p role="status">Aramanıza uygun yazı bulunamadı.</p>}</div>
    </div><aside className="kadik-sidebar"><div><h3>Arama</h3><input aria-label="Yazılarda ara" placeholder="Ara…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div><h3>Kategoriler</h3>{Object.entries(categories).map(([key, label]) => <Link key={key} href={`/yazilar?kategori=${key}`}>{label} ({posts.filter((post) => post.category === label.toLocaleUpperCase("tr")).length})</Link>)}<Link href="/duyurular">Duyurular</Link></div></aside></div></section></Shell>;
}

export function KadikPostDetail() { return <Shell title="Vergi dolandırıcılığıyla mücadelede en başarılı yöntemler nelerdir?" active="post"><article className="kadik-section kadik-container kadik-article"><div className="kadik-article-meta">HABER · 24 EKİM 2026 · KADIK EKİBİ · 3 YORUM</div><img className="kadik-article-image" src={posts[0].image} alt="" /><p className="kadik-lead">Güvenilir bilgiye erişim, dayanışma ve şeffaflık; dolandırıcılığa karşı en güçlü savunmamızdır.</p>{["Birlikte fark ediyoruz", "Bilgiyle güçleniyoruz", "Komşularımızı koruyoruz"].map((heading) => <section key={heading}><h2>{heading}</h2><p>Toplumun her kesiminin doğru bilgiye ulaşabildiği, sorularını çekinmeden sorabildiği ve ihtiyaç duyduğunda destek alabildiği bir düzen için çalışıyoruz. Şüpheli bir durumla karşılaştığınızda resmi kanalları kullanın, doğrulanmamış bilgileri paylaşmayın ve çevrenizdekileri bilgilendirin.</p></section>)}<div className="kadik-article-tags">ETİKETLER: <span>HABER</span><span>TOPLUM</span><span>DAYANIŞMA</span></div></article></Shell>; }

export function KadikContact() { return <Shell title="İletişim" active="contact"><section className="kadik-section kadik-container"><div className="kadik-contact-grid"><div><SectionHeading title="Bize ulaşın" /><p>Fikirlerinizi, sorularınızı ve önerilerinizi dinlemek için buradayız.</p><div className="kadik-contact-items"><p><b>Adres</b>İstanbul, Türkiye</p><p><b>Telefon</b>+90 (212) 000 00 00</p><p><b>E-posta</b>merhaba@kadik.org</p></div></div><ContactForm /></div></section></Shell>; }

export function KadikGallery() {
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tümü");
  const dialog = useRef<HTMLDialogElement>(null);
  const categories = ["Meydanlar", "Gönüllüler", "Etkinlikler"];
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

const legalSections = [["1. Giriş", "Kadık olarak kişisel verilerinizin korunmasına önem veriyoruz. Bu metin, web sitemizi kullanırken hangi bilgilerin toplandığını ve nasıl kullanıldığını açıklar."], ["2. Toplanan veriler", "İletişim formlarında paylaştığınız ad, e-posta, telefon ve mesaj bilgileri yalnızca talebinizi karşılamak ve sizinle iletişim kurmak amacıyla işlenir."], ["3. Saklama ve güvenlik", "Veriler yetkisiz erişime karşı korunan sistemlerde, gerekli olduğu süre boyunca saklanır. Yasal yükümlülükler dışında üçüncü kişilerle paylaşılmaz."], ["4. Haklarınız", "Kişisel verilerinize erişme, düzeltme, silme ve işlemeye itiraz etme hakkına sahipsiniz. Talepleriniz için merhaba@kadik.org adresinden bize ulaşabilirsiniz."]];
export function KadikLegal({ terms = false }: { terms?: boolean }) { return <Shell title={terms ? "Kullanım Koşulları" : "Gizlilik Politikası"} active={terms ? "terms" : "privacy"}><section className="kadik-section kadik-container kadik-legal"><p className="kadik-lead">Bu metin, Kadık web sitesini kullanırken haklarınızı ve sorumluluklarınızı açıklar.</p>{(terms ? [["1. Hizmetin kullanımı", "Siteyi yalnızca hukuka uygun amaçlarla kullanmayı kabul edersiniz. İçerikleri izinsiz çoğaltamaz, site güvenliğini tehlikeye atacak girişimlerde bulunamazsınız."], ["2. İçerik ve bağlantılar", "Sitedeki içerikler bilgilendirme amacıyla sunulur. Harici bağlantıların içeriklerinden Kadık sorumlu değildir."], ["3. Değişiklikler", "Koşullar gerektiğinde güncellenebilir. Güncel metin bu sayfada yayınlanır."]] : legalSections).map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}</section></Shell>; }
