import ThemeButton from "@/components/ThemeButton";
import type { Locale } from "@/lib/i18n/config";
import { sanitizeRichHtml } from "@/lib/content-model/sanitization";

export type HeroPartProps = Readonly<{
  locale: Locale;
  title?: string;
  text?: string;
  bgImageUrl?: string;
  variant?: "wave" | "flat";
  primaryButtonLabel?: string;
  primaryButtonHref?: string;
  secondaryButtonLabel?: string;
  secondaryButtonHref?: string;
}>;

export function HeroPart({
  locale,
  title = "",
  text = "",
  bgImageUrl = "/hero-team.webp",
  variant = "wave",
  primaryButtonLabel = "",
  primaryButtonHref = "",
  secondaryButtonLabel = "",
  secondaryButtonHref = "",
}: HeroPartProps) {
  if (variant === "flat") {
    return (
      <section
        className="relative flex min-h-[498px] items-center overflow-hidden bg-ink bg-cover bg-center text-base"
        style={{ backgroundImage: `url(${bgImageUrl})` }}
      >
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ink via-navy/90 to-navy/55" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/shapes/hero-line-pattern.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute end-0 top-0 hidden h-full opacity-70 lg:block"
        />
        <div className="relative mx-auto w-full max-w-7xl px-[15px] py-24 text-center">
          {title.trim() ? (
            <h1
              className="mx-auto mt-4 max-w-5xl font-display text-[clamp(48px,6vw,76px)] font-bold leading-[1.12] [&_strong]:text-brand [&_a]:text-brand [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(title) }}
            />
          ) : null}
          {text.trim() ? (
            <div
              className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-base/85 [&_strong]:font-bold [&_a]:text-brand [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(text) }}
            />
          ) : null}
          {primaryButtonLabel && primaryButtonHref || secondaryButtonLabel && secondaryButtonHref ? (
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              {primaryButtonLabel && primaryButtonHref ? (
                <ThemeButton href={primaryButtonHref}>{primaryButtonLabel}</ThemeButton>
              ) : null}
              {secondaryButtonLabel && secondaryButtonHref ? (
                <a
                  href={secondaryButtonHref}
                  className="inline-flex items-center rounded-pill border border-base px-7 py-[14px] font-semibold transition-colors hover:bg-base hover:text-ink"
                >
                  {secondaryButtonLabel}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const gradientDirection = "to right";

  return (
    <section className="relative min-h-[849px] overflow-hidden bg-ink text-base">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImageUrl})` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl"
        style={{
          backgroundImage: `url(${bgImageUrl})`,
          WebkitMaskImage: `linear-gradient(${gradientDirection}, black 0%, black 42%, transparent 72%)`,
          maskImage: `linear-gradient(${gradientDirection}, black 0%, black 42%, transparent 72%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${gradientDirection}, rgba(6,20,90,.94), rgba(10,45,164,.82) 38%, rgba(10,45,164,.28) 60%, transparent 78%)`,
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/shapes/hero-border-pattern.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute end-0 top-0 hidden h-[300px] w-[212px] max-w-none opacity-70 lg:block"
      />
      <div className="relative mx-auto max-w-7xl px-[15px]">
        <div className="max-w-[930px] pb-[260px] pt-[250px]">
          {title.trim() ? (
            <h1
              className="mt-5 font-display text-[clamp(48px,6vw,76px)] font-bold leading-[1.12] [&_strong]:text-brand [&_a]:text-brand [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(title) }}
            />
          ) : null}
          {text.trim() ? (
            <div
              className="mt-6 max-w-[930px] leading-7 text-base/85 [&_strong]:font-bold [&_a]:text-brand [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(text) }}
            />
          ) : null}
          {primaryButtonLabel && primaryButtonHref || secondaryButtonLabel && secondaryButtonHref ? (
            <div className="mt-9 flex flex-wrap items-center gap-5">
              {primaryButtonLabel && primaryButtonHref ? (
                <ThemeButton href={primaryButtonHref}>{primaryButtonLabel}</ThemeButton>
              ) : null}
              {secondaryButtonLabel && secondaryButtonHref ? (
                <a
                  href={secondaryButtonHref}
                  className="inline-flex items-center gap-2 rounded-pill border border-base px-7 py-[14px] font-semibold transition-colors hover:bg-base hover:text-ink"
                >
                  {secondaryButtonLabel}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/shapes/hero-bottom-wave.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 start-0 w-full"
      />
    </section>
  );
}
