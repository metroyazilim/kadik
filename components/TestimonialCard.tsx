// Referans kartı: tipografik alıntı işareti, avatar, isim/rol, yıldızlar ve
// alıntı metni. Tema görseli kullanılmaz; alıntı işareti saf tipografidir.
import { IconStar } from "./Icon";

interface TestimonialCardProps {
  avatar: string;
  name: string;
  role: string;
  quote: string;
}



export default function TestimonialCard({ avatar, name, role, quote }: TestimonialCardProps) {
  return (
    <figure className="relative flex h-full flex-col rounded-[15px] bg-base p-10 shadow-[0_4px_25px_0_rgba(56,75,255,0.08)]">
      <span aria-hidden className="absolute end-8 top-4 font-display text-[64px] leading-none text-brand/20">
        &ldquo;
      </span>
      <div className="flex items-start gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt={name} className="h-[100px] w-[100px] shrink-0 rounded-[15px] object-cover" />
        <figcaption>
          <h4 className="font-display text-[24px] font-bold leading-[34px] text-ink">{name}</h4>
          <p className="leading-[28px] text-muted">{role}</p>
          <div className="mt-2 flex gap-[3px] text-brand" aria-label="5 / 5">
            {Array.from({ length: 5 }, (_, index) => (
              <IconStar key={index} className="h-4 w-[18px]" />
            ))}
          </div>
        </figcaption>
      </div>
      <blockquote className="mt-6 leading-[28px] text-muted">{quote}</blockquote>
    </figure>
  );
}
