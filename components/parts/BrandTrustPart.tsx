import Marquee from "@/components/Marquee";

export type BrandTrustLogo = Readonly<{ url: string; alt: string; bgColor?: string }>;

export type BrandTrustPartProps = Readonly<{
  label?: string;
  /** Yönetim panelinden seçilen logolar. Boşsa logo şeridi hiç çizilmez -
   * yer tutucu logo üretilmez. */
  logos?: readonly BrandTrustLogo[];
}>;
/** Only a literal hex colour ever reaches the style attribute; anything else
 * (including a value that slipped past an older schema version) is dropped
 * and the logo renders without a tile. */
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function BrandTrustPart({ label, logos }: BrandTrustPartProps) {
  if (!label && (!logos || logos.length === 0)) return null;

  return (
    <section className="py-16">
      <div className="w-full">
        {label && label.trim() ? (
          <p className="mb-9 px-[15px] text-center font-display text-[22px] font-semibold text-ink">{label}</p>
        ) : null}
        {logos && logos.length > 0 ? (
          <Marquee repeat={4} durationSeconds={120} fadeEdges itemClassName="gap-10 md:gap-14 pe-10 md:pe-14">
            {logos.map((logo, index) => {
              const tile = logo.bgColor && HEX_COLOR.test(logo.bgColor) ? logo.bgColor : null;
              return (
                <div
                  key={`${logo.url}-${index}`}
                  className={`flex shrink-0 items-center justify-center ${tile ? "p-3 md:p-4" : ""}`}
                  style={{
                    // Fluid rather than breakpoint-stepped: 240x80 on a wide
                    // screen, scaling down with the viewport so the strip
                    // never overflows a phone.
                    width: "clamp(140px, 18vw, 240px)",
                    height: "clamp(48px, 6vw, 80px)",
                    ...(tile ? { backgroundColor: tile } : {}),
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.url}
                    alt={logo.alt}
                    className="max-h-full max-w-full object-contain opacity-90 transition-opacity hover:opacity-100"
                  />
                </div>
              );
            })}
          </Marquee>
        ) : null}
      </div>
    </section>
  );
}
