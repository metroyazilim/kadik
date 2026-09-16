// One product in the /products grid. Same card shell as ServiceCard (image,
// content block, "read More" link) with a badge and price tag layered on
// - a storefront card is a service card that also needs to show a price.
import { IconArrowRight } from "./Icon";

interface ProductCardProps {
  image: string;
  title: string;
  shortDescription: string;
  badge?: string | null;
  priceLabel?: string | null;
  href: string;
  ctaLabel: string;
}

export default function ProductCard({
  image,
  title,
  shortDescription,
  badge,
  priceLabel,
  href,
  ctaLabel,
}: ProductCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[15px] bg-base shadow-[var(--shadow-card)]">
      <div className="relative">
        <img src={image} alt={title} className="aspect-[660/391] w-full object-cover" />
        {badge ? (
          <span className="absolute start-4 top-4 rounded-pill bg-brand px-4 py-1 text-sm font-semibold text-base">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="px-[30px] py-8">
        <h4 className="font-display text-[24px] font-bold leading-[34px] text-ink">
          <a href={href} className="transition-colors hover:text-brand">
            {title}
          </a>
        </h4>
        <p className="mt-3 leading-[28px] text-muted">{shortDescription}</p>
        <div className="mt-5 flex items-center justify-between gap-4">
          {priceLabel ? <span className="font-display text-xl font-bold text-brand">{priceLabel}</span> : <span />}
          <a
            href={href}
            className="inline-flex items-center gap-2 font-semibold capitalize text-muted transition-colors hover:text-brand"
          >
            {ctaLabel} <IconArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          </a>
        </div>
      </div>
    </div>
  );
}
