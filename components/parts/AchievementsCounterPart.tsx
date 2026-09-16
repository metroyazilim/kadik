import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import CounterItem from "@/components/CounterItem";

export type AchievementItem = Readonly<{
  value: string;
  label: string;
  iconUrl?: string;
}>;

export type AchievementsCounterPartProps = Readonly<{
  subtitle?: string;
  title?: string;
  items?: readonly AchievementItem[];
}>;

export function AchievementsCounterPart({
  subtitle = "",
  title = "",
  items,
}: AchievementsCounterPartProps) {
  if (!items || items.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-navy py-20 text-base">
      {/* Dekor: saf CSS ışık halkası - tema görseli kullanılmaz. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 end-[-6rem] h-[380px] w-[380px] rounded-full"
        style={{ backgroundImage: "radial-gradient(circle, rgba(56,75,255,.35), transparent 65%)" }}
      />
      <Reveal className="relative mx-auto grid max-w-7xl items-center gap-12 px-[15px] lg:grid-cols-[1.1fr_1.9fr]">
        <SectionHeading subtitle={subtitle} title={title} tone="light" />
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {items.map((item, index) => (
            <CounterItem
              key={item.label}
              icon={item.iconUrl ?? null}
              value={item.value}
              label={item.label}
              divider={index < items.length - 1}
            />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
