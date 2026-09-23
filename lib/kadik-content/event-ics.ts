import type { KadikEventView } from "./collection-types";
import { stripHtmlToText } from "@/lib/content-model/sanitization";

/**
 * iCalendar (RFC 5545) file for one KADİK event. Times are written as
 * floating local times in Europe/London (the council's city) via TZID; an
 * event without a start time becomes an all-day entry.
 */

const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 octets are folded, as the spec requires. */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut -= 1;
    parts.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

function nextDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10).replace(/-/g, "");
}

export function buildEventIcs(event: KadikEventView, url: string, organizer: string): string {
  const day = event.date.replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KADIK London//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT", `UID:${event.id}@kadiklondon.org`, `DTSTAMP:${stamp}`];
  if (event.startTime) {
    lines.push(`DTSTART;TZID=Europe/London:${day}T${event.startTime.replace(":", "")}00`);
    const end = event.endTime ?? `${String(Math.min(23, Number(event.startTime.slice(0, 2)) + 1)).padStart(2, "0")}${event.startTime.slice(2)}`;
    lines.push(`DTEND;TZID=Europe/London:${day}T${end.replace(":", "")}00`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay(event.date)}`);
  }
  lines.push(`SUMMARY:${escape(event.title)}`);
  const description = [event.descriptionHtml ? stripHtmlToText(event.descriptionHtml).trim() : "", url].filter(Boolean).join("\n\n");
  lines.push(`DESCRIPTION:${escape(description)}`);
  if (event.location) lines.push(`LOCATION:${escape(event.location)}`);
  lines.push(`URL:${url}`, `ORGANIZER;CN=${escape(organizer)}:mailto:noreply@kadiklondon.org`, "END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function icsFilename(event: KadikEventView): string {
  const slug = event.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";
  return `kadik-${event.date}-${slug}.ics`;
}
