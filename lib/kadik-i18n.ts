/**
 * Single source of truth for the KADİK site's two structural locales.
 * English is the native/default locale (prefixless routes); Turkish is the
 * secondary locale under the `/tr` prefix. `components/KadikSite.tsx` is
 * the only consumer - every static string that used to be a Turkish JSX
 * literal now lives here, keyed by locale, so the exact same component tree
 * renders either language.
 *
 * A separate, unrelated mechanism (`components/GoogleTranslateWidget.tsx`)
 * offers machine translation into a handful of further languages on top of
 * these two - that widget never needs an entry here.
 */

export type KadikLocale = "en" | "tr";

export const KADIK_LOCALES: readonly KadikLocale[] = ["en", "tr"];

export const KADIK_DEFAULT_LOCALE: KadikLocale = "en";

export const KADIK_LOCALE_NAMES: Record<KadikLocale, string> = {
  en: "English",
  tr: "Türkçe",
};

export type KadikPageKey =
  | "home"
  | "about"
  | "board"
  | "events"
  | "membership"
  | "issues"
  | "posts"
  | "post"
  | "contact"
  | "gallery"
  | "privacy"
  | "terms"
  | "notfound";

/**
 * One address per page per locale. English is prefixless; Turkish keeps the
 * original Turkish segment names under `/tr`, so an already-shared
 * `/tr/kurul-uyeleri` style link keeps meaning what it says. `post`'s entry
 * is the list root - a post detail page resolves its own per-locale path
 * via `kadikPostPath`, not this table.
 */
export const KADIK_PATHS: Record<KadikPageKey, Record<KadikLocale, string>> = {
  home: { en: "/", tr: "/tr" },
  about: { en: "/about", tr: "/tr/hakkimizda" },
  board: { en: "/board", tr: "/tr/kurul-uyeleri" },
  events: { en: "/events", tr: "/tr/etkinlikler" },
  membership: { en: "/membership", tr: "/tr/uyelik" },
  issues: { en: "/announcements", tr: "/tr/duyurular" },
  posts: { en: "/news", tr: "/tr/yazilar" },
  post: { en: "/news", tr: "/tr/yazilar" },
  contact: { en: "/contact", tr: "/tr/iletisim" },
  gallery: { en: "/gallery", tr: "/tr/galeri" },
  privacy: { en: "/privacy-policy", tr: "/tr/gizlilik-politikasi" },
  terms: { en: "/terms", tr: "/tr/kullanim-sartlari" },
  notfound: { en: "/", tr: "/tr" },
};

export function kadikPostPath(locale: KadikLocale, slug: string): string {
  return `${KADIK_PATHS.posts[locale]}/${slug}`;
}

export type KadikDictionary = Readonly<{
  brandFull: string;
  htmlLang: string;
  nav: Readonly<{
    home: string;
    corporate: string;
    about: string;
    board: string;
    contact: string;
    activities: string;
    events: string;
    announcements: string;
    news: string;
    membership: string;
    gallery: string;
    openMenu: string;
    mainMenu: string;
    mobileMenu: string;
  }>;
  footer: Readonly<{
    tagline: string;
    corporate: string;
    activities: string;
    followUs: string;
    contactCta: string;
    rightsReserved: string;
    privacy: string;
    terms: string;
  }>;
  breadcrumbHome: string;
  langSwitch: Readonly<{ label: string }>;
  contactForm: Readonly<{
    namePlaceholder: string;
    emailPlaceholder: string;
    subjectPlaceholder: string;
    messagePlaceholder: string;
    consent: string;
    submit: string;
    submitting: string;
    success: string;
    error: string;
    defaultName: string;
    defaultMessage: string;
  }>;
  membershipForm: Readonly<{
    ariaLabel: string;
    name: string;
    namePlaceholder: string;
    email: string;
    phone: string;
    phonePlaceholder: string;
    company: string;
    companyPlaceholder: string;
    position: string;
    positionPlaceholder: string;
    sector: string;
    sectorPlaceholder: string;
    city: string;
    cityPlaceholder: string;
    website: string;
    websitePlaceholder: string;
    reference: string;
    referencePlaceholder: string;
    note: string;
    notePlaceholder: string;
    consent: string;
    submit: string;
    submitting: string;
    success: string;
    error: string;
    fieldLabels: Readonly<{ company: string; position: string; sector: string; city: string; website: string; reference: string }>;
    subjectFallback: string;
  }>;
  home: Readonly<{
    heroKicker: string;
    heroTitleLine1: string;
    heroTitleLine2: string;
    heroSubtitle: string;
    heroCta: string;
    introEyebrow: string;
    introTitle: string;
    introLead: string;
    introText: string;
    introCta: string;
    principlesEyebrow: string;
    principlesTitle: string;
    principles: readonly Readonly<{ number: string; title: string; text: string }>[];
    principlesLink: string;
    bandKicker: string;
    bandTitleLine1: string;
    bandTitleLine2: string;
    bandCta: string;
    boardKicker: string;
    boardTitle: string;
    boardText: string;
    boardCta: string;
    boardEmptyTitle: string;
    boardEmptyText: string;
    boardEmptyLink: string;
    newsEyebrow: string;
    newsTitle: string;
    newsEmpty: string;
    newsCta: string;
    readMore: string;
  }>;
  board: Readonly<{
    pageTitle: string;
    introEyebrow: string;
    introTitle: string;
    introLead: string;
    emptyTitle: string;
    emptyText: string;
  }>;
  about: Readonly<{
    pageTitle: string;
    heroTitle: string;
    lead: string;
    text: string;
    cta: string;
    wideImageAlt: string;
    statsEyebrow: string;
    statsTitle: string;
    stats: readonly Readonly<{ number: string; label: string }>[];
    storyEyebrow: string;
    storyTitle: string;
    timeline: readonly Readonly<{ year: string; title: string; text: string }>[];
  }>;
  events: Readonly<{
    pageTitle: string;
    searchAria: string;
    searchPlaceholder: string;
    searchButton: string;
    viewList: string;
    viewMonth: string;
    viewDay: string;
    prevMonth: string;
    nextMonth: string;
    thisMonth: string;
    weekdays: readonly string[];
    noResults: string;
    join: string;
    dateFieldAria: string;
    dayCellAria: string;
    events: readonly Readonly<{ date: string; title: string }>[];
  }>;
  membership: Readonly<{
    pageTitle: string;
    eyebrow: string;
    title: string;
    lead: string;
    text: string;
    steps: readonly Readonly<{ number: string; text: string }>[];
  }>;
  announcements: Readonly<{
    pageTitle: string;
    eyebrow: string;
    title: string;
    lead: string;
    items: readonly string[];
    itemText: string;
    itemCta: string;
    ctaTitle: string;
    ctaButton: string;
  }>;
  news: Readonly<{
    pageTitle: string;
    typeLabel: string;
    all: string;
    searchAria: string;
    searchPlaceholder: string;
    emptyNoContent: string;
    emptyNoMatch: string;
    searchHeading: string;
    categoriesHeading: string;
    announcementsLink: string;
    readMore: string;
  }>;
  article: Readonly<{
    tagsLabel: string;
    brandTag: string;
    industryTag: string;
  }>;
  contact: Readonly<{
    pageTitle: string;
    eyebrow: string;
    title: string;
    lead: string;
    addressLabel: string;
    address: string;
    phoneLabel: string;
    phone: string;
    emailLabel: string;
    email: string;
  }>;
  gallery: Readonly<{
    pageTitle: string;
    categories: readonly string[];
    all: string;
    close: string;
    lightboxAria: string;
    enlargedAlt: string;
  }>;
  legal: Readonly<{
    privacyTitle: string;
    termsTitle: string;
    lead: string;
    privacySections: readonly (readonly [string, string])[];
    termsSections: readonly (readonly [string, string])[];
  }>;
  notFound: Readonly<{
    pageTitle: string;
    code: string;
    heading: string;
    text: string;
    home: string;
    contactCta: string;
    linksLabel: string;
    links: readonly Readonly<{ key: KadikPageKey; title: string; text: string }>[];
  }>;
}>;

const en: KadikDictionary = {
  brandFull: "KYBELE ATASEVER WORLD BUSINESS COUNCIL",
  htmlLang: "en",
  nav: {
    home: "Home",
    corporate: "Corporate",
    about: "About Us",
    board: "Board Members",
    contact: "Contact",
    activities: "Activities",
    events: "Events",
    announcements: "Announcements",
    news: "News",
    membership: "Membership",
    gallery: "Gallery",
    openMenu: "Open menu",
    mainMenu: "Main menu",
    mobileMenu: "Mobile menu",
  },
  footer: {
    tagline: "An independent council bringing the business world together around shared judgement, trust and international partnerships.",
    corporate: "Corporate",
    activities: "Activities",
    followUs: "Follow Us",
    contactCta: "Contact Us",
    rightsReserved: "All rights reserved.",
    privacy: "Privacy",
    terms: "Terms of Use",
  },
  breadcrumbHome: "HOME",
  langSwitch: { label: "Switch language" },
  contactForm: {
    namePlaceholder: "Your full name",
    emailPlaceholder: "Your email address",
    subjectPlaceholder: "Subject",
    messagePlaceholder: "Your message",
    consent: "I agree to have my details stored and to be contacted.",
    submit: "Send Message",
    submitting: "Sending…",
    success: "Your message has been received. Our team will get back to you shortly.",
    error: "The form could not be submitted. Please try again later.",
    defaultName: "Council visitor",
    defaultMessage: "Council contact form",
  },
  membershipForm: {
    ariaLabel: "Membership application form",
    name: "Full Name",
    namePlaceholder: "Your full name",
    email: "Email",
    phone: "Phone",
    phonePlaceholder: "+44 7xxx xxx xxx",
    company: "Company / Organisation",
    companyPlaceholder: "Your company's name",
    position: "Role / Title",
    positionPlaceholder: "Managing director, founder, executive…",
    sector: "Sector",
    sectorPlaceholder: "Construction, textiles, logistics, technology…",
    city: "City",
    cityPlaceholder: "London",
    website: "Website (optional)",
    websitePlaceholder: "www.yourcompany.com",
    reference: "Referring member (optional)",
    referencePlaceholder: "The member who referred you to the council",
    note: "Application note",
    notePlaceholder: "Your area of activity, what you expect from membership, and which sector board you'd like to contribute to",
    consent: "I agree to have my application details stored for membership review and to be contacted.",
    submit: "Submit Membership Application",
    submitting: "Sending…",
    success: "Your application has been received. The council secretariat will review it and get in touch with you.",
    error: "The application could not be submitted. Please try again later.",
    fieldLabels: { company: "Company / organisation", position: "Role / title", sector: "Sector", city: "City", website: "Website", reference: "Referring member" },
    subjectFallback: "Membership application",
  },
  home: {
    heroKicker: "KYBELE ATASEVER WORLD BUSINESS COUNCIL",
    heroTitleLine1: "Connecting business",
    heroTitleLine2: "to the future.",
    heroSubtitle: "Trust, shared judgement and sustainable partnerships.",
    heroCta: "About Membership",
    introEyebrow: "OUR COUNCIL",
    introTitle: "A business network without borders.",
    introLead: "Kybele and KADİK operate as a world business council that brings entrepreneurs, executives and industry leaders together around shared values.",
    introText: "We run programmes that strengthen knowledge-sharing, commercial connections and next-generation partnerships.",
    introCta: "Get to Know the Council",
    principlesEyebrow: "OUR FOCUS AREAS",
    principlesTitle: "Real connections and concrete opportunities for our members.",
    principles: [
      { number: "01", title: "Business Development", text: "Programmes for entering new markets and finding the right partners." },
      { number: "02", title: "Sector Boards", text: "Working groups that grow sector experience through shared judgement." },
      { number: "03", title: "International Network", text: "Investment, trade and representation connections worldwide." },
    ],
    principlesLink: "Explore Activities",
    bandKicker: "PARTNERSHIP · VISION · TRUST",
    bandTitleLine1: "A business ecosystem",
    bandTitleLine2: "that grows together.",
    bandCta: "Become a Member",
    boardKicker: "KYBELE ATASEVER WORLD BUSINESS COUNCIL",
    boardTitle: "Our board members",
    boardText: "We bring business people from different sectors together around shared judgement and new partnerships.",
    boardCta: "View Full Board",
    boardEmptyTitle: "The board line-up is being prepared.",
    boardEmptyText: "You can add and publish board members from the \"Board Members\" section of the admin panel.",
    boardEmptyLink: "View the board members page",
    newsEyebrow: "LATEST",
    newsTitle: "News from the council",
    newsEmpty: "News is being prepared. Add and publish an article from the admin panel's \"News\" section and this area will update automatically.",
    newsCta: "View All News",
    readMore: "Read more ↗",
  },
  board: {
    pageTitle: "Board Members",
    introEyebrow: "COUNCIL LEADERSHIP",
    introTitle: "Our board members",
    introLead: "Meet the members of the Kybele and KADİK World Business Council; connect with our business people representing different sectors.",
    emptyTitle: "Board members are coming soon.",
    emptyText: "New board members will appear here once they are added and published from the admin panel.",
  },
  about: {
    pageTitle: "About Us",
    heroTitle: "An ecosystem that grows together.",
    lead: "Kybele and KADİK bring entrepreneurs, executives and industry leaders together within a world business network built on trust.",
    text: "Our council designs programmes that strengthen commercial connections, increase knowledge-sharing and support our members' growth on an international scale.",
    cta: "Meet the Board Members",
    wideImageAlt: "A meeting of business people",
    statsEyebrow: "IN NUMBERS",
    statsTitle: "Our shared values",
    stats: [
      { number: "01", label: "Trust-driven network" },
      { number: "02", label: "Sector board" },
      { number: "03", label: "International vision" },
      { number: "04", label: "Sustainable growth" },
    ],
    storyEyebrow: "THE COUNCIL'S STORY",
    storyTitle: "From idea to a global business network",
    timeline: [
      { year: "2024", title: "The Kybele vision was born", text: "We set out with the idea of bringing different sectors of the business world together around shared goals." },
      { year: "2025", title: "The KADİK network was founded", text: "We built a structure focused on knowledge, connection and growth for our members." },
      { year: "2026", title: "A world business council", text: "We are growing trusted, sustainable partnerships that open the way to new markets." },
    ],
  },
  events: {
    pageTitle: "Events",
    searchAria: "Search events",
    searchPlaceholder: "Search events",
    searchButton: "Find event",
    viewList: "List",
    viewMonth: "Month",
    viewDay: "Day",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    thisMonth: "THIS MONTH",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    noResults: "No events found for this date.",
    join: "Join",
    dateFieldAria: "Event date",
    dayCellAria: "events on",
    events: [
      { date: "2026-09-08", title: "Sector boards joint meeting" },
      { date: "2026-09-15", title: "Export and foreign markets panel" },
      { date: "2026-09-17", title: "Member companies networking meet-up" },
      { date: "2026-09-29", title: "Access to finance workshop" },
    ],
  },
  membership: {
    pageTitle: "Membership Application",
    eyebrow: "COUNCIL FAMILY",
    title: "Grow your business network.",
    lead: "With Kybele and KADİK membership, get closer to knowledge, connections and new commercial opportunities.",
    text: "Membership works through a formal application process for business owners, executives and professionals. Your application is reviewed by the council secretariat, after which we connect you with the right sector board and working groups.",
    steps: [
      { number: "01", text: "Fill out the application form with your company and sector details." },
      { number: "02", text: "The secretariat reviews your application and holds a preliminary conversation with you." },
      { number: "03", text: "Your membership is finalised following the board's review." },
      { number: "04", text: "You begin taking part in sector boards, events and partnership programmes." },
    ],
  },
  announcements: {
    pageTitle: "Announcements",
    eyebrow: "FROM THE COUNCIL",
    title: "Agenda and announcements",
    lead: "We regularly keep our members informed about events, sector boards, business opportunities and developments in council activities.",
    items: ["Sector Boards", "Membership Announcements", "International Business Opportunities", "Training and Development", "Trade Delegations", "Council Gatherings", "Publications", "Partnerships"],
    itemText: "Current topics covering the business world's agenda, our members' development and new connections.",
    itemCta: "Learn more ↗",
    ctaTitle: "Stay informed on the council's agenda.",
    ctaButton: "Contact Us",
  },
  news: {
    pageTitle: "News",
    typeLabel: "Type:",
    all: "All",
    searchAria: "Search news",
    searchPlaceholder: "Search…",
    emptyNoContent: "News is being prepared. Once you add and publish an article from the admin panel, it will be listed here.",
    emptyNoMatch: "No article matches your search.",
    searchHeading: "Search",
    categoriesHeading: "Categories",
    announcementsLink: "Announcements",
    readMore: "Read more ↗",
  },
  article: {
    tagsLabel: "TAGS:",
    brandTag: "KADİK",
    industryTag: "BUSINESS",
  },
  contact: {
    pageTitle: "Contact",
    eyebrow: "COUNCIL SECRETARIAT",
    title: "Let's talk partnership.",
    lead: "Reach out to us about membership, sector boards, events and international business connections.",
    addressLabel: "Address",
    address: "London, United Kingdom",
    phoneLabel: "Phone",
    phone: "+44 (0) 20 0000 0000",
    emailLabel: "Email",
    email: "hello@kadiklondon.org",
  },
  gallery: {
    pageTitle: "Gallery",
    categories: ["Events", "Meetings", "Business Trips"],
    all: "All",
    close: "Close",
    lightboxAria: "Gallery image",
    enlargedAlt: "Enlarged gallery image",
  },
  legal: {
    privacyTitle: "Privacy Policy",
    termsTitle: "Terms of Use",
    lead: "This text explains your rights and responsibilities when using the Kybele and KADİK website.",
    privacySections: [
      ["1. Introduction", "At Kybele and KADİK, we take the protection of your personal data seriously. This text explains what information is collected while using our website and how it is used."],
      ["2. Data collected", "Information you share on contact and membership forms is processed solely to handle your request and to get in touch with you."],
      ["3. Storage and security", "Data is kept on protected systems for as long as necessary. It is not shared with third parties except where legally required."],
      ["4. Your rights", "You have the right to access, correct, delete and object to the processing of your personal data. For requests, you can reach us at hello@kadiklondon.org."],
    ],
    termsSections: [
      ["1. Use of the service", "You agree to use the site only for lawful purposes. You may not reproduce content without permission or attempt to compromise the site's security."],
      ["2. Content and links", "Content on the site is provided for informational purposes. Kybele and KADİK are not responsible for the content of external links."],
      ["3. Changes", "These terms may be updated as needed. The current text is published on this page."],
    ],
  },
  notFound: {
    pageTitle: "Page Not Found",
    code: "404",
    heading: "We couldn't find that page.",
    text: "The link may have moved, changed address, or been taken down. You can reach council content from the sections below, or write to the secretariat if you still can't find what you're looking for.",
    home: "Back to Home",
    contactCta: "Get in Touch",
    linksLabel: "Site sections",
    links: [
      { key: "about", title: "About Us", text: "The council's vision, focus areas and story." },
      { key: "board", title: "Board Members", text: "Our board and sector representatives." },
      { key: "posts", title: "News", text: "News, articles and council assessments." },
      { key: "events", title: "Events", text: "Meetings, panels and the programme calendar." },
      { key: "membership", title: "Membership Application", text: "Application form to join the council family." },
      { key: "gallery", title: "Gallery", text: "A photo selection from our activities." },
    ],
  },
};

const tr: KadikDictionary = {
  brandFull: "KYBELE ATASEVER DÜNYA İŞ KONSEYİ",
  htmlLang: "tr",
  nav: {
    home: "Ana Sayfa",
    corporate: "Kurumsal",
    about: "Hakkımızda",
    board: "Kurul Üyeleri",
    contact: "İletişim",
    activities: "Faaliyetler",
    events: "Etkinlikler",
    announcements: "Duyurular",
    news: "Haberler",
    membership: "Üyelik",
    gallery: "Galeri",
    openMenu: "Menüyü aç",
    mainMenu: "Ana menü",
    mobileMenu: "Mobil menü",
  },
  footer: {
    tagline: "İş dünyasını ortak akıl, güven ve uluslararası iş birlikleri etrafında buluşturan bağımsız bir konsey.",
    corporate: "Kurumsal",
    activities: "Faaliyetler",
    followUs: "Bizi Takip Edin",
    contactCta: "Bize Ulaşın",
    rightsReserved: "Tüm hakları saklıdır.",
    privacy: "Gizlilik",
    terms: "Kullanım Koşulları",
  },
  breadcrumbHome: "ANASAYFA",
  langSwitch: { label: "Dili değiştir" },
  contactForm: {
    namePlaceholder: "Adınız Soyadınız",
    emailPlaceholder: "E-posta adresiniz",
    subjectPlaceholder: "Konu",
    messagePlaceholder: "Mesajınız",
    consent: "Gönderdiğim bilgilerin saklanmasını ve benimle iletişime geçilmesini kabul ediyorum.",
    submit: "Mesaj Gönder",
    submitting: "Gönderiliyor…",
    success: "Mesajınız alındı. Ekibimiz en kısa sürede size dönecek.",
    error: "Form gönderilemedi. Lütfen daha sonra tekrar deneyin.",
    defaultName: "Konsey ziyaretçisi",
    defaultMessage: "Konsey iletişim formu",
  },
  membershipForm: {
    ariaLabel: "Üyelik başvuru formu",
    name: "Ad Soyad",
    namePlaceholder: "Adınız Soyadınız",
    email: "E-posta",
    phone: "Telefon",
    phonePlaceholder: "+90 5xx xxx xx xx",
    company: "Şirket / kurum",
    companyPlaceholder: "Şirketinizin adı",
    position: "Görev / unvan",
    positionPlaceholder: "Genel müdür, kurucu, yönetici…",
    sector: "Sektör",
    sectorPlaceholder: "İnşaat, tekstil, lojistik, teknoloji…",
    city: "Şehir",
    cityPlaceholder: "İstanbul",
    website: "Web sitesi (opsiyonel)",
    websitePlaceholder: "www.sirketiniz.com",
    reference: "Referans üye (opsiyonel)",
    referencePlaceholder: "Sizi konseye yönlendiren üye",
    note: "Başvuru notu",
    notePlaceholder: "Faaliyet alanınız, üyelikten beklentiniz ve katkı sunmak istediğiniz sektör kurulu",
    consent: "Başvuru bilgilerimin üyelik değerlendirmesi için saklanmasını ve benimle iletişime geçilmesini kabul ediyorum.",
    submit: "Üyelik Başvurusu Gönder",
    submitting: "Gönderiliyor…",
    success: "Başvurunuz alındı. Konsey sekreteryası değerlendirme sonrasında sizinle iletişime geçecek.",
    error: "Başvuru gönderilemedi. Lütfen daha sonra tekrar deneyin.",
    fieldLabels: { company: "Şirket / kurum", position: "Görev / unvan", sector: "Sektör", city: "Şehir", website: "Web sitesi", reference: "Referans üye" },
    subjectFallback: "Üyelik başvurusu",
  },
  home: {
    heroKicker: "KYBELE ATASEVER DÜNYA İŞ KONSEYİ",
    heroTitleLine1: "İş dünyasını",
    heroTitleLine2: "geleceğe bağlıyoruz.",
    heroSubtitle: "Güven, ortak akıl ve sürdürülebilir iş birlikleri.",
    heroCta: "Üyelik hakkında",
    introEyebrow: "KONSEYİMİZ",
    introTitle: "Sınırları aşan bir iş ağı.",
    introLead: "Kybele ve KADİK; girişimcileri, şirket yöneticilerini ve sektör liderlerini ortak değerler etrafında buluşturan bir dünya iş konseyi olarak çalışır.",
    introText: "Bilgi paylaşımını, ticari bağlantıları ve yeni nesil iş birliklerini güçlendiren programlar düzenliyoruz.",
    introCta: "Konseyi tanıyın",
    principlesEyebrow: "FAALİYET ALANLARIMIZ",
    principlesTitle: "Üyelerimiz için gerçek bağlantılar, somut fırsatlar.",
    principles: [
      { number: "01", title: "İş geliştirme", text: "Yeni pazarlara açılmak ve doğru ortaklarla buluşmak için programlar." },
      { number: "02", title: "Sektör kurulları", text: "Sektörel deneyimi ortak akılla büyüten çalışma grupları." },
      { number: "03", title: "Uluslararası ağ", text: "Dünya genelinde yatırım, ticaret ve temsil bağlantıları." },
    ],
    principlesLink: "Faaliyetleri keşfet ↗",
    bandKicker: "İŞ BİRLİĞİ · VİZYON · GÜVEN",
    bandTitleLine1: "Birlikte büyüyen",
    bandTitleLine2: "bir iş ekosistemi.",
    bandCta: "Üye olun",
    boardKicker: "KYBELE ATASEVER DÜNYA İŞ KONSEYİ",
    boardTitle: "Kurul üyelerimiz",
    boardText: "Farklı sektörlerden iş insanlarını ortak akıl ve yeni iş birlikleri için aynı masada buluşturuyoruz.",
    boardCta: "Tüm kurul",
    boardEmptyTitle: "Kurul kadrosu hazırlanıyor.",
    boardEmptyText: "Kurul üyelerini yönetim panelindeki \"Kurul Üyeleri\" bölümünden ekleyip yayınlayabilirsiniz.",
    boardEmptyLink: "Kurul üyeleri sayfasını görüntüle ↗",
    newsEyebrow: "GÜNCEL",
    newsTitle: "Konseyden haberler",
    newsEmpty: "Yayınlar hazırlanıyor. Yönetim panelindeki \"Yayınlar ve Haberler\" bölümünden yazı ekleyip yayınladığınızda bu alan otomatik güncellenir.",
    newsCta: "Tüm yayınlar",
    readMore: "Devamını oku ↗",
  },
  board: {
    pageTitle: "Kurul Üyeleri",
    introEyebrow: "KONSEY YÖNETİMİ",
    introTitle: "Kurul üyelerimiz",
    introLead: "Kybele ve KADİK Dünya İş Konseyi üyeleriyle tanışın; farklı sektörleri temsil eden iş insanlarımızla bağlantı kurun.",
    emptyTitle: "Kurul üyeleri yakında burada.",
    emptyText: "Yeni kurul üyeleri yönetim panelinden eklenip yayınlandığında bu sayfada görünecek.",
  },
  about: {
    pageTitle: "Hakkımızda",
    heroTitle: "Birlikte büyüyen bir ekosistem.",
    lead: "Kybele ve KADİK; girişimcileri, şirket yöneticilerini ve sektör liderlerini güvene dayalı bir dünya iş ağı içinde buluşturur.",
    text: "Konseyimiz; ticari bağlantıları güçlendiren, bilgi paylaşımını artıran ve üyelerinin uluslararası ölçekte gelişimine katkı sunan programlar tasarlar.",
    cta: "Kurul üyelerini tanıyın",
    wideImageAlt: "İş insanlarının toplantısı",
    statsEyebrow: "RAKAMLARLA",
    statsTitle: "Ortak değerlerimiz",
    stats: [
      { number: "01", label: "Güven odaklı ağ" },
      { number: "02", label: "Sektör kurulu" },
      { number: "03", label: "Uluslararası vizyon" },
      { number: "04", label: "Sürdürülebilir büyüme" },
    ],
    storyEyebrow: "KONSEYİN HİKÂYESİ",
    storyTitle: "Fikirden küresel iş ağına",
    timeline: [
      { year: "2024", title: "Kybele vizyonu doğdu", text: "İş dünyasının farklı sektörlerini ortak hedeflerde buluşturma fikriyle yola çıktık." },
      { year: "2025", title: "KADİK ağı kuruldu", text: "Üyelerimiz için bilgi, bağlantı ve gelişim odaklı bir yapı oluşturduk." },
      { year: "2026", title: "Dünya iş konseyi", text: "Yeni pazarlara açılan, güvenilir ve sürdürülebilir iş birliklerini büyütüyoruz." },
    ],
  },
  events: {
    pageTitle: "Etkinlikler",
    searchAria: "Etkinliklerde ara",
    searchPlaceholder: "Etkinliklerde ara",
    searchButton: "Etkinlik bul",
    viewList: "Liste",
    viewMonth: "Ay",
    viewDay: "Gün",
    prevMonth: "Önceki ay",
    nextMonth: "Sonraki ay",
    thisMonth: "BU AY",
    weekdays: ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"],
    noResults: "Bu tarih için etkinlik bulunamadı.",
    join: "Katıl",
    dateFieldAria: "Etkinlik tarihi",
    dayCellAria: "etkinlikleri",
    events: [
      { date: "2026-09-08", title: "Sektör kurulları ortak toplantısı" },
      { date: "2026-09-15", title: "İhracat ve dış pazarlar paneli" },
      { date: "2026-09-17", title: "Üye şirketler tanışma buluşması" },
      { date: "2026-09-29", title: "Finansmana erişim çalıştayı" },
    ],
  },
  membership: {
    pageTitle: "Üyelik Başvurusu",
    eyebrow: "KONSEY AİLESİ",
    title: "İş ağınızı büyütün.",
    lead: "Kybele ve KADİK üyeliğiyle bilgiye, bağlantıya ve yeni ticari fırsatlara daha yakın olun.",
    text: "Üyelik; şirket sahipleri, yöneticiler ve profesyoneller için kurumsal bir başvuru süreciyle işler. Başvurunuz konsey sekreteryası tarafından değerlendirilir, ardından sizi uygun sektör kurulu ve çalışma gruplarıyla buluştururuz.",
    steps: [
      { number: "01", text: "Başvuru formunu şirket ve sektör bilgilerinizle doldurun." },
      { number: "02", text: "Sekreterya başvurunuzu inceler ve sizinle ön görüşme yapar." },
      { number: "03", text: "Yönetim kurulu değerlendirmesinin ardından üyelik kaydınız tamamlanır." },
      { number: "04", text: "Sektör kurullarına, etkinliklere ve iş birliği programlarına katılmaya başlarsınız." },
    ],
  },
  announcements: {
    pageTitle: "Duyurular",
    eyebrow: "KONSEYDEN",
    title: "Gündem ve duyurular",
    lead: "Üyelerimizi etkinlikler, sektör kurulları, iş fırsatları ve konsey çalışmalarındaki gelişmeler hakkında düzenli olarak bilgilendiriyoruz.",
    items: ["Sektör kurulları", "Üyelik duyuruları", "Uluslararası iş fırsatları", "Eğitim ve gelişim", "Ticaret heyetleri", "Konsey buluşmaları", "Yayınlar", "İş birlikleri"],
    itemText: "İş dünyasının gündemini, üyelerimizin gelişimini ve yeni bağlantıları destekleyen güncel başlıklar.",
    itemCta: "Detaylı bilgi ↗",
    ctaTitle: "Konsey gündeminden haberdar olun.",
    ctaButton: "Bize ulaşın",
  },
  news: {
    pageTitle: "Yayınlar",
    typeLabel: "Yazı türü:",
    all: "Tümü",
    searchAria: "Yazılarda ara",
    searchPlaceholder: "Ara…",
    emptyNoContent: "Yayınlar hazırlanıyor. Yönetim panelinden yazı ekleyip yayınladığınızda burada listelenir.",
    emptyNoMatch: "Aramanıza uygun yazı bulunamadı.",
    searchHeading: "Arama",
    categoriesHeading: "Kategoriler",
    announcementsLink: "Duyurular",
    readMore: "Devamını oku ↗",
  },
  article: {
    tagsLabel: "ETİKETLER:",
    brandTag: "KADİK",
    industryTag: "İŞ DÜNYASI",
  },
  contact: {
    pageTitle: "İletişim",
    eyebrow: "KONSEY SEKRETERYASI",
    title: "İş birliğini konuşalım.",
    lead: "Üyelik, sektör kurulları, etkinlikler ve uluslararası iş bağlantıları hakkında bize ulaşın.",
    addressLabel: "Adres",
    address: "İstanbul, Türkiye",
    phoneLabel: "Telefon",
    phone: "+90 (212) 000 00 00",
    emailLabel: "E-posta",
    email: "merhaba@kadik.org",
  },
  gallery: {
    pageTitle: "Galeri",
    categories: ["Etkinlikler", "Toplantılar", "İş Gezileri"],
    all: "Tümü",
    close: "Kapat",
    lightboxAria: "Galeri görseli",
    enlargedAlt: "Büyütülmüş galeri görseli",
  },
  legal: {
    privacyTitle: "Gizlilik Politikası",
    termsTitle: "Kullanım Koşulları",
    lead: "Bu metin, Kybele ve KADİK web sitesini kullanırken haklarınızı ve sorumluluklarınızı açıklar.",
    privacySections: [
      ["1. Giriş", "Kybele ve KADİK olarak kişisel verilerinizin korunmasına önem veriyoruz. Bu metin, web sitemizi kullanırken hangi bilgilerin toplandığını ve nasıl kullanıldığını açıklar."],
      ["2. Toplanan veriler", "İletişim ve üyelik formlarında paylaştığınız bilgiler yalnızca talebinizi karşılamak ve sizinle iletişim kurmak amacıyla işlenir."],
      ["3. Saklama ve güvenlik", "Veriler yetkisiz erişime karşı korunan sistemlerde, gerekli olduğu süre boyunca saklanır. Yasal yükümlülükler dışında üçüncü kişilerle paylaşılmaz."],
      ["4. Haklarınız", "Kişisel verilerinize erişme, düzeltme, silme ve işlemeye itiraz etme hakkına sahipsiniz. Talepleriniz için merhaba@kadik.org adresinden bize ulaşabilirsiniz."],
    ],
    termsSections: [
      ["1. Hizmetin kullanımı", "Siteyi yalnızca hukuka uygun amaçlarla kullanmayı kabul edersiniz. İçerikleri izinsiz çoğaltamaz, site güvenliğini tehlikeye atacak girişimlerde bulunamazsınız."],
      ["2. İçerik ve bağlantılar", "Sitedeki içerikler bilgilendirme amacıyla sunulur. Harici bağlantıların içeriklerinden Kybele ve KADİK sorumlu değildir."],
      ["3. Değişiklikler", "Koşullar gerektiğinde güncellenebilir. Güncel metin bu sayfada yayınlanır."],
    ],
  },
  notFound: {
    pageTitle: "Sayfa Bulunamadı",
    code: "404",
    heading: "Aradığınız sayfaya ulaşamadık.",
    text: "Bağlantı taşınmış, adresi değişmiş ya da yayından kaldırılmış olabilir. Konsey içeriklerine aşağıdaki bölümlerden ulaşabilir, aradığınızı bulamazsanız sekreteryaya yazabilirsiniz.",
    home: "Ana sayfaya dön",
    contactCta: "İletişime geçin",
    linksLabel: "Site bölümleri",
    links: [
      { key: "about", title: "Hakkımızda", text: "Konseyin vizyonu, çalışma alanları ve hikâyesi." },
      { key: "board", title: "Kurul Üyeleri", text: "Yönetim kurulu ve sektör temsilcilerimiz." },
      { key: "posts", title: "Yayınlar", text: "Haberler, makaleler ve konsey değerlendirmeleri." },
      { key: "events", title: "Etkinlikler", text: "Toplantı, panel ve program takvimi." },
      { key: "membership", title: "Üyelik Başvurusu", text: "Konsey ailesine katılmak için başvuru formu." },
      { key: "gallery", title: "Galeri", text: "Faaliyetlerimizden fotoğraf seçkisi." },
    ],
  },
};

export const KADIK_DICT: Record<KadikLocale, KadikDictionary> = { en, tr };
