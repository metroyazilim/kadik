// Site geneli footer: iletişim şeridi, marka özeti, menü, son yazılar,
// bülten formu ve telif satırı. Mobil ve masaüstü tüm ekran genişliklerinde
// tam duyarlı (responsive) çalışır; hiçbir alan taşmaz veya çarpışmaz.
import { generateRoute } from "@/lib/content-model/route-registry";
import { postRouteCandidate } from "@/lib/content-model/post-routes";
import { listPublishedPosts } from "@/lib/public-content/post";
import {
  IconArrowRight,
  IconEnvelope,
  IconLinkedin,
  IconLocation,
  IconPhone,
  IconTwitter,
  IconYoutube,
} from "./Icon";
import { getPublicSiteSettings } from "@/lib/public-content/site-settings";
import { buildSiteShellView, pathForNavKey } from "@/lib/public-content/site-shell-view";
import { staticPath } from "@/lib/i18n/static-pages";
import type { NavKey } from "@/lib/i18n/static-pages";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";
import type { ContentLocale } from "@prisma/client";
import { DUMMY_BLOG_IMAGES, dummyImage } from "@/lib/media/dummy-images";
import { SOCIAL_LINKS } from "@/lib/social";

const SOCIAL_ICONS = { youtube: IconYoutube, linkedin: IconLinkedin, x: IconTwitter } as const;

const QUICK_LINK_KEYS: readonly NavKey[] = ["about", "services", "blog", "faq", "contact"];

interface FooterProps {
  locale: Locale;
  dict: Dictionary;
}

export default async function Footer({ locale, dict }: FooterProps) {
  const { footer, common } = dict;
  const settings = await getPublicSiteSettings(locale as ContentLocale);
  // Real content, not dictionary placeholders: the two newest published
  // posts for this locale (Turkish fallback included by the reader).
  const recentPosts = (await listPublishedPosts(locale as ContentLocale).catch(() => [])).slice(0, 2);
  const view = buildSiteShellView(settings, dict, locale);

  const contact = [
    {
      label: footer.contactLabels[0],
      value: view.contact.phone,
      href: view.contact.phoneHref,
      ltr: true,
      Glyph: IconPhone,
    },
    {
      label: footer.contactLabels[1],
      value: view.contact.email,
      href: view.contact.emailHref,
      ltr: true,
      Glyph: IconEnvelope,
    },
    {
      label: footer.contactLabels[2],
      value: view.contact.address ?? footer.locationValue,
      href: staticPath(locale, "contact"),
      ltr: false,
      Glyph: IconLocation,
    },
  ];

  return (
    <footer id="contact" className="relative bg-ink pt-14 text-white/90 lg:pt-20">
      <div className="mx-auto max-w-7xl px-[15px]">
        {/* İletişim Şeridi: Mobilde dikey, geniş ekranda 3 sütunlu kart. */}
        <div className="relative mb-12 -translate-y-6 overflow-hidden rounded-[15px] bg-brand text-base shadow-2xl md:-translate-y-12 lg:-translate-y-1/2">
          <div className="grid grid-cols-1 divide-y divide-white/15 md:grid-cols-3 md:divide-x md:divide-y-0">
            {contact.map(({ label, value, href, ltr, Glyph }) => (
              <div
                key={label}
                className="flex min-w-0 items-center gap-4 px-6 py-5 lg:px-8 lg:py-6"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                  <Glyph className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/75">{label}</p>
                  <a
                    href={href}
                    dir={ltr ? "ltr" : undefined}
                    className="mt-0.5 block truncate font-display text-[18px] font-bold leading-tight text-white transition-opacity hover:opacity-90 sm:text-[20px] lg:text-[22px]"
                    title={value}
                  >
                    {value}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ana Footer Izgarası */}
        <div className="grid gap-10 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="flex h-10 items-center font-display text-[26px] font-bold leading-none text-base">
              Metro <span className="text-brand">Yazılım</span>
            </span>
            <p className="mt-6 max-w-sm text-sm leading-7 text-white/75">
              {view.footerSummary ?? footer.summary}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {SOCIAL_LINKS.map(({ network, label, url }) => {
                const Glyph = SOCIAL_ICONS[network];
                return (
                  <a
                    key={network}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors duration-300 hover:bg-brand"
                  >
                    <Glyph className="h-[18px] w-[18px]" />
                  </a>
                );
              })}
            </div>
          </div>

          {view.footerColumns ? (
            view.footerColumns.map((column) => (
              <div key={column.id}>
                <h3 className="font-display text-[22px] font-bold text-base">{column.title}</h3>
                <ul className="mt-5 space-y-3 text-sm">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        className="transition-colors duration-300 hover:text-brand"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <div>
              <h3 className="font-display text-[22px] font-bold text-base">{footer.quickLinksTitle}</h3>
              <ul className="mt-5 space-y-3 text-sm">
                {footer.quickLinks.map((item, index) => (
                  <li key={item}>
                    <a
                      href={pathForNavKey(locale, QUICK_LINK_KEYS[index])}
                      className="transition-colors duration-300 hover:text-brand"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="font-display text-[22px] font-bold text-base">{footer.recentTitle}</h3>
            <div className="mt-5 space-y-4">
              {recentPosts.map((post, index) => (
                <a
                  key={post.entityId}
                  href={generateRoute(postRouteCandidate(locale as ContentLocale, post.slug))}
                  className="flex items-center gap-4 group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.coverImage.url || dummyImage(DUMMY_BLOG_IMAGES, index)}
                    alt=""
                    className="h-14 w-16 shrink-0 rounded-[8px] object-cover"
                  />
                  <span className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-base transition-colors group-hover:text-brand">
                    {post.title}
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-display text-[22px] font-bold text-base">{footer.reachTitle}</h3>
            <p className="mt-5 text-sm leading-relaxed text-white/75">{footer.address}</p>
            <form className="relative mt-5 w-full max-w-[320px]" action="#">
              <label htmlFor="footer-email" className="sr-only">
                {common.emailLabel}
              </label>
              <input
                id="footer-email"
                type="email"
                placeholder={common.emailPlaceholder}
                className="h-[52px] w-full rounded-[8px] bg-base px-4 pe-[60px] text-sm text-muted outline-none placeholder:text-muted/60"
              />
              <button
                type="submit"
                aria-label={common.subscribe}
                className="absolute end-[4px] top-[4px] flex h-[44px] w-[50px] items-center justify-center rounded-[6px] bg-brand text-base transition-opacity hover:opacity-90"
              >
                <IconArrowRight className="h-5 w-5 rtl:-scale-x-100" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Alt Telif ve Yasal Bağlantılar */}
      <div className="border-t border-white/10 py-5 text-xs text-white/60 sm:text-sm">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-[15px] text-center sm:flex-row sm:text-start">
          <p>{footer.copyright}</p>
          <div className="flex flex-wrap justify-center gap-5">
            <a href={staticPath(locale, "terms")} className="transition-colors hover:text-white">
              {footer.terms}
            </a>
            <a href={staticPath(locale, "privacy")} className="transition-colors hover:text-white">
              {footer.privacy}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
