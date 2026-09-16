"use client";

import { LogOut, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/manage/actions";
import { ADMIN_NAV_SECTIONS, findNavItemByPath } from "./nav-items";
import { cn } from "./ui";

function initialsOf(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return "A";
  const first = parts[0]?.[0] ?? "A";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

/**
 * Fixed 256px navigation rail, translated off-canvas below `lg`. Active
 * state comes from `usePathname()` - every panel is a real route, so the
 * highlight survives a hard refresh and a shared link.
 */
export function AdminSidebar({
  email,
  mobileOpen,
  onClose,
}: {
  email: string;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const activeHref = findNavItemByPath(pathname)?.href ?? null;

  return (
    <>
      {mobileOpen ? (
        <div className="fixed inset-0 z-30 bg-brand-invert/40 lg:hidden" onClick={onClose} aria-hidden="true" />
      ) : null}

      <aside
        // Below `lg` the rail is a real modal drawer, so it announces itself
        // as one; on desktop it is permanent chrome and must not claim a
        // dialog role.
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? "Yönetim menüsü" : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape" && mobileOpen) onClose();
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-surface shadow-[1px_0_0_rgba(12,27,51,0.06)] transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-brand-border px-5 pb-3 pt-5">
          <Link href="/manage" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-brand-invert text-xs font-extrabold text-brand-on-invert">
              M
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-extrabold leading-tight tracking-tight text-brand-text">
                Metro Yazılım
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-accent">Yönetim Paneli</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-brand-muted transition-colors hover:bg-brand-muted-surface lg:hidden"
            aria-label="Menüyü kapat"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-1 flex flex-1 flex-col overflow-y-auto px-4 py-2" aria-label="Yönetim navigasyonu">
          {ADMIN_NAV_SECTIONS.map((section, index) => (
            <div
              key={section.label}
              className={cn("flex flex-col gap-0.5 py-3", index > 0 && "border-t border-dashed border-brand-border")}
            >
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                {section.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-brand-muted transition-colors hover:bg-brand-muted-surface hover:text-brand-text",
                          active && "bg-brand-muted-surface font-bold text-brand-text",
                        )}
                      >
                        {active ? (
                          <span
                            className="absolute -left-4 h-5 w-1 rounded-r-full bg-brand-primary"
                            aria-hidden="true"
                          />
                        ) : null}
                        <Icon
                          className={cn("size-4 shrink-0", active ? "text-brand-primary" : "text-brand-muted")}
                          aria-hidden="true"
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-brand-border bg-brand-muted-surface/50 px-4 py-3">
          <div className="mb-1 flex items-center gap-2.5 px-3 py-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-invert text-xs font-bold text-brand-on-invert">
              {initialsOf(email)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold text-brand-text">Yönetici</span>
              <span className="block truncate text-[11px] text-brand-muted">{email}</span>
            </span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-brand-muted transition-colors hover:bg-brand-danger/10 hover:text-brand-danger"
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              Çıkış yap
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
