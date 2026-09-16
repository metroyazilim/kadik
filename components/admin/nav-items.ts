import {
  CircleHelp,
  FileText,
  FolderKanban,
  Image,
  Layers,
  LayoutDashboard,
  MessagesSquare,
  Newspaper,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavKey =
  | "overview"
  | "home"
  | "pages"
  | "site-settings"
  | "posts"
  | "services"
  | "products"
  | "projects"
  | "team"
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
      { key: "overview", label: "Genel Bakış", href: "/manage", icon: LayoutDashboard },
      { key: "media", label: "Medya", href: "/manage/media", icon: Image },
      { key: "messages", label: "Mesajlar", href: "/manage/messages", icon: MessagesSquare },
    ],
  },
  {
    label: "Sayfa Düzenleyiciler",
    items: [
      { key: "home", label: "Anasayfa", href: "/manage/home", icon: Layers },
      { key: "pages", label: "Sayfalar", href: "/manage/pages", icon: FileText },
      { key: "site-settings", label: "Site Ayarları", href: "/manage/site-settings", icon: Settings },
    ],
  },
  {
    label: "Koleksiyonlar",
    items: [
      { key: "services", label: "Hizmetler", href: "/manage/services", icon: FileText },
      { key: "products", label: "Ürünler", href: "/manage/products", icon: Package },
      { key: "projects", label: "Projeler", href: "/manage/projects", icon: FolderKanban },
      { key: "team", label: "Ekip", href: "/manage/team", icon: Users },
      { key: "faq", label: "SSS", href: "/manage/faq", icon: CircleHelp },
      { key: "posts", label: "Blog Yazıları", href: "/manage/posts", icon: Newspaper },
    ],
  },
  {
    label: "SEO ve Sistem",
    items: [
      { key: "seo", label: "SEO", href: "/manage/seo", icon: Search },
      { key: "audit", label: "Audit", href: "/manage/audit", icon: ShieldCheck },
      { key: "users", label: "Kullanıcılar", href: "/manage/users", icon: Users },
    ],
  },
] as const;

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = ADMIN_NAV_SECTIONS.flatMap((section) => section.items);

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
