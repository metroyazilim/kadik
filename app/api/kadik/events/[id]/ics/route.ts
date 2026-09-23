import { SITE_URL } from "@/lib/i18n/config";
import { getPublicEvent } from "@/lib/kadik-content/collections";
import { buildEventIcs, icsFilename } from "@/lib/kadik-content/event-ics";
import { getKadikSiteContent } from "@/lib/kadik-content/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Add to calendar": downloads the event as an .ics file. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getPublicEvent(id);
  if (!event) return new Response("Event not found", { status: 404 });
  const { dict } = await getKadikSiteContent();
  const url = `${SITE_URL}/events?event=${encodeURIComponent(event.id)}`;
  return new Response(buildEventIcs(event, url, dict.organization.name), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${icsFilename(event)}"`,
      "cache-control": "no-store",
    },
  });
}
