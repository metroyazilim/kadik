import Reveal from "@/components/Reveal";

type LegalDocumentProps = {
  updated: string;
  body: string;
};

export default function LegalDocument({ updated, body }: LegalDocumentProps) {
  return (
    <section className="py-[120px]">
      <Reveal className="mx-auto max-w-4xl px-[15px]">
        <p className="mb-8 border-s-2 border-brand ps-4 text-sm font-semibold text-muted">{updated}</p>
        <div className="whitespace-pre-wrap leading-8 text-muted [&_a]:text-brand [&_a]:underline [&_li]:ms-5 [&_ol]:list-decimal [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: body }} />
      </Reveal>
    </section>
  );
}
