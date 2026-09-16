import { PageHeader } from "@/components/admin/PageHeader";
import { AuditPanel } from "./AuditPanel";

type SearchParams = Promise<{ cursor?: string; direction?: "older" | "newer" }>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Audit Terminali"
        title="Güvenli Denetim Kayıtları"
        description="Cursor tabanlı, kesintisiz geriye ve ileriye dönük audit geçmişi."
      />
      <AuditPanel cursor={query.cursor} direction={query.direction} />
    </div>
  );
}
