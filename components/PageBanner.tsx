// Alt sayfa hero şeridi: fotoğraf arka planı üzerinde koyu gradient katman ve
// ortalanmış başlık + "Ana Sayfa / <sayfa>" izi. Tema shape görselleri yerine
// saf CSS dekor kullanılır; arka plan görseli verilmezse Unsplash yer tutucu.
import { DUMMY_HERO_IMAGE } from "@/lib/media/dummy-images";

interface PageBannerProps {
  title: string;
  current: string;
  /** Localised label and href of the first crumb. */
  homeLabel: string;
  homeHref: string;
  backgroundImageUrl?: string;
}

export default function PageBanner({
  title,
  current,
  homeLabel,
  homeHref,
  backgroundImageUrl = DUMMY_HERO_IMAGE,
}: PageBannerProps) {
  return (
    <div
      className="relative min-h-[420px] bg-ink bg-cover bg-center"
      style={{ backgroundImage: `url(${backgroundImageUrl})` }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(270deg, rgba(24,24,94,.85) 0%, rgba(15,13,29,.92) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 end-0 hidden w-1/3 lg:block"
        style={{ backgroundImage: "linear-gradient(to left, rgba(56,75,255,.28), transparent)" }}
      />
      <div className="relative mx-auto flex min-h-[420px] max-w-7xl flex-col items-center justify-center px-[15px] py-20 text-center text-base">
        <h1 className="font-display text-[clamp(38px,5vw,65px)] font-bold leading-tight">{title}</h1>
        <ul className="mt-4 flex items-center justify-center gap-[10px] text-[16px] font-semibold capitalize">
          <li>
            <a href={homeHref} className="transition-colors duration-300 hover:text-brand">
              {homeLabel}
            </a>
          </li>
          <li aria-hidden className="rtl:-scale-x-100">
            &rsaquo;
          </li>
          <li>{current}</li>
        </ul>
      </div>
    </div>
  );
}
