import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { getAdminEvent } from "@/lib/kadik-content/collections";
import { EventEditor } from "../EventEditor";

export default async function EventEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = id === "new" ? null : await getAdminEvent(id);
  if (id !== "new" && !event) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Etkinlik"
        title={event?.title ?? "Yeni etkinlik"}
        description="Başlık ve tarih zorunlu; diğer alanlar doluysa sitedeki etkinlik penceresinde gösterilir."
        backHref="/manage/events"
        backLabel="Etkinliklere dön"
      />
      <EventEditor event={event} />
    </div>
  );
}
