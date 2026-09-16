// Infinite horizontal marquee track. Used on the home page for the brand logo
// strip and the "Technology / Data Security" heading band. Presentational only:
// it duplicates its children and scrolls the row with the captured marqueeLeft
// keyframe (25s linear loop).
import type { ReactNode } from "react";

interface MarqueeProps {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  /** How many times the child row is repeated inside each half of the
   * track. Two halves scroll by -50%, so the loop only looks continuous
   * when one half is wider than the viewport - a short row (a handful of
   * logos) needs repeating, otherwise the track visibly restarts. */
  repeat?: number;
  /** Seconds for one full loop. The default keyframe is tuned for a single
   * unrepeated row; a repeated (longer) track needs proportionally more
   * time or it scrolls that many times faster. */
  durationSeconds?: number;
  /** Fades the track out towards both edges instead of cutting it off, so
   * the loop reads as endless rather than clipped at the viewport border. */
  fadeEdges?: boolean;
}

export default function Marquee({
  children,
  className = "",
  itemClassName = "",
  repeat = 1,
  durationSeconds,
  fadeEdges = false,
}: MarqueeProps) {
  const copies = Array.from({ length: Math.max(1, repeat) }, (_, index) => index);
  const half = (
    <div className={`flex shrink-0 items-center ${itemClassName}`}>
      {copies.map((copy) => (
        <div key={copy} className={`flex shrink-0 items-center ${itemClassName}`}>
          {children}
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={`w-full overflow-hidden ${className}`}
      style={
        fadeEdges
          ? {
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, black 12%, black 88%, transparent 100%)",
              maskImage: "linear-gradient(to right, transparent 0, black 12%, black 88%, transparent 100%)",
            }
          : undefined
      }
    >
      <div
        className="flex w-max anim-marquee"
        style={durationSeconds ? { animationDuration: `${durationSeconds}s` } : undefined}
      >
        {half}
        <div aria-hidden>{half}</div>
      </div>
    </div>
  );
}
