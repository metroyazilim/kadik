import Link from "next/link";
import { CalendarDays, Clock, MapPin, Pencil } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/StateSurfaces";
import { ToneBadge } from "@/components/admin/StatusBadge";
import { cn, iconButton, tableWrap } from "@/components/admin/ui";
import { listAdminEvents, type AdminEventRow } from "@/lib/kadik-content/collections";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

function EventRow({ event, past }: { event: AdminEventRow; past: boolean }) {
  return (
    <div className={cn("flex items-center gap-4 px-4 py-3", past && "opacity-70")}>
      <div className="min-w-0 flex-1">
        <Link href={`/manage/events/${event.id}`} className="block truncate text-sm font-bold text-brand-text hover:text-brand-primary">
          {event.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-brand-muted">
          <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden="true" />{formatDate(event.date)}</span>
          {event.startTime ? <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" />{event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime}</span> : null}
          {event.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{event.location}</span> : null}
        </p>
      </div>
      <ToneBadge tone={event.published ? "success" : "muted"} label={event.published ? "Yayında" : "Gizli"} />
      <Link href={`/manage/events/${event.id}`} className={iconButton} aria-label={`${event.title} düzenle`}>
        <Pencil className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

/** Event calendar admin: upcoming events first (soonest on top), then past ones. */
export default async function EventsAdminPage() {
  const events = await listAdminEvents();
  const today = todayKey();
  const upcoming = events.filter((event) => event.date >= today).reverse();
  const past = events.filter((event) => event.date < today);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="KADİK İçerikleri"
        title="Etkinlikler"
        description="Takvimde görünen etkinlikler. Ziyaretçi bir etkinliğe tıkladığında adı, tarihi, saati, yeri ve açıklaması bir pencerede açılır; boş bıraktığınız alan gösterilmez."
        actionHref="/manage/events/new"
        actionLabel="Yeni etkinlik"
      />
      {events.length === 0 ? (
        <EmptyState title="Henüz etkinlik yok" description="“Yeni etkinlik” ile ilk etkinliği ekleyin." />
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-brand-text">Yaklaşan etkinlikler ({upcoming.length})</h2>
            <div className={cn(tableWrap, "divide-y divide-brand-border")}>
              {upcoming.length ? upcoming.map((event) => <EventRow key={event.id} event={event} past={false} />) : <p className="px-4 py-3 text-sm text-brand-muted">Yaklaşan etkinlik yok.</p>}
            </div>
          </section>
          {past.length ? (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-brand-text">Geçmiş etkinlikler ({past.length})</h2>
              <div className={cn(tableWrap, "divide-y divide-brand-border")}>
                {past.map((event) => <EventRow key={event.id} event={event} past />)}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
