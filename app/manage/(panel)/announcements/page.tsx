import { PageHeader } from "@/components/admin/PageHeader";
import { listAdminAnnouncements } from "@/lib/kadik-content/collections";
import { AnnouncementsList } from "./AnnouncementsList";

export default async function AnnouncementsAdminPage() {
  const items = await listAdminAnnouncements();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="KADİK İçerikleri"
        title="Duyurular"
        description="Duyurular sayfasındaki kartlar. Sitede görünen sırayı sürükleyerek değiştirin; bir duyuruyu açıp Kaydet dediğinizde hemen yayına girer."
        actionHref="/manage/announcements/new"
        actionLabel="Yeni duyuru"
      />
      <AnnouncementsList items={items} />
    </div>
  );
}
