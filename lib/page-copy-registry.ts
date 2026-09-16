import type { Dictionary } from "./i18n/types";

export const PAGE_COPY_KEYS = [
  "home",
  "about",
  "services",
  "products",
  "projects",
  "blog",
  "faq",
  "contact",
  "mission-vision",
  "privacy",
  "terms",
  "search",
  "team",
  "partners",
  "site-shell",
] as const;

export type PageCopyKey = (typeof PAGE_COPY_KEYS)[number];

export type PageCopyDefinition = Readonly<{
  label: string;
  /** "page" = a real standalone page managed under /manage/pages.
   * "settings" = a collection index or legal surface whose copy belongs to
   * the Ayar Merkezi, not the page list. */
  group: "page" | "settings";
  publicPath: string;
  description: string;
  roots: readonly Readonly<{ label: string; paths: readonly string[] }>[];
  collectionHref?: string;
  collectionLabel?: string;
  settingsHref?: string;
  settingsLabel?: string;
}>;

export const PAGE_COPY_DEFINITIONS: Readonly<Record<PageCopyKey, PageCopyDefinition>> = {
  home: {
    label: "Anasayfa",
    group: "page",
    publicPath: "/",
    description: "Sabit Home component alanları ve SEO metinleri.",
    roots: [{ label: "SEO", paths: ["meta.home"] }],
  },
  about: {
    label: "Hakkımızda",
    group: "page",
    publicPath: "/hakkimizda",
    description: "Hakkımızda sayfa içeriği ve SEO metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.about"] },
      { label: "Dil fallback bildirimi", paths: ["common.aboutFallbackNotice"] },
    ],
  },
  services: {
    label: "Hizmetler",
    group: "settings",
    publicPath: "/servisler",
    description: "Hizmet liste/detay sayfası sabit metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.services"] },
      { label: "Liste sayfası", paths: ["servicesPage"] },
      { label: "Detay sayfası", paths: ["serviceDetailPage"] },
    ],
    collectionHref: "/manage/services",
    collectionLabel: "Hizmet kayıtlarını düzenle",
  },
  products: {
    label: "Ürünler",
    group: "settings",
    publicPath: "/urunler",
    description: "Ürün liste/detay sayfası sabit metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.products"] },
      { label: "Liste sayfası", paths: ["productsPage"] },
      { label: "Detay sayfası", paths: ["productDetailPage"] },
    ],
    collectionHref: "/manage/products",
    collectionLabel: "Ürün kayıtlarını düzenle",
  },
  projects: {
    label: "Projeler",
    group: "settings",
    publicPath: "/projeler",
    description: "Proje liste/detay sayfası sabit metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.projects"] },
      { label: "Liste sayfası", paths: ["projectsPage"] },
      { label: "Detay sayfası", paths: ["projectDetailPage"] },
    ],
    collectionHref: "/manage/projects",
    collectionLabel: "Proje kayıtlarını düzenle",
  },
  blog: {
    label: "Blog",
    group: "settings",
    publicPath: "/blog",
    description: "Blog liste sayfası başlıkları ve SEO metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.blog"] },
      { label: "Liste başlıkları", paths: ["blog"] },
    ],
    collectionHref: "/manage/posts",
    collectionLabel: "Blog yazılarını düzenle",
  },
  faq: {
    label: "SSS",
    group: "settings",
    publicPath: "/sss",
    description: "SSS sayfası sabit metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.faq"] },
      { label: "Sayfa metinleri", paths: ["faqPage"] },
    ],
    collectionHref: "/manage/faq",
    collectionLabel: "SSS kayıtlarını düzenle",
  },
  partners: {
    label: "Partnerler",
    group: "page",
    publicPath: "/partnerler",
    description: "Partnerler sayfası banner, başlık ve giriş metinleri; logolar Anasayfa Marka Güveni bölümüyle paylaşılır.",
    roots: [
      { label: "SEO", paths: ["meta.partners"] },
      { label: "Sayfa metinleri", paths: ["partnersPage"] },
    ],
    settingsHref: "/manage/home",
    settingsLabel: "Marka logolarını düzenle (Anasayfa > Marka Güveni)",
  },
  contact: {
    label: "İletişim",
    group: "page",
    publicPath: "/iletisim",
    description: "İletişim sayfası, form ve durum metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.contact"] },
      { label: "Sayfa ve form", paths: ["contactPage"] },
    ],
    settingsHref: "/manage/site-settings?section=contact",
    settingsLabel: "Telefon, e-posta ve adresi düzenle",
  },
  "mission-vision": {
    label: "Misyon ve Vizyon",
    group: "page",
    publicPath: "/misyon-ve-vizyon",
    description: "Misyon ve Vizyon sayfası başlık, değer ve KPI metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.missionVision"] },
      { label: "Sayfa metinleri", paths: ["missionVisionPage"] },
    ],
    settingsHref: "/manage/site-settings?section=mission-vision",
    settingsLabel: "Misyon ve vizyon gövdesini düzenle",
  },
  privacy: {
    label: "Gizlilik Politikası",
    group: "settings",
    publicPath: "/gizlilik-politikasi",
    description: "Gizlilik sayfası başlıkları ve SEO metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.privacy"] },
      {
        label: "Sayfa metinleri",
        paths: [
          "legalPage.privacyBanner",
          "legalPage.privacyTitle",
          "legalPage.privacyUpdated",
          "legalPage.updatedLabel",
        ],
      },
    ],
    settingsHref: "/manage/site-settings?section=legal",
    settingsLabel: "Gizlilik metnini düzenle",
  },
  terms: {
    label: "Kullanım Şartları",
    group: "settings",
    publicPath: "/kullanim-sartlari",
    description: "Kullanım şartları başlıkları ve SEO metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.terms"] },
      {
        label: "Sayfa metinleri",
        paths: [
          "legalPage.termsBanner",
          "legalPage.termsTitle",
          "legalPage.termsUpdated",
          "legalPage.updatedLabel",
        ],
      },
    ],
    settingsHref: "/manage/site-settings?section=legal",
    settingsLabel: "Kullanım şartları metnini düzenle",
  },
  search: {
    label: "Arama",
    group: "page",
    publicPath: "/arama",
    description: "Arama sayfası alan ve sonuç metinleri.",
    roots: [
      { label: "SEO", paths: ["meta.search"] },
      { label: "Sayfa metinleri", paths: ["searchPage"] },
    ],
  },
  team: {
    label: "Ekip Detayı",
    group: "page",
    publicPath: "/ekip/:slug",
    description: "Ekip detay sayfası sabit başlıkları.",
    roots: [{ label: "Detay sayfası", paths: ["teamDetailPage"] }],
    collectionHref: "/manage/team",
    collectionLabel: "Ekip üyelerini düzenle",
  },
  "site-shell": {
    label: "Ortak Site Metinleri",
    group: "settings",
    publicPath: "Tüm sayfalar",
    description: "Header/footer ortak buton, etiket ve fallback metinleri.",
    roots: [
      { label: "Ortak metinler", paths: ["common"] },
      { label: "Footer", paths: ["footer"] },
    ],
    settingsHref: "/manage/site-settings",
    settingsLabel: "Logo, navigasyon ve iletişim ayarlarını düzenle",
  },
};

export function isPageCopyKey(value: unknown): value is PageCopyKey {
  return typeof value === "string" && (PAGE_COPY_KEYS as readonly string[]).includes(value);
}

export type PageCopyField = Readonly<{
  path: string;
  label: string;
  value: string;
}>;

export type PageCopyGroup = Readonly<{
  label: string;
  fields: readonly PageCopyField[];
}>;

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) return current[Number(segment)];
    if (typeof current === "object" && current !== null) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}

/** Turkish labels for the dictionary leaf names an admin actually sees. */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  title: "Başlık",
  subtitle: "Üst başlık",
  description: "Açıklama",
  banner: "Banner başlığı",
  intro: "Giriş metni",
  empty: "Kayıt yok metni",
  text: "Metin",
  label: "Etiket",
  value: "Değer",
  placeholder: "Yer tutucu metin",
  backLabel: "Geri bağlantısı",
  ctaLabel: "Buton yazısı",
  ctaText: "Buton alt metni",
  ctaTitle: "Buton başlığı",
  submitLabel: "Gönder butonu",
  sendingLabel: "Gönderiliyor metni",
  successMessage: "Başarılı mesajı",
  errorMessage: "Hata mesajı",
  rateLimitedMessage: "Çok fazla istek mesajı",
  nameLabel: "Ad alanı etiketi",
  emailLabel: "E-posta etiketi",
  emailFieldLabel: "E-posta alanı etiketi",
  emailPlaceholder: "E-posta yer tutucusu",
  phoneLabel: "Telefon etiketi",
  phoneFieldLabel: "Telefon alanı etiketi",
  addressLabel: "Adres etiketi",
  subjectLabel: "Konu etiketi",
  messageLabel: "Mesaj etiketi",
  formTitle: "Form başlığı",
  infoTitle: "Bilgi kartı başlığı",
  missionTitle: "Misyon başlığı",
  visionTitle: "Vizyon başlığı",
  valuesTitle: "Değerler başlığı",
  valuesSubtitle: "Değerler üst başlığı",
  indicatorsTitle: "Göstergeler başlığı",
  indicatorsSubtitle: "Göstergeler üst başlığı",
  faqTitle: "SSS başlığı",
  faqSubtitle: "SSS üst başlığı",
  quoteTitle: "Teklif başlığı",
  quoteText: "Teklif metni",
  quoteCta: "Teklif butonu",
  featuresTitle: "Özellikler başlığı",
  galleryTitle: "Galeri başlığı",
  relatedTitle: "İlgili kayıtlar başlığı",
  sidebarTitle: "Yan panel başlığı",
  hoursTitle: "Çalışma saatleri başlığı",
  hoursText: "Çalışma saatleri metni",
  helpTitle: "Yardım başlığı",
  helpText: "Yardım metni",
  helpCta: "Yardım butonu",
  fallbackNotice: "Dil fallback bildirimi",
  contactTitle: "İletişim başlığı",
  skillsTitle: "Yetenekler başlığı",
  experienceTitle: "Deneyim başlığı",
  educationTitle: "Eğitim başlığı",
  challengeTitle: "Zorluk başlığı",
  solutionTitle: "Çözüm başlığı",
  clientLabel: "Müşteri etiketi",
  categoryLabel: "Kategori etiketi",
  noQuery: "Arama yapılmadı metni",
  resultsPrefix: "Sonuç sayısı öneki",
  categoryPosts: "Blog sonuç başlığı",
  categoryServices: "Hizmet sonuç başlığı",
  categoryProducts: "Ürün sonuç başlığı",
  categoryProjects: "Proje sonuç başlığı",
  categoryTeam: "Ekip sonuç başlığı",
  termsBanner: "Şartlar banner başlığı",
  termsTitle: "Şartlar başlığı",
  termsUpdated: "Şartlar güncelleme tarihi",
  privacyBanner: "Gizlilik banner başlığı",
  privacyTitle: "Gizlilik başlığı",
  privacyUpdated: "Gizlilik güncelleme tarihi",
  updatedLabel: "Güncelleme etiketi",
  loading: "Yükleniyor metni",
  readMore: "Devamını oku butonu",
  home: "Ana sayfa bağlantı metni",
  learnMore: "Daha fazla butonu",
  contactUs: "Bize ulaşın butonu",
  getQuote: "Teklif al butonu",
  callUsNow: "Hemen arayın metni",
  callAnytime: "7/24 arayın metni",
  search: "Arama metni",
  openMenu: "Menüyü aç metni",
  closeMenu: "Menüyü kapat metni",
  language: "Dil seçici metni",
  followUs: "Bizi takip edin metni",
  brandTrust: "Marka güveni başlığı",
  brandAlt: "Marka logosu alt metni",
  allServices: "Tüm hizmetler butonu",
  allMembers: "Tüm ekip butonu",
  allProjects: "Tüm projeler butonu",
  prevProject: "Önceki proje metni",
  nextProject: "Sonraki proje metni",
  editor: "Yazar etiketi",
  ratingLabel: "Puan etiketi",
  subscribe: "Abone ol butonu",
  aboutFallbackNotice: "Hakkımızda dil bildirimi",
  locationValue: "Konum değeri",
  summary: "Footer özeti",
  quickLinksTitle: "Hızlı bağlantılar başlığı",
  recentTitle: "Son yazılar başlığı",
  reachTitle: "Bize ulaşın başlığı",
  address: "Adres",
  copyright: "Telif hakkı metni",
  terms: "Kullanım şartları bağlantısı",
  privacy: "Gizlilik bağlantısı",
};

function humanize(segment: string): string {
  return (
    FIELD_LABELS[segment] ??
    segment.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (value) => value.toUpperCase())
  );
}

function collectFields(
  value: unknown,
  path: string,
  fields: PageCopyField[],
  labelPrefix = "",
): void {
  if (typeof value === "string") {
    const finalSegment = path.split(".").at(-1) ?? path;
    const index = Number(finalSegment);
    const own = Number.isInteger(index) ? `${index + 1}. alan` : humanize(finalSegment);
    fields.push({ path, label: labelPrefix ? `${labelPrefix}${own}` : own, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectFields(
        item,
        `${path}.${index}`,
        fields,
        typeof item === "string" ? labelPrefix : `${labelPrefix}${index + 1}. `,
      ),
    );
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      collectFields(child, `${path}.${key}`, fields, labelPrefix);
    }
  }
}

export function pageCopyGroups(key: PageCopyKey, dictionary: Dictionary): readonly PageCopyGroup[] {
  return PAGE_COPY_DEFINITIONS[key].roots.map((root) => {
    const fields: PageCopyField[] = [];
    for (const path of root.paths) collectFields(readPath(dictionary, path), path, fields);
    return { label: root.label, fields };
  });
}

export function applyPageCopyFields(
  key: PageCopyKey,
  dictionary: Dictionary,
  values: Readonly<Record<string, string>>,
): Dictionary {
  const clone = structuredClone(dictionary);
  const allowed = new Set(pageCopyGroups(key, dictionary).flatMap((group) => group.fields.map((field) => field.path)));
  for (const [path, value] of Object.entries(values)) {
    if (!allowed.has(path)) continue;
    const segments = path.split(".");
    const final = segments.pop();
    if (!final) continue;
    let target: unknown = clone;
    for (const segment of segments) {
      target = Array.isArray(target)
        ? target[Number(segment)]
        : (target as Record<string, unknown>)[segment];
    }
    if (Array.isArray(target)) target[Number(final)] = value;
    else if (typeof target === "object" && target !== null) {
      (target as Record<string, unknown>)[final] = value;
    }
  }
  return clone;
}
