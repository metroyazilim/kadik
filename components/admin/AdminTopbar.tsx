"use client";

import { ExternalLink, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findNavItemByPath } from "./nav-items";

export function AdminTopbar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();
  const section = findNavItemByPath(pathname);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-brand-border bg-brand-surface/90 px-4 py-3 backdrop-blur lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-brand-muted transition-colors hover:bg-brand-muted-surface lg:hidden"
          aria-label="Menüyü aç"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <span className="hidden truncate text-xs font-bold uppercase tracking-wider text-brand-muted sm:inline-block">
          KADIK{section ? ` | ${section.label}` : ""}
        </span>
      </div>

      <Link
        href="/"
        target="_blank"
        rel="noreferrer"
        className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] bg-brand-muted-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-text transition-colors hover:bg-brand-border"
      >
        Siteyi görüntüle
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </Link>
    </header>
  );
}
