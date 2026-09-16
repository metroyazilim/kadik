import type { Dictionary } from "../types";

export const en: Dictionary = {
  meta: {
    home: {
      title: "Starter Kurumsal - IT Solutions and Technology",
      description:
        "Starter Kurumsal helps businesses grow with database security, IT consulting, application development, and scalable cloud infrastructure solutions.",
    },
    about: {
      title: "About Us | Starter Kurumsal",
      description:
        "Meet the Starter Kurumsal team and discover how our proven process, expert guidance, and modern technology turn business goals into lasting success.",
    },
    blog: {
      title: "Blog | Starter Kurumsal",
      description: "Read Starter Kurumsal's latest articles on technology, security and IT services.",
    },
    services: {
      title: "Our Services | Starter Kurumsal",
      description: "Explore our database security, IT consulting, application development and cloud infrastructure services.",
    },
    products: {
      title: "Our Products | Starter Kurumsal",
      description: "Browse the software products Starter Kurumsal builds for businesses.",
    },
    projects: {
      title: "Our Projects | Starter Kurumsal",
      description: "A selection of technology projects we have delivered for our clients.",
    },
    faq: {
      title: "Frequently Asked Questions | Starter Kurumsal",
      description: "The most common questions about our services, process and collaboration.",
    },
    terms: {
      title: "Terms & Conditions | Starter Kurumsal",
      description: "Terms of use for the Starter Kurumsal website and services.",
    },
    privacy: {
      title: "Privacy Policy | Starter Kurumsal",
      description: "How Starter Kurumsal collects and uses personal data.",
    },
    contact: {
      title: "Contact | Starter Kurumsal",
      description: "Get in touch with the Starter Kurumsal team.",
    },
    search: {
      title: "Search | Starter Kurumsal",
      description: "Search across blog posts, services, products, projects and team members.",
    },
    missionVision: {
      title: "Our Mission & Vision | Starter Kurumsal",
      description: "Starter Kurumsal's mission, vision and values.",
    },
    partners: {
      title: "Our Partners | Starter Kurumsal",
      description: "Discover Starter Kurumsal's trusted partners and brand references.",
    },
  },

  common: {
    loading: "Loading",
    readMore: "Read More",
    home: "Home",
    learnMore: "Learn More",
    contactUs: "Contact Us",
    getQuote: "Get A Quote",
    callUsNow: "Call Us Now",
    callAnytime: "Call Us Anytime",
    search: "Search",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    language: "Select language",
    followUs: "Follow Us:",
    brandTrust: "Trusted by 1,000+ Brands",
    brandAlt: "Trusted brand",
    allServices: "View All Services",
    allMembers: "View All Members",
    allProjects: "View All Projects",
    prevProject: "Previous project",
    nextProject: "Next project",
    editor: "Editor",
    ratingLabel: "5 / 5",
    emailLabel: "Your email address",
    emailPlaceholder: "Your email address",
    subscribe: "Subscribe",
    aboutFallbackNotice: "This content is not yet published in English; showing the Turkish version.",
  },

  nav: [
    { label: "Home", href: "home" },
    { label: "About Us", href: "about" },
    {
      label: "Services",
      href: "services",
      children: [
        { label: "Our Services", href: "services" },
        { label: "Our Products", href: "products" },
      ],
    },
    {
      label: "Portfolio",
      href: "missionVision",
      children: [
        { label: "Mission & Vision", href: "missionVision" },
        { label: "Partners", href: "partners" },
        { label: "Our Projects", href: "projects" },
        { label: "FAQ", href: "faq" },
      ],
    },
    { label: "Blog", href: "blog" },
    { label: "Contact", href: "contact" },
  ],

  hero: {
    eyebrow: "a leading IT company",
    titleTop: "Grow Your Business With This IT",
    titleBottom: "Solution",
    text: "We help your business stay ahead with modern infrastructure, secure systems, and an expert team. Starter Kurumsal puts technology to work for your growth.",
    imageAlt: "The Starter Kurumsal team working around a meeting table",
  },

  about: {
    subtitle: "ABOUT US",
    title: "Supporting Our Clients With the Right Solutions",
    text: "Our experienced team supports your business growth with the right strategies and modern technologies.",
    imageAlt: "The Starter Kurumsal team working together around a meeting table",
    checklist: [
      "Brand and Design Identity",
      "Website Marketing Solutions",
      "Unlimited Data Downloads",
    ],
    statValue: "6,561+",
    statLabel: "Satisfied Clients",
  },

  services: {
    subtitle: "What We Do",
    title: "Solving IT Challenges Through Technology",
    cardText: "We move your business forward with reliable infrastructure and an expert team.",
    items: [
      "Database Security",
      "IT Consulting",
      "Application Development",
      "Cloud Infrastructure Solutions",
    ],
    bannerTitle: "Stay Connected With Cutting-Edge IT Solutions",
  },

  process: {
    subtitle: "How We Work",
    title: "Our Standard Work Process",
    stepText: "Our expert team supports you at every step with a fast and transparent process.",
    items: ["Choose a Service", "Define Your Needs", "Request a Consultation", "Get the Final Solution"],
  },

  achievements: {
    subtitle: "our achievements",
    title: "Driving Business Success",
    items: [
      { value: "6,561", label: "Satisfied Clients" },
      { value: "600", label: "Completed Projects" },
      { value: "250", label: "Expert Professionals" },
      { value: "590", label: "Media Features" },
    ],
  },

  projects: {
    subtitle: "PROJECTS",
    title: "Our Latest Client Projects",
    items: [
      { category: "Technology", title: "Software Development" },
      { category: "Technology", title: "Software Development" },
      { category: "Solutions", title: "Analytics Solutions" },
    ],
  },

  marquee: ["Technology", "Data Security", "Cybersecurity"],

  team: {
    subtitle: "TEAM MEMBERS",
    title: "Meet Our Dedicated Team",
    members: [
      { name: "Ahmet Kaya", role: "Web Designer" },
      { name: "Elif Şahin", role: "Cybersecurity Specialist" },
      { name: "Burak Öztürk", role: "Web Specialist" },
      { name: "Zeynep Aydın", role: "Data Analyst" },
    ],
  },

  testimonials: {
    subtitle: "TESTIMONIALS",
    title: "Trusted by Those Who Know Us",
    quote:
      "Their professional team, fast solutions, and transparent communication delivered a service that exceeded our expectations.",
    items: [
      { name: "Ayşe Yılmaz", role: "Web Designer" },
      { name: "Mehmet Demir", role: "Healthcare Assistant" },
    ],
  },

  blog: {
    subtitle: "LATEST BLOG POSTS",
    title: "Explore Our Latest News and Insights",
    posts: [
      {
        day: "24",
        month: "May",
        category: "Cybersecurity",
        title: "Five Leading Trends in Technology",
      },
      {
        day: "17",
        month: "May",
        category: "IT Services",
        title: "Simple, Fast, and Effective IT Solutions",
      },
      {
        day: "08",
        month: "May",
        category: "Technology",
        title: "Unlocking Potential Through Technology",
      },
    ],
  },

  footer: {
    contactLabels: ["Call Us Anytime", "Get A Quote", "Location"],
    locationValue: "Levent, İstanbul",
    summary:
      "Starter Kurumsal is a full-service IT agency that helps businesses move faster with secure, practical technology.",
    quickLinksTitle: "Quick Links",
    quickLinks: ["About Us", "Our Services", "Our Blog", "FAQ", "Contact Us"],
    recentTitle: "Recent Posts",
    recentPosts: ["Top 5 Technology Trends", "IT Solutions for the Digital Future"],
    reachTitle: "Contact Us",
    address: "Büyükdere Ave. No. 12, Levent, Şişli, İstanbul",
    copyright: "© 2026 Starter Kurumsal. All rights reserved.",
    terms: "Terms and Conditions",
    privacy: "Privacy Policy",
  },

  servicesPage: {
    banner: "Our Services",
    subtitle: "What We Do",
    title: "IT Services That Grow Your Business",
    intro: "From database security to cloud infrastructure, we deliver every IT service your business needs under one roof.",
    empty: "Our service list is being updated. It will be here shortly.",
    faqSubtitle: "Frequently Asked",
    faqTitle: "Questions About Our Services",
    quoteTitle: "Want a Quote for Your Project?",
    quoteText: "Tell us about your needs and let's plan the right solution together.",
    quoteCta: "Request a Quote",
  },

  serviceDetailPage: {
    sidebarTitle: "All Services",
    hoursTitle: "Working Hours",
    hoursText: "Monday - Friday: 09:00 - 18:00",
    helpTitle: "Need help?",
    helpText: "Our team is ready to answer your questions.",
    helpCta: "Contact Us",
    relatedTitle: "Other Services You May Like",
    backLabel: "Back to all services",
    fallbackNotice: "This content is not yet published in English; showing the Turkish version.",
  },

  teamDetailPage: {
    backLabel: "Back to all team members",
    contactTitle: "Contact Information",
    skillsTitle: "Skills",
    experienceTitle: "Experience",
    educationTitle: "Education",
  },

  faqPage: {
    banner: "Frequently Asked Questions",
    subtitle: "FAQ",
    title: "Answers to Your Questions",
    intro: "We gathered the most common questions about our services, process and collaboration. Can't find what you're looking for? Get in touch.",
    empty: "There are no published questions at the moment.",
  },

  legalPage: {
    termsBanner: "Terms & Conditions",
    termsTitle: "Terms & Conditions",
    termsUpdated: "Last updated: September 5, 2026",
    privacyBanner: "Privacy Policy",
    privacyTitle: "Privacy Policy",
    privacyUpdated: "Last updated: September 5, 2026",
    updatedLabel: "Last updated",
  },

  contactPage: {
    banner: "Contact",
    subtitle: "Get In Touch",
    title: "Let's Talk About Your Project",
    intro: "Send us your questions, project ideas or support requests and our team will get back to you shortly.",
    infoTitle: "Contact Information",
    phoneLabel: "Phone",
    emailLabel: "Email",
    addressLabel: "Address",
    formTitle: "Send a Message",
    nameLabel: "Full Name",
    emailFieldLabel: "Your Email",
    phoneFieldLabel: "Your Phone",
    subjectLabel: "Subject",
    messageLabel: "Your Message",
    submitLabel: "Send Message",
    sendingLabel: "Sending…",
    successMessage: "Your message has been received. We will get back to you shortly.",
    errorMessage: "Your message could not be sent. Please check the fields and try again.",
    rateLimitedMessage: "Too many attempts. Please try again in a few minutes.",
  },

  searchPage: {
    banner: "Search",
    title: "Search the Site",
    placeholder: "What are you looking for?",
    submitLabel: "Search",
    noQuery: "Type a word above to search.",
    empty: "No results matched your search.",
    resultsPrefix: "Search results for:",
    categoryPosts: "Blog Posts",
    categoryServices: "Services",
    categoryProducts: "Products",
    categoryProjects: "Projects",
    categoryTeam: "Team Members",
  },

  productsPage: {
    banner: "Our Products",
    subtitle: "Our Products",
    title: "Solutions We Build for Your Business",
    intro: "Speed up your business with Starter Kurumsal's ready-made software products.",
    empty: "Our product catalogue is being prepared. It will be listed here soon.",
    ctaLabel: "View Details",
  },

  productDetailPage: {
    backLabel: "Back to all products",
    featuresTitle: "Key Features",
    galleryTitle: "Product Gallery",
    ctaLabel: "Request a Quote",
  },

  missionVisionPage: {
    banner: "Mission & Vision",
    subtitle: "What Defines Us",
    title: "Our Mission & Vision",
    missionTitle: "Our Mission",
    visionTitle: "Our Vision",
    valuesSubtitle: "Our Values",
    valuesTitle: "Our Working Principles",
    values: [
      { title: "Transparency", text: "We share the process and cost of every project openly." },
      { title: "Security First", text: "We design every solution around security requirements." },
      { title: "Continuous Learning", text: "Our team stays close to technology and keeps growing." },
      { title: "Customer Focus", text: "We shape our solutions around the customer's real needs." },
    ],
    indicatorsSubtitle: "By the Numbers",
    indicatorsTitle: "Our Journey So Far",
    ctaTitle: "Ready to Work With Us?",
    ctaText: "Get in touch with our team to talk about your project.",
  },

  partnersPage: {
    banner: "Partners",
    subtitle: "Our Partners",
    title: "We Work With Brands We Trust",
    intro:
      "The brands and partners we have grown alongside through the collaborations we have built over the years.",
    empty: "Partner information will be listed here soon.",
  },

  projectsPage: {
    banner: "Our Projects",
    subtitle: "Projects",
    title: "Client Projects We Have Completed",
    intro: "A selection of the projects we brought to life for clients across different industries.",
    empty: "Our project showcase is being updated. It will be listed here soon.",
  },

  projectDetailPage: {
    backLabel: "Back to all projects",
    challengeTitle: "The Challenge",
    solutionTitle: "Our Solution",
    galleryTitle: "Project Gallery",
    clientLabel: "Client",
    categoryLabel: "Category",
  },
};
