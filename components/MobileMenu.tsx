"use client";

// Burger button plus the off-canvas navigation drawer it opens.
//
// The drawer slides in from the inline-end edge (right in LTR, left in RTL) and
// is the only mobile navigation surface - the previous build dropped a panel
// into the document flow below the header, which pushed the hero down and had
// no way to close other than tapping the burger again.
//
// Closing is not a single path: the X button, a backdrop tap and Escape all
// work, and body scrolling is locked while it is open so the page behind does
// not move under the finger. Focus management: opening moves focus to the
// drawer's own close button (so a keyboard/screen-reader user lands inside
// it immediately, not on a hidden-behind-the-overlay page element); closing
// (by any of the three paths) returns focus to the burger button that opened
// it, never dropping focus back to `<body>`. While open, Tab/Shift+Tab are
// trapped to the drawer's own focusable elements.
import { useEffect, useRef, useState } from "react";
import { IconClose, IconMenu } from "./Icon";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeButton from "./ThemeButton";
import type { Locale } from "@/lib/i18n/config";
import type { ShellNavItem, SiteShellView } from "@/lib/public-content/site-shell-view";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface MobileMenuProps {
  locale: Locale;
  /** Already locale-resolved and, for a settings-sourced entry, safety-classified as external/internal. */
  nav: readonly ShellNavItem[];
  /** Same published logo/brand name the header renders, so the drawer can never disagree with it. */
  brand: Readonly<Pick<SiteShellView, "brandName" | "logo">>;
  cta: Readonly<{ label: string; href: string; external: boolean }>;
  labels: {
    openMenu: string;
    closeMenu: string;
    language: string;
  };
}

export default function MobileMenu({ locale, nav, brand, cta, labels }: MobileMenuProps) {
  // The drawer owns its own state: the header around it is a server component,
  // so this is the boundary where interactivity starts.
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    // Move focus into the drawer once it is actually in the DOM/visible.
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !asideRef.current) return;

      const focusable = Array.from(asideRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={labels.openMenu}
        aria-expanded={open}
        className="text-ink transition-colors duration-300 hover:text-brand lg:hidden"
        onClick={() => setOpen(true)}
      >
        <IconMenu className="h-7 w-7" />
      </button>

      {/* Kept mounted so the transform transition runs in both directions;
          `invisible` + `pointer-events-none` keep it out of the tab order and
          out of the way of taps while closed. */}
      <div
        className={`fixed inset-0 z-[100] lg:hidden ${
          open ? "visible" : "invisible pointer-events-none"
        }`}
      >
        <div
          aria-hidden
          onClick={close}
          className={`absolute inset-0 bg-ink/60 transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          ref={asideRef}
          aria-label={labels.openMenu}
          aria-hidden={!open}
          // `end-0` mirrors with direction; the transform does not, so the
          // closed offset is written per direction.
          className={`absolute inset-y-0 end-0 flex w-[320px] max-w-[85vw] flex-col overflow-y-auto bg-base shadow-[var(--shadow-menu)] transition-transform duration-300 ${
            open ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-hairline px-6 py-5">
            {brand.logo ? (
              <img src={brand.logo.url} alt={brand.logo.altText} className="h-[34px] w-auto max-w-[200px] object-contain" />
            ) : (
              <span className="font-display text-[22px] font-bold leading-none text-ink">
                {brand.brandName ?? <>Metro <span className="text-brand">Yazılım</span></>}
              </span>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              aria-label={labels.closeMenu}
              onClick={close}
              className="text-ink transition-colors duration-300 hover:text-brand"
            >
              <IconClose className="h-6 w-6" />
            </button>
          </div>

          <nav className="px-6 py-4">
            <ul>
              {nav.map((item) => (
                <li key={item.label} className="border-b border-hairline/60 last:border-0">
                  <a
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    onClick={close}
                    className="block py-3 text-[16px] font-semibold capitalize text-ink transition-colors duration-300 hover:text-brand"
                  >
                    {item.label}
                  </a>
                  {item.children.length > 0 ? (
                    <ul className="pb-3 ps-4">
                      {item.children.map((child) => (
                        <li key={child.label}>
                          <a
                            href={child.href}
                            target={child.external ? "_blank" : undefined}
                            rel={child.external ? "noopener noreferrer" : undefined}
                            onClick={close}
                            className="block py-2 text-[15px] font-medium capitalize text-muted transition-colors duration-300 hover:text-brand"
                          >
                            {child.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto space-y-5 border-t border-hairline px-6 py-6">
            <LanguageSwitcher locale={locale} label={labels.language} tone="dark" />
            <ThemeButton href={cta.href} target={cta.external ? "_blank" : undefined} rel={cta.external ? "noopener noreferrer" : undefined}>
              {cta.label}
            </ThemeButton>
          </div>
        </aside>
      </div>
    </>
  );
}
