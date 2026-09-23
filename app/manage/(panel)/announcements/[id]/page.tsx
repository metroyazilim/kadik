import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { getAdminAnnouncement } from "@/lib/kadik-content/collections";
import { AnnouncementEditor } from "../AnnouncementEditor";

export default async function AnnouncementEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = id === "new" ? null : await getAdminAnnouncement(id);
  if (id !== "new" && !item) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Duyuru" title={item?.title ?? "Yeni duyuru"} backHref="/manage/announcements" backLabel="Duyurulara dön" />
      <AnnouncementEditor item={item} />
    </div>
  );
}
