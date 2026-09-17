/**
 * Single source of truth for the KADİK site's page keys and copy. English
 * is the site's only structural locale - the public site has no `/tr`
 * route tree. Turkish and every other language are handled exclusively by
 * `components/GoogleTranslateWidget.tsx`'s client-side Google Translate
 * integration, never by a parallel route or dictionary here.
 * `components/KadikSite.tsx` is the only consumer.
 */

export type KadikLocale = "en";

export const KADIK_LOCALES: readonly KadikLocale[] = ["en"];

export const KADIK_DEFAULT_LOCALE: KadikLocale = "en";


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

/** One canonical, prefixless address per page. `post`'s entry is the list
 * root - a post detail page resolves its own path via `kadikPostPath`. */
export const KADIK_PATHS: Record<KadikPageKey, Record<KadikLocale, string>> = {
  home: { en: "/" },
  about: { en: "/about" },
  board: { en: "/board" },
  events: { en: "/events" },
  membership: { en: "/membership" },
  issues: { en: "/announcements" },
  posts: { en: "/news" },
  post: { en: "/news" },
  contact: { en: "/contact" },
  gallery: { en: "/gallery" },
  privacy: { en: "/privacy-policy" },
  terms: { en: "/terms" },
  notfound: { en: "/" },
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
export const KADIK_DICT: Record<KadikLocale, KadikDictionary> = { en };
