import { PageHeader } from "@/components/admin/PageHeader";
import { SeoCenterPanel } from "./SeoCenterPanel";

export default function SeoAuditPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="SEO"
        title="SEO Denetimi"
        description="Yayınlanan her sayfa için başlık, açıklama, canonical ve site içi erişilebilirlik aynı kurallarla yeniden hesaplanır."
      />
      <SeoCenterPanel />
    </div>
  );
}
