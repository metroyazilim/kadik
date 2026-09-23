import { KADIK_DICT, type KadikDictionary, type KadikImage } from "@/lib/kadik-i18n";
import type { KadikField, KadikScalarField, KadikSection } from "./fields";

/**
 * Every KADİK public page the admin "Sayfalar" screen manages, in the order
 * it lists them. Each page owns one or more top-level slices of
 * `KadikDictionary` (plus its own SEO title/description); saving a page
 * replaces exactly those slices on the live site.
 */
export const KADIK_CONTENT_KEYS = [
  "home",
  "about",
  "board",
  "events",
  "announcements",
  "news",
  "membership",
  "gallery",
  "contact",
  "privacy",
  "terms",
  "charter",
  "notFound",
  "global",
] as const;

export type KadikContentKey = (typeof KADIK_CONTENT_KEYS)[number];

export function isKadikContentKey(value: string): value is KadikContentKey {
  return (KADIK_CONTENT_KEYS as readonly string[]).includes(value);
}

/** Search and social-share metadata of one page. `image` empty = the site default share image. */
export type KadikSeo = Readonly<{ title: string; description: string; image: KadikImage }>;

export type KadikPageDefinition = Readonly<{
  key: KadikContentKey;
  label: string;
  description: string;
  /** Public address to preview; `null` for the site-wide header/footer entry. */
  publicPath: string | null;
  /** Top-level `KadikDictionary` keys this page owns. */
  slices: readonly (keyof KadikDictionary)[];
  /** `false` for entries without their own URL (header/footer). */
  hasSeo: boolean;
  seoDefaults: KadikSeo;
  sections: readonly KadikSection[];
  /** Links to other admin screens whose records also appear on this page. */
  related?: readonly Readonly<{ href: string; label: string }>[];
}>;

const text = (key: string, label: string, hint?: string): KadikScalarField => ({ kind: "text", key, label, hint });
const area = (key: string, label: string, hint?: string): KadikScalarField => ({ kind: "textarea", key, label, hint });
const image = (key: string, label: string): KadikScalarField => ({ kind: "image", key, label });
const url = (key: string, label: string, hint?: string): KadikScalarField => ({ kind: "url", key, label, hint });

/** Branded share cards (white logo on brand blue) from `scripts/og/generate-og-images.py`. */
function staticSeoImage(file: string): KadikImage {
  return { url: `/kadik/${file}`, assetId: null };
}

const SEO_SECTION: KadikSection = {
  id: "seo",
  title: "SEO",
  description: "Google sonuçlarında, tarayıcı sekmesinde ve sosyal medya paylaşımlarında görünen bilgiler.",
  base: "seo",
  fields: [
    text("title", "Sayfa başlığı (title)"),
    area("description", "Meta açıklama"),
    image("image", "Paylaşım görseli"),
  ],
};

const LINK_TARGET_OPTIONS = [
  { value: "home", label: "Anasayfa" },
  { value: "about", label: "Hakkımızda" },
  { value: "board", label: "Kurul Üyeleri" },
  { value: "events", label: "Etkinlikler" },
  { value: "issues", label: "Duyurular" },
  { value: "posts", label: "Haberler" },
  { value: "membership", label: "Üyelik" },
  { value: "gallery", label: "Galeri" },
  { value: "contact", label: "İletişim" },
  { value: "privacy", label: "Gizlilik" },
  { value: "terms", label: "Kullanım Şartları" },
  { value: "charter", label: "Tüzük" },
] as const;

function legalPage(key: "privacy" | "terms" | "charter", label: string, publicPath: string, seo: KadikSeo): KadikPageDefinition {
  return {
    key,
    label,
    description: "Sayfa başlığı, giriş metni ve maddeler.",
    publicPath,
    slices: [key],
    hasSeo: true,
    seoDefaults: seo,
    sections: [
      {
        id: "content",
        title: "Sayfa içeriği",
        base: key,
        fields: [
          text("title", "Sayfa başlığı"),
          area("lead", "Giriş metni"),
          {
            kind: "list",
            key: "sections",
            label: "Maddeler",
            itemLabel: "Madde",
            titleKey: "heading",
            fields: [text("heading", "Başlık"), area("text", "Metin")],
          },
        ],
      },
      SEO_SECTION,
    ],
  };
}

export const KADIK_PAGE_DEFINITIONS: Readonly<Record<KadikContentKey, KadikPageDefinition>> = {
  home: {
    key: "home",
    label: "Anasayfa",
    description: "Hero, konsey tanıtımı, odak alanları, bant, kurul ve haber bölümleri.",
    publicPath: "/",
    slices: ["home"],
    hasSeo: true,
    seoDefaults: { title: "KADİK London | Kybele Atasever World Business Council", description: "KADİK is a London-based world business council connecting entrepreneurs, executives and sectors through trust, shared judgement and global partnerships.", image: staticSeoImage("og/default.png") },
    related: [
      { href: "/manage/team", label: "Kurul üyelerini düzenle" },
      { href: "/manage/posts", label: "Haberleri düzenle" },
    ],
    sections: [
      {
        id: "hero",
        title: "Hero (üst büyük alan)",
        base: "home",
        fields: [
          image("heroImage", "Arka plan görseli"),
          text("heroKicker", "Üst küçük başlık"),
          text("heroTitleLine1", "Başlık 1. satır"),
          text("heroTitleLine2", "Başlık 2. satır"),
          area("heroSubtitle", "Alt metin"),
          text("heroCta", "Buton yazısı (Üyelik sayfasına gider)"),
        ],
      },
      {
        id: "intro",
        title: "Konsey tanıtımı",
        base: "home",
        fields: [
          text("introEyebrow", "Üst küçük başlık"),
          text("introTitle", "Başlık"),
          area("introLead", "Vurgulu paragraf"),
          area("introText", "Paragraf"),
          text("introCta", "Buton yazısı (Hakkımızda'ya gider)"),
        ],
      },
      {
        id: "principles",
        title: "Odak alanları",
        base: "home",
        fields: [
          text("principlesEyebrow", "Üst küçük başlık"),
          text("principlesTitle", "Başlık"),
          {
            kind: "list",
            key: "principles",
            label: "Kartlar",
            itemLabel: "Kart",
            titleKey: "title",
            fields: [text("number", "Numara"), text("title", "Başlık"), area("text", "Metin")],
          },
          text("principlesLink", "Kart bağlantı yazısı (Etkinlikler'e gider)"),
        ],
      },
      {
        id: "band",
        title: "Görselli bant",
        base: "home",
        fields: [
          image("bandImage", "Arka plan görseli"),
          text("bandKicker", "Üst küçük başlık"),
          text("bandTitleLine1", "Başlık 1. satır"),
          text("bandTitleLine2", "Başlık 2. satır"),
          text("bandCta", "Buton yazısı (Üyelik sayfasına gider)"),
        ],
      },
      {
        id: "board",
        title: "Kurul üyeleri bölümü",
        description: "Üyelerin kendisi \"Kurul Üyeleri\" ekranından yönetilir.",
        base: "home",
        fields: [
          text("boardKicker", "Üst küçük başlık"),
          text("boardTitle", "Başlık"),
          area("boardText", "Metin"),
          text("boardCta", "Buton yazısı"),
          text("boardEmptyTitle", "Üye yokken başlık"),
          area("boardEmptyText", "Üye yokken metin"),
          text("boardEmptyLink", "Üye yokken bağlantı yazısı"),
        ],
      },
      {
        id: "news",
        title: "Haberler bölümü",
        description: "Son 3 yayınlanmış haber otomatik gösterilir.",
        base: "home",
        fields: [
          text("newsEyebrow", "Üst küçük başlık"),
          text("newsTitle", "Başlık"),
          area("newsEmpty", "Haber yokken metin"),
          text("newsCta", "Buton yazısı"),
          text("readMore", "Kartlardaki \"devamı\" yazısı"),
        ],
      },
      SEO_SECTION,
    ],
  },
  about: {
    key: "about",
    label: "Hakkımızda",
    description: "Tanıtım metni, geniş görsel, değerler ve zaman çizelgesi.",
    publicPath: "/about",
    slices: ["about"],
    hasSeo: true,
    seoDefaults: { title: "About KADİK | Kybele Atasever World Business Council", description: "Learn how the Kybele Atasever World Business Council brings entrepreneurs and industry leaders together to grow trade, knowledge and partnerships.", image: staticSeoImage("og/about.png") },
    sections: [
      {
        id: "intro",
        title: "Giriş",
        base: "about",
        fields: [
          text("pageTitle", "Sayfa başlığı (banner)"),
          text("heroTitle", "Bölüm başlığı"),
          area("lead", "Vurgulu paragraf"),
          area("text", "Paragraf"),
          text("cta", "Buton yazısı (Kurul Üyeleri'ne gider)"),
        ],
      },
      {
        id: "image",
        title: "Geniş görsel",
        base: "about",
        fields: [image("image", "Görsel"), text("wideImageAlt", "Görsel açıklaması (alt)")],
      },
      {
        id: "stats",
        title: "Değerler",
        base: "about",
        fields: [
          text("statsEyebrow", "Üst küçük başlık"),
          text("statsTitle", "Başlık"),
          {
            kind: "list",
            key: "stats",
            label: "Kutular",
            itemLabel: "Kutu",
            titleKey: "label",
            fields: [text("number", "Numara / sayı"), text("label", "Etiket")],
          },
        ],
      },
      {
        id: "story",
        title: "Hikâye / zaman çizelgesi",
        base: "about",
        fields: [
          text("storyEyebrow", "Üst küçük başlık"),
          text("storyTitle", "Başlık"),
          {
            kind: "list",
            key: "timeline",
            label: "Kilometre taşları",
            itemLabel: "Kilometre taşı",
            titleKey: "title",
            fields: [text("year", "Yıl"), text("title", "Başlık"), area("text", "Metin")],
          },
        ],
      },
      SEO_SECTION,
    ],
  },
  board: {
    key: "board",
    label: "Kurul Üyeleri",
    description: "Sayfa başlığı ve giriş metni. Üyeler ayrı ekrandan yönetilir.",
    publicPath: "/board",
    slices: ["board"],
    hasSeo: true,
    seoDefaults: { title: "Board Members | KADİK London Business Council", description: "Meet the KADİK board: business leaders from different sectors guiding the Kybele Atasever World Business Council's programmes and partnerships.", image: staticSeoImage("og/board.png") },
    related: [{ href: "/manage/team", label: "Kurul üyelerini düzenle" }],
    sections: [
      {
        id: "content",
        title: "Sayfa metinleri",
        base: "board",
        fields: [
          text("pageTitle", "Sayfa başlığı (banner)"),
          text("introEyebrow", "Üst küçük başlık"),
          text("introTitle", "Başlık"),
          area("introLead", "Giriş metni"),
          text("emptyTitle", "Üye yokken başlık"),
          area("emptyText", "Üye yokken metin"),
        ],
      },
      SEO_SECTION,
    ],
  },
  events: {
    key: "events",
    label: "Etkinlikler",
    description: "Etkinlik takvimi: tarih ve başlıklar, takvim yazıları.",
    publicPath: "/events",
    slices: ["events"],
    hasSeo: true,
    seoDefaults: { title: "Events & Calendar | KADİK London", description: "Upcoming KADİK events in London and beyond: sector board meetings, export panels, networking meet-ups and finance workshops for members.", image: staticSeoImage("og/events.png") },
    sections: [
      {
        id: "events",
        title: "Etkinlikler",
        base: "events",
        fields: [
          text("pageTitle", "Sayfa başlığı (banner)"),
          {
            kind: "list",
            key: "events",
            label: "Etkinlik listesi",
            itemLabel: "Etkinlik",
            titleKey: "title",
            fields: [{ kind: "date", key: "date", label: "Tarih" }, text("title", "Başlık")],
          },
          text("join", "Etkinlik butonu yazısı (Üyelik'e gider)"),
          text("noResults", "Sonuç yokken metin"),
        ],
      },
      {
        id: "calendar",
        title: "Takvim ve arama yazıları",
        base: "events",
        fields: [
          text("searchPlaceholder", "Arama kutusu yazısı"),
          text("searchAria", "Arama kutusu erişilebilirlik adı"),
          text("searchButton", "Arama butonu"),
          text("viewList", "Görünüm: Liste"),
          text("viewMonth", "Görünüm: Ay"),
          text("viewDay", "Görünüm: Gün"),
          text("thisMonth", "\"Bu ay\" butonu"),
          text("prevMonth", "Önceki ay (erişilebilirlik)"),
          text("nextMonth", "Sonraki ay (erişilebilirlik)"),
          text("dateFieldAria", "Tarih alanı (erişilebilirlik)"),
          text("dayCellAria", "Gün hücresi (erişilebilirlik)"),
          { kind: "stringList", key: "weekdays", label: "Gün adları (Pzt→Paz)", itemLabel: "Gün", max: 7 },
        ],
      },
      SEO_SECTION,
    ],
  },
  announcements: {
    key: "announcements",
    label: "Duyurular",
    description: "Duyuru başlıkları, kart metni ve alt çağrı bandı.",
    publicPath: "/announcements",
    slices: ["announcements"],
    hasSeo: true,
    seoDefaults: { title: "Announcements | KADİK London", description: "KADİK announcements on sector boards, membership, international business opportunities, trade delegations and training programmes.", image: staticSeoImage("og/announcements.png") },
    sections: [
      {
        id: "content",
        title: "Sayfa içeriği",
        base: "announcements",
        fields: [
          text("pageTitle", "Sayfa başlığı (banner)"),
          text("eyebrow", "Üst küçük başlık"),
          text("title", "Başlık"),
          area("lead", "Giriş metni"),
          { kind: "stringList", key: "items", label: "Duyuru başlıkları", itemLabel: "Başlık" },
          area("itemText", "Kartlardaki ortak metin"),
          text("itemCta", "Kart bağlantı yazısı (İletişim'e gider)"),
          text("ctaTitle", "Alt bant başlığı"),
          text("ctaButton", "Alt bant butonu"),
        ],
      },
      SEO_SECTION,
    ],
  },
  news: {
    key: "news",
    label: "Haberler",
    description: "Haber listesi ve haber detay sayfası sabit yazıları. Haberler ayrı ekrandan yönetilir.",
    publicPath: "/news",
    slices: ["news", "article"],
    hasSeo: true,
    seoDefaults: { title: "News & Insights | KADİK London", description: "News, articles and assessments from the Kybele Atasever World Business Council on trade, sector boards and international business.", image: staticSeoImage("og/news.png") },
    related: [{ href: "/manage/posts", label: "Haberleri düzenle" }],
    sections: [
      {
        id: "list",
        title: "Haber listesi",
        base: "news",
        fields: [
          text("pageTitle", "Sayfa başlığı (banner)"),
          text("typeLabel", "Filtre etiketi"),
          text("all", "\"Tümü\" filtresi"),
          text("searchHeading", "Arama başlığı"),
          text("searchPlaceholder", "Arama kutusu yazısı"),
          text("searchAria", "Arama kutusu erişilebilirlik adı"),
          text("categoriesHeading", "Kategoriler başlığı"),
          text("announcementsLink", "Duyurular bağlantısı"),
          area("emptyNoContent", "Hiç haber yokken metin"),
          text("emptyNoMatch", "Aramada sonuç yokken metin"),
          text("readMore", "\"Devamı\" yazısı"),
        ],
      },
      {
        id: "article",
        title: "Haber detay sayfası",
        base: "article",
        fields: [
          text("tagsLabel", "Etiketler başlığı"),
          text("brandTag", "Marka etiketi"),
          text("industryTag", "Sektör etiketi"),
        ],
      },
      SEO_SECTION,
    ],
  },
  membership: {
    key: "membership",
    label: "Üyelik Başvurusu",
    description: "Üyelik tanıtımı, adımlar ve başvuru formu yazıları.",
    publicPath: "/membership",
    slices: ["membership", "membershipForm"],
    hasSeo: true,
    seoDefaults: { title: "Membership Application | Join KADİK London", description: "Apply to join the Kybele Atasever World Business Council. Share your company and sector details and connect with sector boards and new partners.", image: staticSeoImage("og/membership.png") },
    related: [{ href: "/manage/messages", label: "Gelen başvuruları gör" }],
    sections: [
      {
        id: "intro",
        title: "Tanıtım ve adımlar",
        base: "membership",
        fields: [
          text("pageTitle", "Sayfa başlığı (banner)"),
          text("eyebrow", "Üst küçük başlık"),
          text("title", "Başlık"),
          area("lead", "Vurgulu paragraf"),
          area("text", "Paragraf"),
          {
            kind: "list",
            key: "steps",
            label: "Başvuru adımları",
            itemLabel: "Adım",
            titleKey: "text",
            fields: [text("number", "Numara"), area("text", "Metin")],
          },
        ],
      },
      {
        id: "form",
        title: "Başvuru formu",
        base: "membershipForm",
        fields: [
          text("name", "Ad soyad etiketi"),
          text("namePlaceholder", "Ad soyad örnek yazısı"),
          text("email", "E-posta etiketi"),
          text("phone", "Telefon etiketi"),
          text("phonePlaceholder", "Telefon örnek yazısı"),
          text("company", "Şirket etiketi"),
          text("companyPlaceholder", "Şirket örnek yazısı"),
          text("position", "Görev etiketi"),
          text("positionPlaceholder", "Görev örnek yazısı"),
          text("sector", "Sektör etiketi"),
          text("sectorPlaceholder", "Sektör örnek yazısı"),
          text("city", "Şehir etiketi"),
          text("cityPlaceholder", "Şehir örnek yazısı"),
          text("website", "Web sitesi etiketi"),
          text("websitePlaceholder", "Web sitesi örnek yazısı"),
          text("reference", "Referans üye etiketi"),
          text("referencePlaceholder", "Referans üye örnek yazısı"),
          text("note", "Başvuru notu etiketi"),
          area("notePlaceholder", "Başvuru notu örnek yazısı"),
          area("consent", "Onay kutusu metni"),
          text("submit", "Gönder butonu"),
          text("submitting", "Gönderilirken yazısı"),
          area("success", "Başarılı mesajı"),
          area("error", "Hata mesajı"),
          text("ariaLabel", "Form erişilebilirlik adı"),
          text("subjectFallback", "Mesaj konusu (panelde görünür)"),
          text("fieldLabels.company", "Mesajdaki \"şirket\" satırı"),
          text("fieldLabels.position", "Mesajdaki \"görev\" satırı"),
          text("fieldLabels.sector", "Mesajdaki \"sektör\" satırı"),
          text("fieldLabels.city", "Mesajdaki \"şehir\" satırı"),
          text("fieldLabels.website", "Mesajdaki \"web sitesi\" satırı"),
          text("fieldLabels.reference", "Mesajdaki \"referans\" satırı"),
        ],
      },
      SEO_SECTION,
    ],
  },
  gallery: {
    key: "gallery",
    label: "Galeri",
    description: "Galeri fotoğrafları, kategorileri ve açıklamaları.",
    publicPath: "/gallery",
    slices: ["gallery"],
    hasSeo: true,
    seoDefaults: { title: "Photo Gallery | KADİK London", description: "Photos from KADİK events, sector board meetings and business trips, showing the Kybele Atasever World Business Council in action.", image: staticSeoImage("og/gallery.png") },
    sections: [
      {
        id: "photos",
        title: "Fotoğraflar",
        description: "Filtre butonları fotoğraflardaki kategori adlarından otomatik oluşur.",
        base: "gallery",
        fields: [
          text("pageTitle", "Sayfa başlığı (banner)"),
          {
            kind: "list",
            key: "items",
            label: "Fotoğraflar",
            itemLabel: "Fotoğraf",
            titleKey: "alt",
            fields: [image("image", "Görsel"), text("category", "Kategori"), text("alt", "Açıklama (alt)")],
          },
        ],
      },
      {
        id: "labels",
        title: "Diğer yazılar",
        base: "gallery",
        fields: [
          text("all", "\"Tümü\" filtresi"),
          text("close", "Kapat butonu"),
          text("lightboxAria", "Büyük görsel penceresi (erişilebilirlik)"),
          text("enlargedAlt", "Büyütülmüş görsel açıklaması"),
        ],
      },
      SEO_SECTION,
    ],
  },
  contact: {
    key: "contact",
    label: "İletişim",
    description: "İletişim bilgileri ve iletişim formu yazıları.",
    publicPath: "/contact",
    slices: ["contact", "contactForm"],
    hasSeo: true,
    seoDefaults: { title: "Contact KADİK | London Council Secretariat", description: "Contact the KADİK secretariat in London about membership, sector boards, events and international business connections.", image: staticSeoImage("og/contact.png") },
    related: [{ href: "/manage/messages", label: "Gelen mesajları gör" }],
    sections: [
      {
        id: "details",
        title: "İletişim bilgileri",
        base: "contact",
        fields: [
          text("pageTitle", "Sayfa başlığı (banner)"),
          text("eyebrow", "Üst küçük başlık"),
          text("title", "Başlık"),
          area("lead", "Giriş metni"),
          text("addressLabel", "Adres etiketi"),
          area("address", "Adres"),
          text("phoneLabel", "Telefon etiketi"),
          text("phone", "Telefon"),
          text("emailLabel", "E-posta etiketi"),
          text("email", "E-posta"),
        ],
      },
      {
        id: "form",
        title: "İletişim formu",
        base: "contactForm",
        fields: [
          text("namePlaceholder", "Ad soyad alanı"),
          text("emailPlaceholder", "E-posta alanı"),
          text("subjectPlaceholder", "Konu alanı"),
          text("messagePlaceholder", "Mesaj alanı"),
          area("consent", "Onay kutusu metni"),
          text("submit", "Gönder butonu"),
          text("submitting", "Gönderilirken yazısı"),
          area("success", "Başarılı mesajı"),
          area("error", "Hata mesajı"),
          text("defaultName", "İsim boşsa kullanılacak ad"),
          text("defaultMessage", "Mesaj boşsa kullanılacak metin"),
        ],
      },
      SEO_SECTION,
    ],
  },
  privacy: legalPage("privacy", "Gizlilik Politikası", "/privacy-policy", { title: "Privacy Policy | KADİK London", description: "How the Kybele Atasever World Business Council collects, uses and protects personal data submitted through the KADİK website and its forms.", image: staticSeoImage("og/privacy.png") }),
  terms: legalPage("terms", "Kullanım Şartları", "/terms", { title: "Terms of Use | KADİK London", description: "The terms that apply when you use the KADİK website, including acceptable use, content, external links and how these terms may change.", image: staticSeoImage("og/terms.png") }),
  charter: legalPage("charter", "Tüzük", "/charter", { title: "Charter | Kybele Atasever World Business Council", description: "The KADİK charter: the council's name, purpose, governance, General Assembly, Board of Directors, finances and rules for amendment.", image: staticSeoImage("og/charter.png") }),
  notFound: {
    key: "notFound",
    label: "404 Sayfası",
    description: "Bulunamayan adreslerde gösterilen sayfa.",
    publicPath: "/bu-sayfa-yok",
    slices: ["notFound"],
    hasSeo: true,
    seoDefaults: { title: "Page Not Found | KADİK London", description: "The page you're looking for could not be found or may have moved. You can reach the council sections from here.", image: staticSeoImage("og/not-found.png") },
    sections: [
      {
        id: "content",
        title: "Sayfa içeriği",
        base: "notFound",
        fields: [
          text("pageTitle", "Sayfa başlığı (banner)"),
          text("code", "Büyük kod"),
          text("heading", "Başlık"),
          area("text", "Metin"),
          text("home", "Anasayfa butonu"),
          text("contactCta", "İletişim butonu"),
          text("linksLabel", "Bağlantılar (erişilebilirlik)"),
          {
            kind: "list",
            key: "links",
            label: "Önerilen bölümler",
            itemLabel: "Bağlantı",
            titleKey: "title",
            fields: [
              { kind: "select", key: "key", label: "Gideceği sayfa", options: LINK_TARGET_OPTIONS },
              text("title", "Başlık"),
              text("text", "Açıklama"),
            ],
          },
        ],
      },
      SEO_SECTION,
    ],
  },
  global: {
    key: "global",
    label: "Header & Footer (tüm sayfalar)",
    description: "Marka adı, menü yazıları, footer metinleri ve sosyal medya bağlantıları.",
    publicPath: null,
    slices: ["brandFull", "breadcrumbHome", "nav", "footer", "organization"],
    hasSeo: false,
    seoDefaults: { title: "", description: "", image: { url: "", assetId: null } },
    sections: [
      {
        id: "brand",
        title: "Marka",
        base: "",
        fields: [
          text("brandFull", "Kurumun tam adı (logonun yanında)"),
          text("breadcrumbHome", "Sayfa yolundaki \"Anasayfa\" yazısı"),
        ],
      },
      {
        id: "nav",
        title: "Menü yazıları",
        base: "nav",
        fields: [
          text("home", "Anasayfa"),
          text("corporate", "Kurumsal (açılır menü)"),
          text("about", "Hakkımızda"),
          text("board", "Kurul Üyeleri"),
          text("contact", "İletişim"),
          text("activities", "Faaliyetler (açılır menü)"),
          text("events", "Etkinlikler"),
          text("announcements", "Duyurular"),
          text("news", "Haberler"),
          text("membership", "Üyelik"),
          text("gallery", "Galeri"),
          text("openMenu", "Mobil menü butonu (erişilebilirlik)"),
          text("mainMenu", "Ana menü (erişilebilirlik)"),
          text("mobileMenu", "Mobil menü (erişilebilirlik)"),
        ],
      },
      {
        id: "footer",
        title: "Footer",
        base: "footer",
        fields: [
          area("tagline", "Logo altı metin"),
          text("corporate", "1. sütun başlığı"),
          text("activities", "2. sütun başlığı"),
          text("followUs", "3. sütun başlığı"),
          text("contactCta", "İletişim butonu"),
          text("rightsReserved", "Telif yazısı"),
          text("privacy", "Gizlilik bağlantısı"),
          text("terms", "Kullanım şartları bağlantısı"),
          text("charter", "Tüzük bağlantısı"),
        ],
      },
      {
        id: "socials",
        title: "Sosyal medya",
        description: "Boş bırakılan hesap footer'da gösterilmez. Dolu olanlar Google'a kurumun resmi hesapları olarak da bildirilir.",
        base: "footer.socials",
        fields: [
          url("facebook", "Facebook adresi"),
          url("youtube", "YouTube adresi"),
          url("x", "X (Twitter) adresi"),
          url("linkedin", "LinkedIn adresi"),
          url("instagram", "Instagram adresi"),
        ],
      },
      {
        id: "organization",
        title: "Kurum bilgileri (Google / JSON-LD)",
        description: "Arama motorlarına kurumu tanıtan yapılandırılmış veri. E-posta, telefon ve adres İletişim sayfasından alınır.",
        base: "organization",
        fields: [
          text("name", "Kurumun resmi adı"),
          text("alternateName", "Kısa ad / marka"),
          area("description", "Kurum açıklaması"),
          text("foundingDate", "Kuruluş yılı"),
          text("locality", "Şehir"),
          text("countryCode", "Ülke kodu (ör. GB)"),
          text("eventVenue", "Etkinliklerin varsayılan yeri"),
        ],
      },
    ],
  },
};

export type KadikPageData = Readonly<Record<string, unknown>>;

/** Factory content for one page: its dictionary slices plus SEO. */
export function kadikPageDefaults(key: KadikContentKey): KadikPageData {
  const definition = KADIK_PAGE_DEFINITIONS[key];
  const dictionary = KADIK_DICT.en;
  const data: Record<string, unknown> = {};
  for (const slice of definition.slices) data[slice] = structuredClone(dictionary[slice]);
  if (definition.hasSeo) data.seo = structuredClone(definition.seoDefaults);
  return data;
}

/** Flattened field list with absolute paths - used by validation and the media-usage index. */
export function kadikPageFields(key: KadikContentKey): readonly Readonly<{ path: string; field: KadikField }>[] {
  return KADIK_PAGE_DEFINITIONS[key].sections.flatMap((section) =>
    section.fields.map((field) => ({ path: section.base ? `${section.base}.${field.key}` : field.key, field })),
  );
}
