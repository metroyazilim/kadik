import Marquee from "@/components/Marquee";

export type MarqueeStripPartProps = Readonly<{
  words?: readonly string[];
}>;

export function MarqueeStripPart({
  words = [],
}: MarqueeStripPartProps) {
  if (!words || words.length === 0) return null;
  return (
    <Marquee className="border-b border-hairline bg-base py-9" itemClassName="gap-10 pe-10" repeat={4} durationSeconds={90} fadeEdges>
      {words.map((word) => (
        <span
          key={word}
          className="flex items-center gap-10 whitespace-nowrap font-display text-[48px] font-bold text-ink"
        >
          <i className="not-italic text-brand">✱</i>
          {word}
        </span>
      ))}
    </Marquee>
  );
}
