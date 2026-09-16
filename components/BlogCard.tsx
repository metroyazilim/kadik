// Blog kartı: kapak görseli, tarih rozeti, meta satırı, başlık ve "devamını
// oku" bağlantısı. Kart, grid satırındaki diğer kartlarla aynı yükseklikte
// kalır; alt bağlantı `mt-auto` ile daima en altta hizalanır.
import { IconArrowRight } from "./Icon";

interface BlogCardProps {
  image: string;
  day: string;
  month: string;
  author: string;
  category: string;
  title: string;
  readMore: string;
  href?: string;
}

export default function BlogCard({ image, day, month, author, category, title, readMore, href = "#blog" }: BlogCardProps) {
  return (
    <article className="group flex h-full flex-col">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={title}
          className="aspect-[4/3] w-full rounded-t-[15px] object-cover"
        />
        <div className="absolute start-5 top-5 flex h-[85px] w-[71px] flex-col items-center justify-center bg-brand text-base">
          <strong className="font-display text-[24px] font-bold leading-none">{day}</strong>
          <span className="mt-1 text-[14px] leading-none">{month}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col rounded-b-[15px] bg-base px-[30px] pb-[30px] pt-[30px] shadow-[var(--shadow-card)]">
        <ul className="flex flex-wrap items-center gap-5 text-[16px] text-muted">
          <li>{author}</li>
          <li>{category}</li>
        </ul>
        <h3 className="mt-3 font-display text-[28px] font-bold leading-[36px] text-ink">
          <a href={href} className="transition-colors duration-300 hover:text-brand">
            {title}
          </a>
        </h3>
        <a
          href={href}
          className="mt-auto inline-flex items-center gap-2 pt-4 text-[16px] font-semibold capitalize text-muted transition-colors duration-300 hover:text-brand"
        >
          {readMore} <IconArrowRight className="h-4 w-4 rtl:-scale-x-100" />
        </a>
      </div>
    </article>
  );
}
