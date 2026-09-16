// Bölüm üst başlığı (eyebrow) + ana başlık. Dekor tamamen CSS: eyebrow'un
// yanındaki marka renkli kısa çizgiler `span` ile çizilir, görsel dosyası
// kullanılmaz.
import type { ReactNode } from "react";

interface SectionHeadingProps {
  subtitle: string;
  title: ReactNode;
  align?: "left" | "center";
  tone?: "dark" | "light";
  className?: string;
}

export default function SectionHeading({
  subtitle,
  title,
  align = "left",
  tone = "dark",
  className = "",
}: SectionHeadingProps) {
  const light = tone === "light";
  const rule = `h-[2px] w-[30px] shrink-0 ${light ? "bg-base" : "bg-brand"}`;
  // An unfilled admin field renders nothing at all - never an empty eyebrow
  // rule or a blank heading box that still occupies vertical rhythm.
  const hasSubtitle = typeof subtitle === "string" && subtitle.trim().length > 0;
  const hasTitle = typeof title === "string" ? title.trim().length > 0 : title !== null && title !== undefined;
  if (!hasSubtitle && !hasTitle) return null;

  return (
    <div className={`${align === "center" ? "text-center" : ""} ${className}`}>
      {hasSubtitle ? (
        <div
          className={`flex items-center gap-3 text-[16px] font-semibold uppercase leading-7 ${
            light ? "text-base" : "text-brand"
          } ${align === "center" ? "justify-center" : ""}`}
        >
          <span aria-hidden className={rule} />
          <span>{subtitle}</span>
          {align === "center" ? <span aria-hidden className={rule} /> : null}
        </div>
      ) : null}
      {hasTitle ? (
        <h2
          className={`mt-3 font-display text-[48px] font-bold capitalize leading-[56px] tracking-[-0.96px] ${
            light ? "text-base" : "text-ink"
          }`}
        >
          {title}
        </h2>
      ) : null}
    </div>
  );
}
