import { PageHeader } from "@/components/admin/PageHeader";
import { HomePanel } from "./HomePanel";

export default function HomeLayoutPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Anasayfa"
        title="Anasayfa İçerikleri"
        description="Anasayfa component ve sırası kodda sabittir. Mevcut bölümlerin metin, görsel, ikon, buton ve bağlantılarını düzenleyin."
      />
      <HomePanel />
    </div>
  );
}
