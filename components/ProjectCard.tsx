// Proje kartı: portre oranlı görsel üzerinde kategori, başlık ve yuvarlak
// bağlantı butonu taşıyan beyaz bilgi kartı. Sabit piksel yükseklik yerine
// oran kullanır, böylece her grid sütununda kartlar aynı boyda görünür.
import { IconArrowRight } from "./Icon";

interface ProjectCardProps {
  image: string;
  category: string;
  title: string;
  href?: string;
}

export default function ProjectCard({ image, category, title, href = "#" }: ProjectCardProps) {
  return (
    <div className="relative h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={title}
        className="aspect-[4/5] h-full w-full rounded-[15px] object-cover"
      />
      <div className="absolute inset-x-6 bottom-6 flex items-center justify-between gap-4 rounded-[15px] bg-base px-[30px] py-[28px]">
        <div className="min-w-0">
          <p className="font-medium leading-[28px] text-brand">{category}</p>
          <h4 className="mt-1 font-display text-[24px] font-bold leading-[32px] text-ink">
            <a href={href} className="text-muted transition-colors hover:text-brand">
              {title}
            </a>
          </h4>
        </div>
        <a
          href={href}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand transition-colors hover:bg-brand hover:text-base"
          aria-label={title}
        >
          <IconArrowRight className="h-5 w-5 rtl:-scale-x-100" />
        </a>
      </div>
    </div>
  );
}
