// Turkish - the source language. Every string here came from the existing
// pages; the other locales are translations of this file.
import type { Dictionary } from "../types";

export const tr: Dictionary = {
  meta: {
    home: {
      title: "Starter Kurumsal - BT Çözümleri ve Teknoloji",
      description:
        "Starter Kurumsal; veritabanı güvenliği, BT danışmanlığı, uygulama geliştirme ve bulut altyapı çözümleriyle işletmenizi büyütür.",
    },
    about: {
      title: "Hakkımızda | Starter Kurumsal",
      description:
        "Starter Kurumsal ekibini, çalışma sürecimizi ve teknolojiyle iş başarısını nasıl artırdığımızı tanıyın.",
    },
    blog: {
      title: "Blog | Starter Kurumsal",
      description:
        "Starter Kurumsal'ın teknoloji, güvenlik ve BT hizmetleri üzerine güncel yazılarını okuyun.",
    },
    services: {
      title: "Hizmetlerimiz | Starter Kurumsal",
      description:
        "Veritabanı güvenliği, BT danışmanlığı, uygulama geliştirme ve bulut altyapı hizmetlerimizi keşfedin.",
    },
    products: {
      title: "Ürünlerimiz | Starter Kurumsal",
      description: "Starter Kurumsal'ın işletmeler için geliştirdiği yazılım ürünlerine göz atın.",
    },
    projects: {
      title: "Projelerimiz | Starter Kurumsal",
      description: "Müşterilerimiz için tamamladığımız teknoloji projelerinden örnekler.",
    },
    faq: {
      title: "Sıkça Sorulan Sorular | Starter Kurumsal",
      description: "Hizmetlerimiz, süreçlerimiz ve iş birliği hakkında en çok sorulan sorular.",
    },
    terms: {
      title: "Şartlar ve Koşullar | Starter Kurumsal",
      description: "Starter Kurumsal web sitesini ve hizmetlerini kullanım şartları.",
    },
    privacy: {
      title: "Gizlilik Politikası | Starter Kurumsal",
      description: "Starter Kurumsal'ın kişisel verileri nasıl topladığı ve kullandığı hakkında bilgi.",
    },
    contact: {
      title: "İletişim | Starter Kurumsal",
      description: "Sorularınız için Starter Kurumsal ekibiyle iletişime geçin.",
    },
    search: {
      title: "Arama | Starter Kurumsal",
      description: "Blog yazıları, hizmetler, ürünler, projeler ve ekip üyeleri arasında arayın.",
    },
    missionVision: {
      title: "Misyon ve Vizyonumuz | Starter Kurumsal",
      description: "Starter Kurumsal'ın misyonu, vizyonu ve değerleri.",
    },
    partners: {
      title: "İş Ortaklarımız | Starter Kurumsal",
      description: "Starter Kurumsal'ın güvenilir iş ortaklarını ve marka referanslarını keşfedin.",
    },
  },

  common: {
    loading: "Yükleniyor",
    readMore: "Devamını Oku",
    home: "Ana Sayfa",
    learnMore: "Daha Fazla",
    contactUs: "Bize Ulaşın",
    getQuote: "Teklif Al",
    callUsNow: "Bizi Hemen Arayın",
    callAnytime: "Bizi 7/24 Arayın",
    search: "Ara",
    openMenu: "Menüyü aç",
    closeMenu: "Menüyü kapat",
    language: "Dil seç",
    followUs: "Bizi Takip Edin:",
    brandTrust: "1000+ Marka Bize Güveniyor",
    brandAlt: "Güvenilir marka",
    allServices: "Tüm Hizmetleri Gör",
    allMembers: "Tüm Üyeler",
    allProjects: "Tüm projeler",
    prevProject: "Önceki proje",
    nextProject: "Sonraki proje",
    editor: "Editör",
    ratingLabel: "5 / 5",
    emailLabel: "E-posta adresiniz",
    emailPlaceholder: "E-posta adresiniz",
    subscribe: "Abone ol",
    aboutFallbackNotice: "Bu içerik henüz bu dilde yayınlanmadı; Türkçe sürüm gösteriliyor.",
  },

  nav: [
    { label: "Ana Sayfa", href: "home" },
    { label: "Hakkımızda", href: "about" },
    {
      label: "Hizmetler",
      href: "services",
      children: [
        { label: "Hizmetlerimiz", href: "services" },
        { label: "Ürünlerimiz", href: "products" },
      ],
    },
    {
      label: "Portföy",
      href: "missionVision",
      children: [
        { label: "Misyon ve Vizyon", href: "missionVision" },
        { label: "Partnerler", href: "partners" },
        { label: "Projelerimiz", href: "projects" },
        { label: "Sıkça Sorulan Sorular", href: "faq" },
      ],
    },
    { label: "Blog", href: "blog" },
    { label: "İletişim", href: "contact" },
  ],

  hero: {
    eyebrow: "en iyi bilişim şirketi",
    titleTop: "İşinizi Bu BT",
    titleBottom: "Çözümüyle Büyütün",
    text: "Modern altyapı, güvenli sistemler ve uzman ekibimizle işletmenizi bir adım öne taşıyoruz. Starter Kurumsal, teknolojiyi işinizin büyümesine hizmet ettirir.",
    imageAlt: "Starter Kurumsal ekibi toplantı masasında çalışıyor",
  },

  about: {
    subtitle: "HAKKIMIZDA",
    title: "Doğru Çözümlerle Müşterilerimizin Yanındayız",
    text: "Deneyimli ekibimiz, doğru stratejiler ve güncel teknolojilerle işletmenizin büyümesine katkı sağlar.",
    imageAlt: "Starter Kurumsal ekibi toplantı masasında birlikte çalışıyor",
    checklist: [
      "Marka ve Tasarım Kimliği",
      "Web Sitesi Pazarlama Çözümleri",
      "Sınırsız Veri İndirme",
    ],
    statValue: "6.561+",
    statLabel: "Memnun Müşteri",
  },

  services: {
    subtitle: "Ne Yapıyoruz",
    title: "Teknolojiyle BT Sorunlarını Çözüyoruz",
    cardText: "Güvenilir altyapı ve uzman ekiple işinizi bir adım öteye taşıyoruz.",
    items: [
      "Veritabanı Güvenliği",
      "BT Danışmanlığı",
      "Uygulama Geliştirme",
      "Bulut Altyapı Çözümleri",
    ],
    bannerTitle: "Son Teknoloji BT Çözümleriyle Bağlantıda Kalın",
  },

  process: {
    subtitle: "Nasıl Çalışıyoruz",
    title: "Standart Çalışma Süreci",
    stepText: "Uzman ekibimiz her adımda yanınızda, hızlı ve şeffaf bir süreç sunar.",
    items: ["Hizmet Seçin", "İhtiyaçları Belirleyin", "Görüşme Talep Edin", "Nihai Çözümü Alın"],
  },

  achievements: {
    subtitle: "başarılarımız",
    title: "İşletme Başarısını Artırıyoruz",
    items: [
      { value: "6.561", label: "Memnun Müşteri" },
      { value: "600", label: "Tamamlanan Proje" },
      { value: "250", label: "Uzman Personel" },
      { value: "590", label: "Medya Paylaşımı" },
    ],
  },

  projects: {
    subtitle: "PROJELER",
    title: "En Son Müşteri Projelerimiz",
    items: [
      { category: "Teknoloji", title: "Yazılım Geliştirme" },
      { category: "Teknoloji", title: "Yazılım Geliştirme" },
      { category: "Çözümler", title: "Analitik Çözümler" },
    ],
  },

  marquee: ["Teknoloji", "Veri Güvenliği", "Siber Güvenlik"],

  team: {
    subtitle: "EKİP ÜYELERİ",
    title: "Özverili Ekip Üyelerimiz",
    members: [
      { name: "Ahmet Kaya", role: "Web Tasarımcı" },
      { name: "Elif Şahin", role: "Siber Güvenlik Uzmanı" },
      { name: "Burak Öztürk", role: "Web Uzmanı" },
      { name: "Zeynep Aydın", role: "Veri Analisti" },
    ],
  },

  testimonials: {
    subtitle: "REFERANSLAR",
    title: "Bizi Zaten Sevenler",
    quote:
      "Profesyonel ekip, hızlı çözümler ve şeffaf iletişim sayesinde beklentilerimizin üzerinde bir hizmet aldık.",
    items: [
      { name: "Ayşe Yılmaz", role: "Web Tasarımcı" },
      { name: "Mehmet Demir", role: "Sağlık Asistanı" },
    ],
  },

  blog: {
    subtitle: "SON BLOG YAZILARI",
    title: "En Son Haber ve Yazılarımıza Göz Atın",
    posts: [
      {
        day: "24",
        month: "May",
        category: "Siber Güvenlik",
        title: "Teknolojide Öne Çıkan Beş Trend",
      },
      {
        day: "17",
        month: "May",
        category: "BT Hizmetleri",
        title: "Basit, Hızlı ve Başarılı BT Çözümleri",
      },
      {
        day: "08",
        month: "May",
        category: "Teknoloji",
        title: "Teknolojiyle Potansiyeli Ortaya Çıkarmak",
      },
    ],
  },

  footer: {
    contactLabels: ["Bizi 7/24 Arayın", "Teklif Alın", "Konum"],
    locationValue: "Levent, İstanbul",
    summary:
      "Starter Kurumsal, işletmelerin güvenli ve pratik teknolojilerle daha hızlı ilerlemesine yardımcı olan tam kapsamlı bir BT ajansıdır.",
    quickLinksTitle: "Hızlı Bağlantılar",
    quickLinks: ["Hakkımızda", "Hizmetlerimiz", "Blog Yazılarımız", "SSS", "Bize Ulaşın"],
    recentTitle: "Son Yazılar",
    recentPosts: ["En Popüler 5 Teknoloji Trendi", "Dijital Geleceğe Yönelik BT Çözümleri"],
    reachTitle: "Bize Ulaşın",
    address: "Büyükdere Cad. No:12, Levent, Şişli, İstanbul",
    copyright: "© 2026 Starter Kurumsal. Tüm Hakları Saklıdır.",
    terms: "Şartlar ve Koşullar",
    privacy: "Gizlilik Politikası",
  },

  servicesPage: {
    banner: "Hizmetlerimiz",
    subtitle: "Ne Yapıyoruz",
    title: "İşletmenizi Büyüten BT Hizmetleri",
    intro:
      "Veritabanı güvenliğinden bulut altyapısına, işletmenizin ihtiyaç duyduğu her BT hizmetini tek çatı altında sunuyoruz.",
    empty: "Hizmet listesi şu anda güncelleniyor. Kısa süre sonra burada olacak.",
    faqSubtitle: "Merak Edilenler",
    faqTitle: "Hizmetlerimiz Hakkında Sıkça Sorulan Sorular",
    quoteTitle: "Projeniz İçin Teklif Almak İster misiniz?",
    quoteText: "İhtiyaçlarınızı bize anlatın, size en uygun çözümü birlikte planlayalım.",
    quoteCta: "Teklif İste",
  },

  serviceDetailPage: {
    sidebarTitle: "Tüm Hizmetler",
    hoursTitle: "Çalışma Saatlerimiz",
    hoursText: "Pazartesi - Cuma: 09:00 - 18:00",
    helpTitle: "Yardıma mı ihtiyacınız var?",
    helpText: "Ekibimiz sorularınızı yanıtlamak için hazır.",
    helpCta: "Bize Ulaşın",
    relatedTitle: "Bu Hizmetle İlgili Diğer Hizmetler",
    backLabel: "Tüm hizmetlere dön",
    fallbackNotice: "Bu içerik henüz bu dilde yayınlanmadı; Türkçe sürüm gösteriliyor.",
  },

  teamDetailPage: {
    backLabel: "Tüm ekip üyelerine dön",
    contactTitle: "İletişim Bilgileri",
    skillsTitle: "Yetkinlikler",
    experienceTitle: "Deneyim",
    educationTitle: "Eğitim",
  },

  faqPage: {
    banner: "Sıkça Sorulan Sorular",
    subtitle: "SSS",
    title: "Aklınıza Takılan Sorulara Yanıtlar",
    intro:
      "Hizmetlerimiz, süreçlerimiz ve iş birliğimiz hakkında en çok merak edilenleri bir araya getirdik. Aradığınızı bulamazsanız bize ulaşın.",
    empty: "Şu anda yayınlanmış bir soru bulunmuyor.",
  },

  legalPage: {
    termsBanner: "Şartlar ve Koşullar",
    termsTitle: "Şartlar ve Koşullar",
    termsUpdated: "Son güncelleme: 5 Eylül 2026",
    privacyBanner: "Gizlilik Politikası",
    privacyTitle: "Gizlilik Politikası",
    privacyUpdated: "Son güncelleme: 5 Eylül 2026",
    updatedLabel: "Son güncelleme",
  },

  contactPage: {
    banner: "İletişim",
    subtitle: "Bize Ulaşın",
    title: "Projeniz İçin Konuşalım",
    intro:
      "Sorularınızı, proje fikirlerinizi veya destek taleplerinizi bize iletin; ekibimiz en kısa sürede dönüş yapsın.",
    infoTitle: "İletişim Bilgileri",
    phoneLabel: "Telefon",
    emailLabel: "E-posta",
    addressLabel: "Adres",
    formTitle: "Mesaj Gönderin",
    nameLabel: "Adınız Soyadınız",
    emailFieldLabel: "E-posta Adresiniz",
    phoneFieldLabel: "Telefon Numaranız",
    subjectLabel: "Konu",
    messageLabel: "Mesajınız",
    submitLabel: "Mesajı Gönder",
    sendingLabel: "Gönderiliyor…",
    successMessage: "Mesajınız alındı. En kısa sürede size dönüş yapacağız.",
    errorMessage: "Mesajınız gönderilemedi. Lütfen alanları kontrol edip tekrar deneyin.",
    rateLimitedMessage: "Çok sayıda deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.",
  },

  searchPage: {
    banner: "Arama",
    title: "Sitede Ara",
    placeholder: "Ne aramıştınız?",
    submitLabel: "Ara",
    noQuery: "Aramak için yukarıya bir kelime yazın.",
    empty: "Aramanızla eşleşen bir sonuç bulunamadı.",
    resultsPrefix: "Arama sonucu:",
    categoryPosts: "Blog Yazıları",
    categoryServices: "Hizmetler",
    categoryProducts: "Ürünler",
    categoryProjects: "Projeler",
    categoryTeam: "Ekip Üyeleri",
  },

  productsPage: {
    banner: "Ürünlerimiz",
    subtitle: "Ürünlerimiz",
    title: "İşletmeniz İçin Geliştirdiğimiz Çözümler",
    intro: "Starter Kurumsal'ın hazır yazılım ürünleriyle işinizi hızlandırın.",
    empty: "Ürün kataloğumuz hazırlanıyor. Yakında burada listelenecek.",
    ctaLabel: "Detayları Gör",
  },

  productDetailPage: {
    backLabel: "Tüm ürünlere dön",
    featuresTitle: "Öne Çıkan Özellikler",
    galleryTitle: "Ürün Görselleri",
    ctaLabel: "Teklif İste",
  },

  missionVisionPage: {
    banner: "Misyon ve Vizyon",
    subtitle: "Bizi Biz Yapan",
    title: "Misyonumuz ve Vizyonumuz",
    missionTitle: "Misyonumuz",
    visionTitle: "Vizyonumuz",
    valuesSubtitle: "Değerlerimiz",
    valuesTitle: "Çalışma Prensiplerimiz",
    values: [
      { title: "Şeffaflık", text: "Her projede süreç ve maliyetleri açıkça paylaşırız." },
      { title: "Güvenlik Önceliği", text: "Her çözümü güvenlik gereksinimleriyle tasarlarız." },
      { title: "Sürekli Öğrenme", text: "Ekibimiz teknolojiyi yakından takip eder, gelişimini sürdürür." },
      { title: "Müşteri Odaklılık", text: "Çözümlerimizi müşterinin gerçek ihtiyacına göre şekillendiririz." },
    ],
    indicatorsSubtitle: "Rakamlarla Biz",
    indicatorsTitle: "Bugüne Kadarki Yolculuğumuz",
    ctaTitle: "Bizimle Çalışmaya Hazır mısınız?",
    ctaText: "Projenizi konuşmak için ekibimizle iletişime geçin.",
  },

  partnersPage: {
    banner: "Partnerler",
    subtitle: "İş Ortaklarımız",
    title: "Güvenilir Markalarla Birlikte Çalışıyoruz",
    intro:
      "Yıllar içinde kurduğumuz iş birlikleriyle güçlendirdiğimiz, birlikte büyüdüğümüz markalar ve iş ortaklarımız.",
    empty: "Partner bilgileri yakında burada listelenecek.",
  },

  projectsPage: {
    banner: "Projelerimiz",
    subtitle: "Projeler",
    title: "Tamamladığımız Müşteri Projeleri",
    intro: "Farklı sektörlerden müşterilerimiz için hayata geçirdiğimiz projelerden bazıları.",
    empty: "Proje vitrinimiz güncelleniyor. Yakında burada listelenecek.",
  },

  projectDetailPage: {
    backLabel: "Tüm projelere dön",
    challengeTitle: "İhtiyaç",
    solutionTitle: "Çözümümüz",
    galleryTitle: "Proje Görselleri",
    clientLabel: "Müşteri",
    categoryLabel: "Kategori",
  },
};
