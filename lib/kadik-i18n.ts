/**
 * Single source of truth for the KADİK site's page keys and copy. English
 * is the site's only structural locale - the public site has no `/tr`
 * route tree. Turkish and every other language are handled exclusively by
 * `components/GoogleTranslateWidget.tsx`'s client-side Google Translate
 * integration, never by a parallel route or dictionary here.
 * These are factory defaults: `lib/kadik-content` stores the admin-edited
 * copy in the database and merges it over this dictionary at render time.
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
  | "charter"
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
  charter: { en: "/charter" },
  notfound: { en: "/" },
};

export function kadikPostPath(locale: KadikLocale, slug: string): string {
  return `${KADIK_PATHS.posts[locale]}/${slug}`;
}

/** An image slot on a KADİK page. `assetId` is set when the editor picked a
 * `MediaAsset` from the library; `null` means the bundled default image under
 * `public/kadik` is shown. The public renderer only ever reads `url`. */
export type KadikImage = Readonly<{ url: string; assetId: string | null }>;

export type KadikLegalPage = Readonly<{
  title: string;
  lead: string;
  sections: readonly Readonly<{ heading: string; text: string }>[];
}>;

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
    charter: string;
    socials: Readonly<{ facebook: string; youtube: string; x: string }>;
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
    heroImage: KadikImage;
    bandImage: KadikImage;
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
    image: KadikImage;
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
    items: readonly Readonly<{ image: KadikImage; category: string; alt: string }>[];
    all: string;
    close: string;
    lightboxAria: string;
    enlargedAlt: string;
  }>;
  privacy: KadikLegalPage;
  terms: KadikLegalPage;
  charter: KadikLegalPage;
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

/** Bundled default image shipped in `public/kadik`. */
export const KADIK_STATIC_IMAGE_ROOT = "/kadik/";

function staticImage(file: string): KadikImage {
  return { url: `${KADIK_STATIC_IMAGE_ROOT}${file}`, assetId: null };
}

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
    charter: "Charter",
    socials: { facebook: "#facebook", youtube: "#youtube", x: "#x" },
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
    heroImage: staticImage("is-hero.webp"),
    bandImage: staticImage("is-band.webp"),
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
    image: staticImage("is-hakkimizda.webp"),
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
    items: Array.from({ length: 9 }, (_, index) => {
      const category = ["Events", "Meetings", "Business Trips"][index % 3];
      return { image: staticImage(`is-galeri-${index + 1}.webp`), category, alt: `KADIK ${category.toLowerCase()} ${index + 1}` };
    }),
    all: "All",
    close: "Close",
    lightboxAria: "Gallery image",
    enlargedAlt: "Enlarged gallery image",
  },
  privacy: {
    title: "Privacy Policy",
    lead: "This text explains your rights and responsibilities when using the Kybele and KADİK website.",
    sections: [
      { heading: "1. Introduction", text: "At Kybele and KADİK, we take the protection of your personal data seriously. This text explains what information is collected while using our website and how it is used." },
      { heading: "2. Data collected", text: "Information you share on contact and membership forms is processed solely to handle your request and to get in touch with you." },
      { heading: "3. Storage and security", text: "Data is kept on protected systems for as long as necessary. It is not shared with third parties except where legally required." },
      { heading: "4. Your rights", text: "You have the right to access, correct, delete and object to the processing of your personal data. For requests, you can reach us at hello@kadiklondon.org." },
    ],
  },
  terms: {
    title: "Terms of Use",
    lead: "This text explains your rights and responsibilities when using the Kybele and KADİK website.",
    sections: [
      { heading: "1. Use of the service", text: "You agree to use the site only for lawful purposes. You may not reproduce content without permission or attempt to compromise the site's security." },
      { heading: "2. Content and links", text: "Content on the site is provided for informational purposes. Kybele and KADİK are not responsible for the content of external links." },
      { heading: "3. Changes", text: "These terms may be updated as needed. The current text is published on this page." },
    ],
  },
  charter: {
    title: "Charter",
    lead: "This Charter sets out the name, purpose, governance structure and operating rules of the Kybele Atasever World Business Council (KADİK).",
    sections: [
      { heading: "1. Name of the Organisation", text: "The organisation's full name is the Kybele Atasever World Business Council, referred to for short as the Council, Kybele, or KADİK." },
      { heading: "2. Headquarters and Branches", text: "The Council is headquartered in London. Branches, representative offices, and new bodies, institutions and enterprises may be opened worldwide as directed by the Board of Directors." },
      { heading: "3. Purpose", text: "Alongside establishing a more democratic business world, the Council works for the unity, wellbeing, success, revival, advancement, continuity and other stated aims of Turkish business people around the world. As a secular, democratic organisation, its line may not be altered by any General Assembly. Depending on the conjuncture, its principal subjects will include the areas set out below." },
      { heading: "4. Core Policy Areas", text: "(1) Foreign Policy and the European Union: EU-Turkey relations and the democratisation of the business world; relations with European social democrats; relations with neighbouring countries; multilateral diplomacy under the principle of peace at home, peace in the world. (2) Defence, Security and NATO: NATO and European security; organising for peace and supporting - and where necessary leading - the business world's efforts toward peace; work toward ending wars and building lasting peace. (3) Migration, Refugees and Integration Policy: global migration relations; peaceful solutions to refugee policy, including opening pathways to entrepreneurship; contributions to integration processes and to society's welfare and fair distribution; combating irregular migration and human trafficking. (4) Social Democracy and the Social State in Europe and the World: the social state and the fair distribution of income, welfare and knowledge, and the prevention of poverty; income distribution and the business world's role in it; working life and democracy; trade unions and their role in working life; welfare-state models and balanced income distribution." },
      { heading: "5. Further Focus Areas", text: "Further standing subjects include the digital economy; climate, environment and energy; democracy, the rule of law and human rights, including judicial independence and the protection of fundamental rights and democratic institutions; diaspora policy, including the concerns and participation of the Turkish community in Europe and comparative diaspora policy; local government and European urban policy; digitalisation, artificial intelligence and technology policy; and any other field the Council identifies as necessary." },
      { heading: "6. Working Groups and Measuring Success", text: "The Council maintains a flexible structure that may open and close subject areas and working groups as needed. The Council's success must be measured not by the number of meetings it holds but by the research, policy notes, comparative analyses and actionable policy proposals it produces. Each working group must deliver at least a few policy reports per year, to be presented to the relevant bodies and to the public." },
      { heading: "7. Global Organisational Structure", text: "The Council brings Economy, Industry and Green Transition together into a coordination and policy-making mechanism with its own democratic representative institutions, and its bodies organise on a world scale in compliance with each country's law. In every country, the division of labour includes a Countries' Conference, an International Executive Committee, coordination with the Presidency/Headquarters, policy and strategy commissions, women's and youth structures, and horizontal organisation and collective work. Continental or regional coordination bodies may be established where needed." },
      { heading: "8. Country Representation and Delegates", text: "Every country must be enabled to send Council representatives and delegates, preserving both democratic equality and organisational weight in representation. Where needed for internal democracy, the Board of Directors may hold digital elections and voting under notarial supervision. A base number of delegates is set for each country, with additional delegates added according to registered membership; a ceiling on delegate numbers may be introduced for very large countries, and women's and youth representation is separately guaranteed. Membership numbers are calculated from verified, regularly updated central membership records. Candidates for certain offices within the organisation may be required to meet role-specific criteria - such as language proficiency, international political experience, representational ability and relevant expertise - provided such criteria rest on clear, pre-established standards rather than subjective conditions that restrict the right to stand for election." },
      { heading: "9. Country Federations", text: "A multi-layered structure may be formed consisting of a Country Federation, organisations within the country, and city or regional organisations. Federating strengthens nationwide political coordination while preserving local organisations' local activities. The duties of country federations include nationwide political coordination; relations with fraternal social-democratic circles, trade unions and civil-society organisations; conveying the organisation's politics and the countries' agenda; coordinating nationwide meetings and campaigns; and sending country representatives and delegates. Where only one or two groups exist in a country, a direct-unity model may continue instead, so that every country is not forced into the same organisational mould but a graduated, flexible structure is built according to each country's organisational size and needs." },
      { heading: "10. Use of the KYBELE Name", text: "Where the KYBELE name cannot be used under a country's legislation or relevant law, an alternative name reflecting the international social-democratic identity may be used instead." },
      { heading: "11. External Relations and Partnerships", text: "The Council must build relations with likeminded local parties and the business world, with municipalities, trade unions, European left parties, migrant entrepreneurs and their organisations, human-rights organisations, women's and youth organisations, academic circles, and democratic civil-society organisations, and country organisations may cooperate with one another in an advocacy capacity. Council organisations should strive to become active actors in the political life of the countries in which they are based, and international agreements will facilitate such work. The Council also supports and builds scientific contribution as an institute, and gives due attention to education, instruction and the management of information." },
      { heading: "12. The General Assembly", text: "The Council's highest authority is the General Assembly (Kurultay). Except where unavoidable, the General Assembly convenes without delegates, with the participation of all members, and elects one-third of the Board of Directors; for this reason the General Assembly is held once every two years. The Presidency prepares the date and change schedule and communicates it to the electorate no later than three months before the General Assembly." },
      { heading: "13. Candidates and Elections", text: "Candidates standing for election have their qualifications confirmed by the Board of Directors and are announced together with their CVs and asset declarations. Candidates may not run election campaigns or incur campaign expenditure. The necessary information is conveyed to the electorate by the relevant Election Board, which must ensure equality among candidates." },
      { heading: "14. Renewal of the Board and Presiding Board", text: "The General Assembly elects the Board of Directors and the Presiding Board; one-third of the Board of Directors and of the Presiding Board is renewed once a year. The new Board convenes the following day to allocate responsibilities. The President and Vice-President are ex officio spokespeople, and the duties and powers of the President and of officers are determined by a two-thirds majority." },
      { heading: "15. Quorum and Convening", text: "The General Assembly begins its work with an absolute majority of those eligible to vote; in digital elections, applying to vote in advance is mandatory. If the required majority is not reached at the first meeting, a second meeting is opened one week later with the members present. The General Assembly also convenes within 45 days of a decision of the Board of Directors or the Supervisory Board, or upon the written request of one-third of the members to the Presidency." },
      { heading: "16. The Presiding Board and Its Decisions", text: "The number of Presiding Board members is set at each General Assembly for the following General Assembly. Following the General Assembly's decision, the Presiding Board acts as the organiser of the election proceedings and functions similarly to a Board of Honour. To conduct the General Assembly's proceedings, it elects, from among its members or, where necessary, from outside, a President, a Deputy President and a Secretary. Decisions are taken by majority of those present, and the matters discussed and decisions taken are recorded in minutes and signed by the six members of the Election Board." },
      { heading: "17. Voting Rights and Procedure", text: "Every member of the General Assembly, including members of the Election Board, has an individual right to vote. A member unable to attend may send a proxy; no one person may hold more than one proxy. Voting may be secret or open ballot, as decided by the General Assembly. The agenda is set by the Presiding Board and the Board of Directors at their meeting, and the General Assembly must conclude with at least one scientific declaration of its results. Voting alone, by preference only, may not be the sole method used, and list-based elections are prohibited; the General Assembly may make whatever changes it wishes to the agenda of any of its meetings." },
      { heading: "18. Powers and Duties of the General Assembly", text: "The General Assembly's powers and duties are: to elect one-third of the members of the Board of Directors and of the Supervisory Board; to amend the Charter and agreements where two-thirds of the full founding membership is achieved; to examine the reports of the Board of Directors and the Supervisory Board together with the balance sheet and profit-and-loss accounts, and to discharge the Board of Directors; to make changes and additions to the meeting agenda where it deems necessary; and to take binding or advisory decisions on the Council's functioning and ongoing work." },
      { heading: "19. The Board of Directors", text: "The Council is administered through its Board of Directors, which has seven members in total. A seat does not fall vacant except for reasons such as ill health or resignation, and in the event of a conflict the Presiding Board intervenes to resolve the matter. Usefulness to the Council, multilingualism, merit and competence are the primary qualities sought in members and in any further Board members elected." },
      { heading: "20. Operations of the Board of Directors", text: "The Board of Directors may convene by absolute majority or online, and decisions may also be taken in writing where necessary. Meetings are always recorded in minutes, and decisions are binding." },
      { heading: "21. Representation", text: "The Council is represented by two persons acting jointly: the President or the Vice-President together with one member. Day-to-day management is determined by the Board of Directors." },
      { heading: "22. Powers and Duties of the Board of Directors", text: "The powers and duties of the Board of Directors are: (a) to regulate and carry out every decision and condition relating to the Council's work; and (b) to acquire, hold and dispose of - whether by purchase, lease, gift, bequest or any other disposition upon death - every kind of movable and immovable property, monies, rights of pecuniary value, shares, receivables and similar valuable instruments, and rights of usufruct, habitation and bare ownership, on behalf of the Council, to accept releases arising from such acquisitions, to conduct any other private or official business, to borrow, and to establish, accept and discharge mortgages in the Council's favour or against it. Each outgoing Board hands over its duties with a neutral budget, and where debt has accumulated, the Board members who signed the relevant decision are jointly liable." },
      { heading: "23. Supervisory Board", text: "The Supervisory Board consists of auditors. Where a seat falls vacant for reasons of health or resignation, the General Assembly elects the vacant auditor's replacement. The Supervisory Board audits every activity of the Council, may call the General Assembly into session where necessary, and submits a report for annual publication at the end of each activity year." },
      { heading: "24. Finance", text: "The Council's initial financial assets are determined by the provisional Board of Directors. Its income consists of: (a) grants, donations, membership dues, operating income and similar; (b) movable and immovable property and monies left or transferred by testamentary disposition; and (c) income from bodies established by the Council and other income - all of which is spent entirely in furtherance of the Council's purpose." },
      { heading: "25. Amendments to the Charter", text: "The Charter and its decisions may be amended on the proposal of at least five members of the Board of Directors or the General Assembly and by a two-thirds majority decision of the General Assembly." },
      { heading: "26. Dissolution and Liquidation", text: "In the event of dissolution and liquidation, the Council's movable and immovable property together with its rights and receivables are donated to a secular, democratic organisation." },
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
/** Factory defaults - the content shipped with the code. The live site reads
 * the admin-edited copy from the database (`lib/kadik-content`), which is
 * merged on top of these values field by field. */
export const KADIK_DICT: Record<KadikLocale, KadikDictionary> = { en };
