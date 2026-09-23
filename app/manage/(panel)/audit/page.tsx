import { PageHeader } from "@/components/admin/PageHeader";
import { AuditPanel } from "./AuditPanel";

type SearchParams = Promise<{ cursor?: string; direction?: "older" | "newer" }>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Sistem"
        title="Denetim Terminali"
        description="Panelde yapılan her işlem (giriş, kaydetme, yayınlama, medya, silme) kim tarafından ve ne zaman yapıldığıyla burada. Aşağıdaki satıra yazarak kayıtları filtreleyebilirsiniz."
      />
      <AuditPanel cursor={query.cursor} direction={query.direction} />
    </div>
  );
}
