// Primary site navigation used on every page view: top strip, logo, desktop
// menu with the Services dropdown, search toggle and the "get A Quote" pill.
//
// Async server component: it is the single point that fetches published
// site-settings (Story 6.1) for the request and merges them with the
// dictionary via `buildSiteShellView` (settings missing/empty-field ->
// unchanged dictionary behaviour, per that module's own contract). The
// desktop dropdown is pure CSS (group-hover), so the only interactive parts
// are the language picker and the mobile drawer, both their own client
// components.
//
// Measured from the source header (1440px viewport):
//   header sits IN FLOW above the hero (header height 148 = top strip 62 + menu
//   row 86); it does not overlay the hero, and it has no background of its own.
//   logo 165x34, nav links 16px/600 capitalize #0f0d1d with 20px vertical
//   padding, pill button 100px radius on brand.
//   Hover is measured, not invented: a nav link goes #0f0d1d -> a dark navy
//   (~rgb(22,24,69)), and a submenu row additionally gains
//   background rgba(56,75,255,.243). It does NOT turn brand blue.
import { IconSearch } from "./Icon";
import MobileMenu from "./MobileMenu";
import ThemeButton from "./ThemeButton";
import TopBar from "./TopBar";
import { getPublicSiteSettings } from "@/lib/public-content/site-settings";
import { buildSiteShellView, type ShellNavItem } from "@/lib/public-content/site-shell-view";
import type { Locale } from "@/lib/i18n/config";
import { staticPath } from "@/lib/i18n/static-pages";
import type { Dictionary } from "@/lib/i18n/types";
import type { ContentLocale } from "@prisma/client";

const NAV_HOVER = "transition-colors duration-300 hover:text-[#161845]";

interface SiteHeaderProps {
  locale: Locale;
  dict: Dictionary;
}

function NavLink({ item }: { item: ShellNavItem }) {
  return (
    <li className="group relative">
      <a
        href={item.href}
        target={item.external ? "_blank" : undefined}
        rel={item.external ? "noopener noreferrer" : undefined}
        className={`flex items-center gap-1 py-5 text-[16px] font-semibold capitalize text-ink ${NAV_HOVER}`}
      >
        {item.label}
        {item.children.length > 0 ? <span aria-hidden className="text-[10px]">&#9662;</span> : null}
      </a>
      {item.children.length > 0 ? (
        <ul className="invisible absolute start-0 top-full w-[240px] translate-y-2 bg-base opacity-0 shadow-[var(--shadow-menu)] transition-all duration-300 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
          {item.children.map((child) => (
            <li key={child.label} className="border-b border-[#eeeeee] last:border-0">
              <a
                href={child.href}
                target={child.external ? "_blank" : undefined}
                rel={child.external ? "noopener noreferrer" : undefined}
                className={`block px-[25px] py-[11px] text-[16px] font-semibold capitalize text-ink hover:bg-[rgba(56,75,255,0.24)] ${NAV_HOVER}`}
              >
                {child.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default async function SiteHeader({ locale, dict }: SiteHeaderProps) {
  const settings = await getPublicSiteSettings(locale as ContentLocale);
  const view = buildSiteShellView(settings, dict, locale);

  return (
    <header className="relative z-50 bg-base">
      <TopBar locale={locale} dict={dict} contact={view.contact} />
      <div className="mx-auto max-w-7xl px-[15px]">
        <div className="flex h-[86px] items-center justify-between p-[10px]">
          <a href={staticPath(locale, "home")} className="shrink-0">
            {view.logo ? (
              <img src={view.logo.url} alt={view.logo.altText} className="h-[52px] w-auto max-w-[280px] object-contain" />
            ) : view.brandName ? (
              <span className="flex h-[52px] items-center font-display text-[26px] font-bold leading-none text-ink">{view.brandName}</span>
            ) : (
              <span className="flex h-[52px] items-center font-display text-[26px] font-bold leading-none text-ink">Metro <span className="text-brand">Yazılım</span></span>
            )}
          </a>

          <nav className="hidden items-center lg:flex">
            <ul className="flex items-center gap-8">
              {view.nav.map((item) => (
                <NavLink key={item.label} item={item} />
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-6">
            <a
              href={staticPath(locale, "search")}
              aria-label={dict.common.search}
              className={`hidden text-ink lg:block ${NAV_HOVER}`}
            >
              <IconSearch className="h-5 w-5" />
            </a>
            <div className="hidden lg:block">
              <ThemeButton
                href={view.cta.href}
                target={view.cta.external ? "_blank" : undefined}
                rel={view.cta.external ? "noopener noreferrer" : undefined}
              >
                {view.cta.label}
              </ThemeButton>
            </div>
            <MobileMenu
              locale={locale}
              nav={view.nav}
              brand={{ brandName: view.brandName, logo: view.logo }}
              cta={view.cta}
              labels={{
                openMenu: dict.common.openMenu,
                closeMenu: dict.common.closeMenu,
                language: dict.common.language,
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
