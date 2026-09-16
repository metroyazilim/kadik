import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import ProcessStep from "@/components/ProcessStep";

export type WorkProcessItem = Readonly<{
  title: string;
  text: string;
  iconUrl?: string;
}>;

export type WorkProcessPartProps = Readonly<{
  subtitle?: string;
  title?: string;
  items?: readonly WorkProcessItem[];
}>;

export function WorkProcessPart({
  subtitle = "",
  title = "",
  items,
}: WorkProcessPartProps) {
  if (!items || items.length === 0) return null;

  return (
    <section className="py-[120px]">
      <Reveal className="mx-auto max-w-7xl px-[15px]">
        <SectionHeading subtitle={subtitle} title={title} align="center" />
        <div className="relative mt-16">
          {/* Adımları bağlayan çizgi: CSS kenarlığı, tema görseli değil. */}
          <div
            aria-hidden
            className="pointer-events-none absolute start-[10%] top-[63px] hidden w-[80%] border-t border-dashed border-hairline lg:block"
          />
          <div className="relative grid auto-rows-fr items-stretch gap-[30px] sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item, index) => (
              <ProcessStep
                key={`${item.title}-${index}`}
                index={index + 1}
                icon={item.iconUrl ?? null}
                title={item.title}
                text={item.text}
                reversed={index % 2 === 1}
              />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
