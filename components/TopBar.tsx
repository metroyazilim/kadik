// Üst yardımcı şerit: iletişim detayları, dil seçici ve sosyal medya bağlantıları.
// Küçük ekranlarda esnek satır kayması (flex-wrap) ile taşmayı önler.
import {
  IconEnvelope,
  IconLinkedin,
  IconPhone,
  IconTwitter,
  IconYoutube,
} from "./Icon";
import LanguageSwitcher from "./LanguageSwitcher";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";

import { SOCIAL_LINKS } from "@/lib/social";

const SOCIAL_ICONS = { youtube: IconYoutube, linkedin: IconLinkedin, x: IconTwitter } as const;

interface TopBarProps {
  locale: Locale;
  dict: Dictionary;
  contact: Readonly<{ email: string; emailHref: string; phone: string; phoneHref: string }>;
}

export default function TopBar({ locale, dict, contact }: TopBarProps) {
  return (
    <div className="bg-ink py-2 text-white/80 text-xs sm:text-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-2 gap-x-4 px-[15px]">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <li>
            <a
              href={contact.emailHref}
              className="flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <IconEnvelope className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[220px] sm:max-w-none">{contact.email}</span>
            </a>
          </li>
          <li>
            <a
              href={contact.phoneHref}
              className="flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <IconPhone className="h-3.5 w-3.5 shrink-0" />
              <span dir="ltr">{contact.phone}</span>
            </a>
          </li>
        </ul>
        <div className="flex items-center gap-4 sm:gap-6">
          <LanguageSwitcher locale={locale} label={dict.common.language} />
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-xs font-medium text-white/60">{dict.common.followUs}</span>
            {SOCIAL_LINKS.map(({ network, label, url }) => {
              const Glyph = SOCIAL_ICONS[network];
              return (
                <a
                  key={network}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="transition-colors hover:text-brand text-white/70"
                >
                  <Glyph className="h-3.5 w-3.5" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
