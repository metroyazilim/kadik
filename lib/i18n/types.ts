// The translation contract. Every locale file implements `Dictionary`, so a
// missing key or a wrong number of cards is a compile error rather than a hole
// that only shows up on one language's page.
//
// Fixed-length tuples are deliberate: the layouts are grids of a known size
// (four services, three projects, two testimonials). A `string[]` would let a
// translation ship three services and still typecheck.
import type { NavKey } from "./static-pages";

export interface NavChild {
  label: string;
  href: NavKey;
}

export interface NavEntry {
  label: string;
  href: NavKey;
  children?: NavChild[];
}

export interface Feature {
  title: string;
  text: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface ProjectEntry {
  category: string;
  title: string;
}

export interface PersonEntry {
  /**
   * Person names are NOT translated - they are the same people in every
   * language. Locales may transliterate into their own script; leaving the
   * Latin spelling is also correct.
   */
  name: string;
  role: string;
}

export interface PostEntry {
  day: string;
  month: string;
  category: string;
  title: string;
}

export interface Dictionary {
  meta: {
    home: { title: string; description: string };
    about: { title: string; description: string };
    blog: { title: string; description: string };
    services: { title: string; description: string };
    products: { title: string; description: string };
    projects: { title: string; description: string };
    faq: { title: string; description: string };
    terms: { title: string; description: string };
    privacy: { title: string; description: string };
    contact: { title: string; description: string };
    search: { title: string; description: string };
    missionVision: { title: string; description: string };
    partners: { title: string; description: string };
  };

  common: {
    loading: string;
    readMore: string;
    home: string;
    learnMore: string;
    contactUs: string;
    getQuote: string;
    callUsNow: string;
    callAnytime: string;
    search: string;
    openMenu: string;
    closeMenu: string;
    language: string;
    followUs: string;
    brandTrust: string;
    brandAlt: string;
    allServices: string;
    allMembers: string;
    allProjects: string;
    prevProject: string;
    nextProject: string;
    editor: string;
    ratingLabel: string;
    emailLabel: string;
    emailPlaceholder: string;
    subscribe: string;
    /** Page-chrome text (not About content itself), mirrors `serviceDetailPage.fallbackNotice`'s pattern - shown when `/hakkimizda`'s CMS content renders the Turkish fallback in a non-Turkish locale. */
    aboutFallbackNotice: string;
  };

  nav: NavEntry[];

  hero: {
    eyebrow: string;
    titleTop: string;
    titleBottom: string;
    text: string;
    imageAlt: string;
  };

  about: {
    subtitle: string;
    title: string;
    text: string;
    imageAlt: string;
    checklist: [string, string, string];
    statValue: string;
    statLabel: string;
  };

  services: {
    subtitle: string;
    title: string;
    cardText: string;
    items: [string, string, string, string];
    bannerTitle: string;
  };

  process: {
    subtitle: string;
    title: string;
    stepText: string;
    items: [string, string, string, string];
  };

  achievements: {
    subtitle: string;
    title: string;
    items: [Stat, Stat, Stat, Stat];
  };

  projects: {
    subtitle: string;
    title: string;
    items: [ProjectEntry, ProjectEntry, ProjectEntry];
  };

  marquee: [string, string, string];

  team: {
    subtitle: string;
    title: string;
    members: [PersonEntry, PersonEntry, PersonEntry, PersonEntry];
  };

  testimonials: {
    subtitle: string;
    title: string;
    quote: string;
    items: [PersonEntry, PersonEntry];
  };

  blog: {
    subtitle: string;
    title: string;
    posts: [PostEntry, PostEntry, PostEntry];
  };

  footer: {
    /** Labels above the phone / e-mail / location values in the contact ribbon. */
    contactLabels: [string, string, string];
    locationValue: string;
    summary: string;
    quickLinksTitle: string;
    quickLinks: [string, string, string, string, string];
    recentTitle: string;
    recentPosts: [string, string];
    reachTitle: string;
    address: string;
    copyright: string;
    terms: string;
    privacy: string;
  };

  servicesPage: {
    banner: string;
    subtitle: string;
    title: string;
    intro: string;
    empty: string;
    faqSubtitle: string;
    faqTitle: string;
    quoteTitle: string;
    quoteText: string;
    quoteCta: string;
  };

  serviceDetailPage: {
    sidebarTitle: string;
    hoursTitle: string;
    hoursText: string;
    helpTitle: string;
    helpText: string;
    helpCta: string;
    relatedTitle: string;
    backLabel: string;
    fallbackNotice: string;
  };

  teamDetailPage: {
    backLabel: string;
    contactTitle: string;
    skillsTitle: string;
    experienceTitle: string;
    educationTitle: string;
  };

  faqPage: {
    banner: string;
    subtitle: string;
    title: string;
    intro: string;
    empty: string;
  };

  legalPage: {
    termsBanner: string;
    termsTitle: string;
    termsUpdated: string;
    privacyBanner: string;
    privacyTitle: string;
    privacyUpdated: string;
    updatedLabel: string;
  };

  contactPage: {
    banner: string;
    subtitle: string;
    title: string;
    intro: string;
    infoTitle: string;
    phoneLabel: string;
    emailLabel: string;
    addressLabel: string;
    formTitle: string;
    nameLabel: string;
    emailFieldLabel: string;
    phoneFieldLabel: string;
    subjectLabel: string;
    messageLabel: string;
    submitLabel: string;
    sendingLabel: string;
    successMessage: string;
    errorMessage: string;
    rateLimitedMessage: string;
  };

  searchPage: {
    banner: string;
    title: string;
    placeholder: string;
    submitLabel: string;
    noQuery: string;
    empty: string;
    resultsPrefix: string;
    categoryPosts: string;
    categoryServices: string;
    categoryProducts: string;
    categoryProjects: string;
    categoryTeam: string;
  };

  productsPage: {
    banner: string;
    subtitle: string;
    title: string;
    intro: string;
    empty: string;
    ctaLabel: string;
  };

  productDetailPage: {
    backLabel: string;
    featuresTitle: string;
    galleryTitle: string;
    ctaLabel: string;
  };

  missionVisionPage: {
    banner: string;
    subtitle: string;
    title: string;
    missionTitle: string;
    visionTitle: string;
    valuesSubtitle: string;
    valuesTitle: string;
    values: [Feature, Feature, Feature, Feature];
    indicatorsSubtitle: string;
    indicatorsTitle: string;
    ctaTitle: string;
    ctaText: string;
  };

  partnersPage: {
    banner: string;
    subtitle: string;
    title: string;
    intro: string;
    empty: string;
  };

  projectsPage: {
    banner: string;
    subtitle: string;
    title: string;
    intro: string;
    empty: string;
  };

  projectDetailPage: {
    backLabel: string;
    challengeTitle: string;
    solutionTitle: string;
    galleryTitle: string;
    clientLabel: string;
    categoryLabel: string;
  };
}
