// Pill call-to-action link ("get A Quote", "Explore More", "See all Services"...).
// Repeated across the header and most home-page sections, so it lives here.
import type { ReactNode } from "react";
import { IconArrowRight } from "./Icon";

interface ThemeButtonProps {
  href: string;
  children: ReactNode;
  variant?: "brand" | "light";
  className?: string;
  /** Only set for a published-settings CTA/nav link that resolved to an off-site `http(s)://` address. */
  target?: "_blank";
  rel?: string;
}

export default function ThemeButton({
  href,
  children,
  variant = "brand",
  className = "",
  target,
  rel,
}: ThemeButtonProps) {
  const palette =
    variant === "brand"
      ? "bg-brand text-base hover:bg-navy"
      : "bg-base text-ink hover:bg-brand hover:text-base";

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={`inline-flex items-center gap-2 rounded-pill px-[30px] py-[18px] text-[16px] font-semibold capitalize leading-4 transition-colors duration-300 ${palette} ${className}`}
    >
      {children}
      <IconArrowRight className="h-4 w-4" />
    </a>
  );
}
