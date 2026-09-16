// Ekip kartı: portre oranlı görsel, dolu sosyal bağlantılar ve isim/rol
// bloğu. Sabit yükseklik yerine oran kullanır; kart grid satırındaki diğer
// kartlarla aynı boyda kalır.
//
// Kartın tamamı detay sayfasına gider: isim bağlantısı yerine kartı kaplayan
// tek bir overlay anchor kullanılır (iç içe anchor geçersiz HTML'dir). Sosyal
// bağlantılar overlay'in üstünde kalır, böylece kendi hedeflerine tıklanır.
import { IconInstagram, IconLinkedin, IconShare } from "./Icon";

export type TeamCardSocials = Readonly<{
  instagram?: string | null;
  linkedin?: string | null;
}>;

interface TeamCardProps {
  image: string;
  name: string;
  role: string;
  variant?: "plain" | "boxed";
  href: string;
  /** Yalnızca dolu olanlar render edilir; hepsi boşsa şerit hiç çizilmez. */
  socials?: TeamCardSocials;
}

function socialLinks(socials: TeamCardSocials | undefined) {
  const entries = [
    { label: "Instagram", url: socials?.instagram, Glyph: IconInstagram },
    { label: "LinkedIn", url: socials?.linkedin, Glyph: IconLinkedin },
  ];
  return entries.filter((entry): entry is { label: string; url: string; Glyph: typeof IconLinkedin } =>
    typeof entry.url === "string" && entry.url.trim().length > 0,
  );
}

export default function TeamCard({ image, name, role, variant = "plain", href, socials }: TeamCardProps) {
  const links = socialLinks(socials);

  const portrait = (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={name}
        className={`aspect-[4/5] w-full object-cover ${variant === "boxed" ? "rounded-t-[15px]" : "rounded-[15px]"}`}
      />
      {links.length > 0 ? (
        <>
          <ul className="absolute end-4 top-1/4 z-20 flex flex-col gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            {links.map(({ label, url, Glyph }) => (
              <li key={label}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${name} - ${label}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-base text-brand transition-colors duration-300 hover:bg-brand hover:text-base"
                >
                  <Glyph className="h-[18px] w-[18px]" />
                </a>
              </li>
            ))}
          </ul>
          <span aria-hidden className="absolute bottom-4 end-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-brand text-base">
            <IconShare className="h-4 w-4" />
          </span>
        </>
      ) : null}
    </div>
  );

  const overlayLink = (
    <a href={href} className="absolute inset-0 z-10 rounded-[15px]" aria-label={name}>
      <span className="sr-only">{name}</span>
    </a>
  );

  if (variant === "boxed") {
    return (
      <div className="group relative flex h-full flex-col rounded-[15px]">
        {portrait}
        <div className="flex flex-1 flex-col justify-center rounded-b-[15px] bg-navy px-5 pb-[30px] pt-[30px] text-center">
          <h3 className="font-display text-[26px] font-bold leading-[34px] text-base transition-colors duration-300 group-hover:text-brand">
            {name}
          </h3>
          <p className="leading-[28px] text-base">{role}</p>
        </div>
        {overlayLink}
      </div>
    );
  }

  return (
    <div className="group relative flex h-full flex-col text-center">
      {portrait}
      <h3 className="mt-5 font-display text-[26px] font-bold leading-[34px] text-ink transition-colors duration-300 group-hover:text-brand">
        {name}
      </h3>
      <p className="leading-[28px] text-muted">{role}</p>
      {overlayLink}
    </div>
  );
}
