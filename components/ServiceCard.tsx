// Hizmet kartı: kapak görseli, marka renkli ikon karesi, başlık, özet ve
// "devamını oku" bağlantısı. Kart, grid satırındaki en uzun kartla aynı
// yükseklikte durur (`h-full flex flex-col`), alt bağlantı `mt-auto` ile
// daima en altta hizalanır. İkon yoksa görsel yerine inline glyph çizilir.
import { IconArrowRight, IconArrowUpRight } from "./Icon";

interface ServiceCardProps {
  image: string;
  icon?: string | null;
  title: string;
  text: string;
  readMore: string;
  href?: string;
}

export default function ServiceCard({ image, icon, title, text, readMore, href = "#services" }: ServiceCardProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-b-[10px] bg-base shadow-[var(--shadow-card)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={title} className="aspect-[4/3] w-full object-cover" />
      <div className="relative z-[9] flex flex-1 flex-col px-[30px] pb-[35px] pt-10">
        <div className="-mt-[70px] mb-6 flex h-[70px] w-[70px] items-center justify-center rounded-lg bg-brand text-base">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="h-10 w-10 object-contain" />
          ) : (
            <IconArrowUpRight className="h-8 w-8" />
          )}
        </div>
        <h4 className="font-display text-[24px] font-bold leading-[34px] text-ink">
          <a href={href} className="transition-colors hover:text-brand">
            {title}
          </a>
        </h4>
        <p className="mt-3 leading-[28px] text-muted">{text}</p>
        <a
          href={href}
          className="mt-auto inline-flex items-center gap-2 pt-5 font-semibold capitalize text-muted transition-colors hover:text-brand"
        >
          {readMore} <IconArrowRight className="h-4 w-4 rtl:-scale-x-100" />
        </a>
      </div>
    </div>
  );
}
