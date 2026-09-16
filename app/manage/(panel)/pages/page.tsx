import { PageHeader } from "@/components/admin/PageHeader";
import { PagesPanel } from "./PagesPanel";

export default async function PagesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Sayfa Builder & Yönetimi"
        title="Yönetilen Sayfalar"
        description="Tüm site sayfalarını, bileşen canvas düzenlerini ve dil içeriklerini tek merkezden yönetin."
      />
      <PagesPanel />
    </div>
  );
}
