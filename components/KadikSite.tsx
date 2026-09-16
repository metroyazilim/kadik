"use client";

import { FormEvent, useMemo, useState } from "react";

const ASSET_ROOT = "https://partiso.axiomthemes.com/wp-content/uploads/2018/10";
const images = {
  logo: `${ASSET_ROOT}/logo.png`,
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
  { label: "Etkinlikler", href: "/etkinlikler", key: "events" },
  { label: "Gönüllülük", href: "/gonulluluk", key: "volunteer" },
  { label: "Duyurular", href: "/duyurular", key: "issues" },
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
  return <a className={`kadik-button kadik-button-${tone}`} href={href}>{children}<span aria-hidden="true">↗</span></a>;
}

function ContactForm({ compact = false, volunteer = false }: { compact?: boolean; volunteer?: boolean }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/kadik/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: form.get("name") || "Kampanya ziyaretçisi", email: form.get("email"), phone: form.get("phone"), subject: volunteer ? "Gönüllülük başvurusu" : form.get("subject"), message: form.get("message") || "Kampanya formu", kind: volunteer ? "volunteer" : "contact",
      }) });
      setStatus(response.ok ? "Mesajınız alındı. Ekibimiz en kısa sürede size dönecek." : "Form gönderilemedi. Lütfen daha sonra tekrar deneyin.");
      if (response.ok) event.currentTarget.reset();
    } catch { setStatus("Form gönderilemedi. Lütfen daha sonra tekrar deneyin."); }
    setBusy(false);
  }
  return <form className={`kadik-form ${compact ? "kadik-form-compact" : ""}`} onSubmit={submit}>
    {compact && <input required type="email" name="email" placeholder="E-posta adresiniz" />}
    {!compact && <div className="kadik-form-grid"><input required name="name" placeholder="Adınız Soyadınız" /><input required type="email" name="email" placeholder="E-posta adresiniz" /></div>}
    {volunteer && <div className="kadik-form-grid"><input name="phone" placeholder="Telefon numaranız" /><select name="subject" defaultValue=""><option value="" disabled>Nasıl katkı sunabilirsiniz?</option><option>Kapı kapı çalışma</option><option>Telefon görüşmeleri</option><option>Etkinlik düzenleme</option><option>Diğer</option></select></div>}
    {!compact && !volunteer && <input name="subject" placeholder="Konu" />}
    {!compact && <textarea required name="message" rows={5} placeholder={volunteer ? "Bize kendinizden bahsedin" : "Mesajınız"} />}
    <label className="kadik-consent"><input required type="checkbox" /> <span>Gönderdiğim bilgilerin saklanmasını ve benimle iletişime geçilmesini kabul ediyorum.</span></label>
    <button className="kadik-button kadik-button-red" disabled={busy}>{busy ? "Gönderiliyor…" : volunteer ? "Gönüllü Ol" : compact ? "Kampanyaya Katıl" : "Mesaj Gönder"}<span aria-hidden="true">↗</span></button>
    {status && <p className="kadik-form-status" role="status">{status}</p>}
  </form>;
}

function Header({ active }: { active: PageKey }) {
  const [open, setOpen] = useState(false);
  return <header className="kadik-header">
    <div className="kadik-header-inner">
      <a href="/" className="kadik-logo"><span className="kadik-brand-mark" aria-hidden="true">✦</span><span className="kadik-brand-text">KADIK</span></a>
      <nav className="kadik-nav" aria-label="Ana menü">{navItems.map((item) => <div className="kadik-nav-item" key={item.href}>
        <a className={active === item.key ? "is-active" : ""} href={item.href}>{item.label}</a>
        {"children" in item && <div className="kadik-dropdown">{item.children.map((child) => <a key={child.href} href={child.href}>{child.label}</a>)}</div>}
      </div>)}</nav>
      <Button href="/gonulluluk">Katıl</Button>
      <button className="kadik-menu-button" onClick={() => setOpen(!open)} aria-label="Menüyü aç" aria-expanded={open}><span /><span /><span /></button>
    </div>
    {open && <nav className="kadik-mobile-nav" aria-label="Mobil menü">{navItems.map((item) => <div key={item.href}>
      <a className={active === item.key ? "is-active" : ""} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>
      {"children" in item && item.children.map((child) => <a className="kadik-mobile-child" key={child.href} href={child.href} onClick={() => setOpen(false)}>{child.label}</a>)}
    </div>)}</nav>}
  </header>;
}

function Footer() {
  return <footer className="kadik-footer"><div className="kadik-footer-grid">
    <div><div className="kadik-footer-logo"><span className="kadik-brand-mark" aria-hidden="true">✦</span><span className="kadik-brand-text">KADIK</span></div><p>Birlikte daha adil, özgür ve dayanışmacı bir gelecek kuruyoruz.</p></div>
    <div><h3>Hızlı Erişim</h3><a href="/hakkimizda">Hakkımızda</a><a href="/etkinlikler">Etkinlikler</a><a href="/gonulluluk">Gönüllülük</a><a href="/duyurular">Duyurular</a></div>
    <div><h3>İletişim</h3><p>İstanbul, Türkiye</p><a href="tel:+902120000000">+90 (212) 000 00 00</a><a href="mailto:merhaba@kadik.org">merhaba@kadik.org</a></div>
    <div><h3>Bizi Takip Edin</h3><p className="kadik-socials"><a href="#facebook">f</a><a href="#youtube">▶</a><a href="#x">𝕏</a></p><Button href="/iletisim">Bize Ulaşın</Button></div>
  </div><div className="kadik-footer-bottom"><span>© 2026 Kadık. Tüm hakları saklıdır.</span><span><a href="/gizlilik-politikasi">Gizlilik</a><a href="/kullanim-kosullari">Kullanım Koşulları</a></span></div></footer>;
}

function Banner({ title, active }: { title: string; active: PageKey }) {
  return <><Header active={active} /><section className="kadik-banner"><div className="kadik-banner-overlay" /><div className="kadik-container kadik-banner-content"><h1>{title}</h1><p><a href="/">ANASAYFA</a><span>›</span>{title.toUpperCase()}</p></div></section></>;
}

function Shell({ children, title, active }: { children: React.ReactNode; title: string; active: PageKey }) {
  return <><Banner title={title} active={active} /><main>{children}</main><Footer /></>;
}

function SectionHeading({ eyebrow, title }: { eyebrow?: string; title: string }) { return <div className="kadik-section-heading">{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>; }

export function KadikHome() {
  return <><Header active="home" /><main>
    <section className="kadik-hero"><div className="kadik-hero-overlay" /><div className="kadik-hero-content"><h1>Değişim için<br />birlikteyiz</h1><p>Yan yana, omuz omuza.</p><ContactForm compact /></div></section>
    <section className="kadik-section kadik-intro kadik-container"><div><SectionHeading eyebrow="BİZİMLE TANIŞIN" title="Geleceğe birlikte yön verelim." /></div><div><p className="kadik-lead">Çalışanların kendini güvende hissettiği, gençlerin fırsatlara ulaştığı ve her komşumuzun söz sahibi olduğu bir şehir için çalışıyoruz.</p><p>Dayanışmayı büyütmek için mahallelerde buluşuyor, sorunları birlikte dinliyor ve kalıcı çözümleri birlikte hayata geçiriyoruz.</p><Button href="/hakkimizda">Hikâyemizi keşfet</Button></div></section>
    <section className="kadik-section kadik-dark-section"><div className="kadik-container"><SectionHeading eyebrow="ÖNCELİKLERİMİZ" title="Sesimizi birleştirerek değişimi büyütüyoruz." /><div className="kadik-card-grid kadik-card-grid-3">{["Adil ve güvenli çalışma", "Eğitimde fırsat eşitliği", "Yaşanabilir mahalleler"].map((title, i) => <article className="kadik-principle-card" key={title}><span>0{i + 1}</span><h3>{title}</h3><p>Her kararın merkezine insanı ve dayanışmayı koyuyoruz.</p><a href="/duyurular">Detayları gör ↗</a></article>)}</div></div></section>
    <section className="kadik-image-band" style={{ backgroundImage: `url(${images.campaign})` }}><div className="kadik-image-band-overlay" /><div className="kadik-container"><h2>Birlikte daha güçlü,<br />birlikte daha özgür.</h2><Button href="/gonulluluk" tone="red">Gönüllü ol</Button></div></section>
    <section className="kadik-section kadik-container"><SectionHeading eyebrow="GÜNCEL" title="Sahadan notlar" /><div className="kadik-post-grid">{posts.slice(0, 3).map((post) => <PostCard key={post.title} post={post} />)}</div><div className="kadik-center"><Button href="/yazilar">Tüm yazılar</Button></div></section>
  </main><Footer /></>;
}

function PostCard({ post }: { post: typeof posts[number] }) { return <article className="kadik-post-card"><a href={post.href}><img src={post.image} alt="" /><div className="kadik-post-card-body"><span>{post.category} · {post.date}</span><h3>{post.title}</h3><p>Birlikte düşünmek, birlikte üretmek ve birlikte değiştirmek için…</p><b>Devamını oku ↗</b></div></a></article>; }

export function KadikAbout() { return <Shell title="Hakkımızda" active="about"><section className="kadik-section kadik-container kadik-two-col"><div><SectionHeading title="Yeni bir yön seçiyoruz." /></div><div><p className="kadik-lead">Çocuklarımızın iyi eğitim aldığı, yaşlılarımızın güvende olduğu, herkes için sağlıklı ve müreffeh bir toplum için çalışıyoruz.</p><p>İnandığımız değişim, yalnızca seçim günlerinde değil; her gün mahallelerde, iş yerlerinde ve hayatın içinde kurulur.</p><Button href="/gonulluluk">Bize katıl</Button></div></section><section className="kadik-container"><img className="kadik-wide-image" src={images.about} alt="Birlikte çalışan gönüllüler" /></section><section className="kadik-section kadik-stats"><div className="kadik-container"><SectionHeading eyebrow="RAKAMLARLA" title="Birlikte başardıklarımız" /><div className="kadik-stat-grid">{[["18", "Mahalle buluşması"], ["42", "Gönüllü ekip"], ["12", "Sosyal proje"], ["7", "Yıllık deneyim"]].map(([number, label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}</div></div></section><section className="kadik-section kadik-container"><SectionHeading eyebrow="HİKÂYEMİZ" title="Dünden bugüne dayanışma" /><div className="kadik-timeline">{[["2019", "İlk mahalle buluşmaları", "Komşularımızın sesini dinlemek için yola çıktık."], ["2022", "Gönüllü ağımız büyüdü", "Farklı alanlarda çalışan ekiplerimizi bir araya getirdik."], ["2026", "Yeni bir dönem", "Şehrin her köşesinde birlikte üretmeye devam ediyoruz."]].map(([year, title, text]) => <article key={year}><span>{year}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section></Shell>; }

export function KadikEvents() { return <Shell title="Etkinlikler" active="events"><section className="kadik-section kadik-container"><div className="kadik-event-toolbar"><input placeholder="Etkinliklerde ara" /><button>Etkinlik bul</button><div><button>Liste</button><button className="is-selected">Ay</button><button>Gün</button></div></div><div className="kadik-calendar-head"><button>‹</button><button>›</button><button className="is-today">BU AY</button><strong>Eylül 2026</strong></div><div className="kadik-calendar"><div className="kadik-weekdays">{["P","S","Ç","P","C","C","P"].map((day, i) => <span key={i}>{day}</span>)}</div><div className="kadik-days">{Array.from({ length: 35 }, (_, i) => <div className="kadik-day" key={i}><b>{i < 1 ? 31 : i}</b>{[1, 2, 3, 4, 5, 6].includes(i) && <a href="/gonulluluk">Birlikte değiştiriyoruz</a>}{i === 1 && <a href="/gonulluluk">Gönüllü buluşması</a>}</div>)}</div></div></section></Shell>; }

export function KadikVolunteer() { return <Shell title="Gönüllülük" active="volunteer"><section className="kadik-section kadik-container kadik-volunteer"><div><SectionHeading title="Bize katılın!" /><p className="kadik-lead">Kampanyamızda yer almak için formu doldurun.</p><p>Birlikte kapı kapı çalışabilir, etkinlikler düzenleyebilir, fikirlerinizi paylaşabilirsiniz.</p></div><ContactForm volunteer /></section></Shell>; }

const issues = ["İş ve ekonomi", "Sağlık ve sosyal güvence", "Çevre", "Bütçe ve adalet", "Güvenli mahalleler", "Gaziler", "Eğitim", "Kadınların eşitliği"];
export function KadikIssues() { return <Shell title="Duyurular" active="issues"><section className="kadik-section kadik-container"><SectionHeading eyebrow="ÖNCELİKLER" title="Değişim için ilkelerimiz" /><p className="kadik-intro-copy">Şehrimizin geleceğine dair kararları şeffaflık, dayanışma ve ortak akılla alıyoruz.</p><div className="kadik-issue-grid">{issues.map((issue, i) => <article key={issue}><span>0{i + 1}</span><h3>{issue}</h3><p>Herkes için daha adil ve yaşanabilir bir hayat kurmak için somut adımlar.</p><a href="/iletisim">Daha fazla bilgi ↗</a></article>)}</div></section><section className="kadik-cta-band"><div className="kadik-container"><h2>Değişim için desteğine ihtiyacımız var.</h2><Button href="/gonulluluk" tone="red">Şimdi katıl</Button></div></section></Shell>; }

export function KadikPosts() { const [filter, setFilter] = useState("Tümü"); const visible = useMemo(() => filter === "Tümü" ? posts : posts.filter((post) => ({ Makale: "MAKALE", Haber: "HABER", Blog: "BLOG" }[filter] === post.category)), [filter]); return <Shell title="Yazılar" active="posts"><section className="kadik-section kadik-container"><div className="kadik-posts-layout"><div><div className="kadik-filter-row"><span>Yazı türü:</span>{["Tümü", "Makale", "Haber", "Blog"].map((item) => <button className={filter === item ? "is-selected" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="kadik-list-posts">{visible.map((post) => <PostCard key={post.title} post={post} />)}</div></div><aside className="kadik-sidebar"><div><h3>Arama</h3><input placeholder="Ara…" /></div><div><h3>Kategoriler</h3><a href="/yazilar?kategori=makale">Makaleler (6)</a><a href="/yazilar?kategori=haber">Haberler (12)</a><a href="/yazilar?kategori=blog">Blog (8)</a><a href="/duyurular">Duyurular (4)</a></div></aside></div></section></Shell>; }

export function KadikPostDetail() { return <Shell title="Vergi dolandırıcılığıyla mücadelede en başarılı yöntemler nelerdir?" active="post"><article className="kadik-section kadik-container kadik-article"><div className="kadik-article-meta">HABER · 24 EKİM 2026 · KADIK EKİBİ · 3 YORUM</div><img className="kadik-article-image" src={posts[0].image} alt="" /><p className="kadik-lead">Güvenilir bilgiye erişim, dayanışma ve şeffaflık; dolandırıcılığa karşı en güçlü savunmamızdır.</p>{["Birlikte fark ediyoruz", "Bilgiyle güçleniyoruz", "Komşularımızı koruyoruz"].map((heading) => <section key={heading}><h2>{heading}</h2><p>Toplumun her kesiminin doğru bilgiye ulaşabildiği, sorularını çekinmeden sorabildiği ve ihtiyaç duyduğunda destek alabildiği bir düzen için çalışıyoruz. Şüpheli bir durumla karşılaştığınızda resmi kanalları kullanın, doğrulanmamış bilgileri paylaşmayın ve çevrenizdekileri bilgilendirin.</p></section>)}<div className="kadik-article-tags">ETİKETLER: <span>HABER</span><span>TOPLUM</span><span>DAYANIŞMA</span></div></article></Shell>; }

export function KadikContact() { return <Shell title="İletişim" active="contact"><section className="kadik-section kadik-container"><div className="kadik-contact-grid"><div><SectionHeading title="Bize ulaşın" /><p>Fikirlerinizi, sorularınızı ve önerilerinizi dinlemek için buradayız.</p><div className="kadik-contact-items"><p><b>Adres</b>İstanbul, Türkiye</p><p><b>Telefon</b>+90 (212) 000 00 00</p><p><b>E-posta</b>merhaba@kadik.org</p></div></div><ContactForm /></div></section></Shell>; }

export function KadikGallery() { const [active, setActive] = useState<string | null>(null); return <Shell title="Galeri" active="gallery"><section className="kadik-section kadik-container"><div className="kadik-gallery-filter"><button className="is-selected">Tümü</button><button>Meydanlar</button><button>Gönüllüler</button><button>Etkinlikler</button></div><div className="kadik-gallery-grid">{images.gallery.map((image, i) => <button key={image} onClick={() => setActive(image)}><img src={image} alt={`Kadık etkinliği ${i + 1}`} /><span>0{i + 1}</span></button>)}</div></section>{active && <div className="kadik-lightbox" role="dialog" aria-modal="true" onClick={() => setActive(null)}><button aria-label="Kapat" onClick={() => setActive(null)}>×</button><img src={active} alt="Büyütülmüş galeri görseli" /></div>}</Shell>; }

const legalSections = [["1. Giriş", "Kadık olarak kişisel verilerinizin korunmasına önem veriyoruz. Bu metin, web sitemizi kullanırken hangi bilgilerin toplandığını ve nasıl kullanıldığını açıklar."], ["2. Toplanan veriler", "İletişim formlarında paylaştığınız ad, e-posta, telefon ve mesaj bilgileri yalnızca talebinizi karşılamak ve sizinle iletişim kurmak amacıyla işlenir."], ["3. Saklama ve güvenlik", "Veriler yetkisiz erişime karşı korunan sistemlerde, gerekli olduğu süre boyunca saklanır. Yasal yükümlülükler dışında üçüncü kişilerle paylaşılmaz."], ["4. Haklarınız", "Kişisel verilerinize erişme, düzeltme, silme ve işlemeye itiraz etme hakkına sahipsiniz. Talepleriniz için merhaba@kadik.org adresinden bize ulaşabilirsiniz."]];
export function KadikLegal({ terms = false }: { terms?: boolean }) { return <Shell title={terms ? "Kullanım Koşulları" : "Gizlilik Politikası"} active={terms ? "terms" : "privacy"}><section className="kadik-section kadik-container kadik-legal"><p className="kadik-lead">Bu metin, Kadık web sitesini kullanırken haklarınızı ve sorumluluklarınızı açıklar.</p>{(terms ? [["1. Hizmetin kullanımı", "Siteyi yalnızca hukuka uygun amaçlarla kullanmayı kabul edersiniz. İçerikleri izinsiz çoğaltamaz, site güvenliğini tehlikeye atacak girişimlerde bulunamazsınız."], ["2. İçerik ve bağlantılar", "Sitedeki içerikler bilgilendirme amacıyla sunulur. Harici bağlantıların içeriklerinden Kadık sorumlu değildir."], ["3. Değişiklikler", "Koşullar gerektiğinde güncellenebilir. Güncel metin bu sayfada yayınlanır."]] : legalSections).map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}</section></Shell>; }
