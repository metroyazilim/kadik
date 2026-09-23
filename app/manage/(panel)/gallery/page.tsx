import { PageHeader } from "@/components/admin/PageHeader";
import { listAdminGallery } from "@/lib/kadik-content/collections";
import { GalleryManager } from "./GalleryManager";

export default async function GalleryAdminPage() {
  const items = await listAdminGallery();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="KADİK İçerikleri"
        title="Galeri"
        description="Galeri sayfasındaki fotoğraflar. Medya kütüphanesinden toplu ekleyin, kategori ve açıklama yazın, sürükleyerek sıralayın. Medya kütüphanesi tüm sitenin dosya deposudur; galeride yalnız buraya eklediğiniz fotoğraflar görünür."
      />
      <GalleryManager items={items} />
    </div>
  );
}
