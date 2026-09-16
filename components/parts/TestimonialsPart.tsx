import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import TestimonialCard from "@/components/TestimonialCard";
import { DUMMY_AVATAR_IMAGES, dummyImage } from "@/lib/media/dummy-images";

export type TestimonialItem = Readonly<{
  name: string;
  role: string;
  avatarUrl?: string;
  quote?: string;
}>;

export type TestimonialsPartProps = Readonly<{
  subtitle?: string;
  title?: string;
  quote?: string;
  items?: readonly TestimonialItem[];
}>;

export function TestimonialsPart({
  subtitle = "",
  title = "",
  quote = "",
  items,
}: TestimonialsPartProps) {
  if (!items || items.length === 0) return null;

  return (
    <section className="bg-navy py-[120px] text-base">
      <Reveal className="mx-auto max-w-7xl px-[15px]">
        <SectionHeading subtitle={subtitle} title={title} tone="light" align="center" />
        <div className="mt-14 grid auto-rows-fr items-stretch gap-8 md:grid-cols-2">
          {items.map((person, index) => (
            <TestimonialCard
              key={person.name}
              avatar={person.avatarUrl || dummyImage(DUMMY_AVATAR_IMAGES, index)}
              name={person.name}
              role={person.role}
              quote={person.quote || quote}
            />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
