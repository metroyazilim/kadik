// Hakkımızda sayfasındaki platform kutucuğu: yuvarlak ikon rozeti + kısa
// etiket. Glyph'ler inline SVG (components/OfferIcons.tsx); dekoratif köşe
// görselleri yerine CSS halka kullanılır.
import { OFFER_ICONS } from "./OfferIcons";

interface OfferItemProps {
  /** English key used to look up the source's inline SVG glyph (OFFER_ICONS is keyed in English). */
  iconKey: string;
  /** Displayed label text (Turkish). */
  label: string;
  highlighted?: boolean;
}

export default function OfferItem({ iconKey, label, highlighted = false }: OfferItemProps) {
  const Glyph = OFFER_ICONS[iconKey.toUpperCase()];
  return (
    <div className="relative px-[10px] pb-[30px] pt-px text-center">
      {highlighted ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-[70px] rounded-full border border-brand/40"
        />
      ) : null}
      <div
        className={`mx-auto flex h-[70px] w-[70px] items-center justify-center rounded-full text-base ${
          highlighted ? "bg-brand" : ""
        }`}
        style={
          highlighted
            ? undefined
            : { backgroundImage: "linear-gradient(#3c72fc -210.71%, #00060c 100%)" }
        }
      >
        {Glyph ? <Glyph className="h-9 w-9" /> : null}
      </div>
      <h5 className="mt-6 font-display text-[20px] font-bold leading-[30px] text-base">{label}</h5>
    </div>
  );
}
