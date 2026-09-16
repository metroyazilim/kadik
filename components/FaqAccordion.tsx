// Accordion of question/answer pairs. Built on native <details>/<summary>
// instead of a client component with useState: it is keyboard- and
// screen-reader-accessible for free, and every entry still works with no JS.
import { IconArrowRight } from "./Icon";

interface FaqAccordionProps {
  items: { id: string; question: string; answer: string }[];
  /** Opens the first item by default so the list never looks collapsed-empty. */
  openFirst?: boolean;
}

export default function FaqAccordion({ items, openFirst = true }: FaqAccordionProps) {
  return (
    <div className="divide-y divide-hairline border border-hairline bg-base">
      {items.map((item, index) => (
        <details key={item.id} open={openFirst && index === 0} className="group px-6 py-5 sm:px-8">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-lg font-bold text-ink marker:content-none">
            {item.question}
            <IconArrowRight className="h-4 w-4 shrink-0 text-brand transition-transform duration-300 group-open:rotate-90 rtl:-scale-x-100 rtl:group-open:rotate-[-90deg]" />
          </summary>
          <div className="mt-4 leading-7 text-muted [&_a]:text-brand [&_a]:underline [&_li]:ms-5 [&_ol]:list-decimal [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: item.answer }} />
        </details>
      ))}
    </div>
  );
}
