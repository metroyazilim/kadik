import {
  CalendarDays,
  CircleHelp,
  Images,
  Megaphone,
  FileText,
  FolderKanban,
  Image,
  LayoutDashboard,
  MessagesSquare,
  Newspaper,
  Package,
  Search,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavKey =
  | "overview"
  | "pages"
  | "posts"
  | "services"
  | "products"
  | "projects"
  | "team"
  | "events"
  | "announcements"
  | "gallery"
  | "faq"
  | "messages"
  | "media"
  | "seo"
  | "audit"
  | "users";

export type AdminNavItem = {
  key: AdminNavKey;
  label: string;
  href: string;
  publicHref?: string;
  icon: LucideIcon;
};

export type AdminNavSection = {
  label: string;
  items: readonly AdminNavItem[];
};

/**
 * Single source of truth for admin navigation. Every screen is a real
 * route, so each `href` is a path - the sidebar derives its active state
 * from `usePathname()`, never from a query parameter.
 */
export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
  {
    label: "Genel",
    items: [
      { key: "overview", label: "Genel Bakış", href: "/manage", publicHref: "/", icon: LayoutDashboard },
      { key: "media", label: "Medya", href: "/manage/media", icon: Image },
      {
        key: "messages",
        label: "Mesajlar ve Başvurular",
        href: "/manage/messages",
        publicHref: "/membership",
        icon: MessagesSquare,
      },
    ],
  },
  {
    label: "Site İçeriği",
    items: [
      // Every public page - home included - is edited from this one list.
      { key: "pages", label: "Sayfalar", href: "/manage/pages", publicHref: "/", icon: FileText },
    ],
  },
  {
    label: "KADİK İçerikleri",
    items: [
      {
        key: "team",
        label: "Kurul Üyeleri",
        href: "/manage/team",
        publicHref: "/board",
        icon: Users,
      },
      {
        key: "posts",
        label: "Yayınlar ve Haberler",
        href: "/manage/posts",
        publicHref: "/news",
        icon: Newspaper,
      },
      { key: "events", label: "Etkinlikler", href: "/manage/events", publicHref: "/events", icon: CalendarDays },
      { key: "announcements", label: "Duyurular", href: "/manage/announcements", publicHref: "/announcements", icon: Megaphone },
      { key: "gallery", label: "Galeri", href: "/manage/gallery", publicHref: "/gallery", icon: Images },
    ],
  },
  {
    label: "SEO",
    items: [{ key: "seo", label: "SEO Ayarları", href: "/manage/seo", icon: Search }],
  },
  {
    label: "Sistem",
    items: [
      { key: "audit", label: "Denetim Terminali", href: "/manage/audit", icon: ShieldCheck },
      { key: "users", label: "Kullanıcılar", href: "/manage/users", icon: Users },
    ],
  },
] as const;

/**
 * Legacy starter-template collections (services, products, projects, FAQ)
 * render nothing on the KADİK site.
 * They are hidden from the menu but their routes and data stay intact; the
 * sidebar still highlights nothing for them and the top bar shows their name.
 */
export const HIDDEN_ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { key: "faq", label: "SSS", href: "/manage/faq", icon: CircleHelp },
  { key: "services", label: "Hizmetler", href: "/manage/services", icon: FileText },
  { key: "products", label: "Ürünler", href: "/manage/products", icon: Package },
  { key: "projects", label: "Projeler", href: "/manage/projects", icon: FolderKanban },
];

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  ...ADMIN_NAV_SECTIONS.flatMap((section) => section.items),
  ...HIDDEN_ADMIN_NAV_ITEMS,
];

export function isAdminNavKey(value: string): value is AdminNavKey {
  return ADMIN_NAV_ITEMS.some((item) => item.key === value);
}

export function findNavItem(key: AdminNavKey): AdminNavItem {
  const item = ADMIN_NAV_ITEMS.find((candidate) => candidate.key === key);
  if (!item) throw new Error(`Unknown admin nav key: ${key}`);
  return item;
}

/**
 * The nav item a pathname belongs to. `/manage` matches `overview` exactly;
 * every other item matches its own subtree so `/manage/services/<id>` still
 * highlights "Hizmetler".
 */
export function findNavItemByPath(pathname: string): AdminNavItem | null {
  const nested = ADMIN_NAV_ITEMS.filter((item) => item.href !== "/manage")
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (nested) return nested;
  return pathname === "/manage" ? findNavItem("overview") : null;
}
