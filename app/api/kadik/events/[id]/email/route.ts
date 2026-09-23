import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/i18n/config";
import { checkRateLimit, hashRateLimitKey } from "@/lib/content-model/rate-limit";
import { stripHtmlToText } from "@/lib/content-model/sanitization";
import { getPublicEvent } from "@/lib/kadik-content/collections";
import { buildEventIcs, icsFilename } from "@/lib/kadik-content/event-ics";
import { getKadikSiteContent } from "@/lib/kadik-content/store";
import { isMailConfigured, sendMail } from "@/lib/mail";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().email().max(254),
  website: z.string().optional(),
});

const RATE_SCOPE = "kadik-event-email";
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * "Send the details to my email": mails the event (with an .ics calendar
 * invite) to the address the visitor typed. Rate limited per IP and per
 * address so the form cannot be used to spam a third party. See
 * lib/contact-actions.ts for the x-forwarded-for trust assumption.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  // Honeypot filled: pretend success, send nothing.
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const { id } = await params;
  const event = await getPublicEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (!isMailConfigured()) return NextResponse.json({ error: "Email is not available." }, { status: 503 });

  const email = parsed.data.email.toLowerCase();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  try {
    for (const [identifier, limit] of [[`ip:${ip}`, 10], [`to:${email}`, 3]] as const) {
      const result = await checkRateLimit(prisma, { scope: RATE_SCOPE, bucketKey: hashRateLimitKey(identifier, RATE_SCOPE), windowMs: 60 * 60 * 1000, limit });
      if (!result.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Please try again later." }, { status: 503 });
  }

  const { dict } = await getKadikSiteContent();
  const t = dict.events;
  const url = `${SITE_URL}/events?event=${encodeURIComponent(event.id)}`;
  // A site-relative registration link ("/membership") must be absolute in an email.
  const registrationUrl = event.registrationUrl ? new URL(event.registrationUrl, SITE_URL).toString() : null;
  const [year, month, day] = event.date.split("-").map(Number);
  const dateText = new Date(year, month - 1, day).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = event.startTime ? (event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime) : null;
  const facts: [string, string][] = [[t.dateLabel, dateText], ...(time ? [[t.timeLabel, time] as [string, string]] : []), ...(event.location ? [[t.locationLabel, event.location] as [string, string]] : [])];
  const descriptionText = event.descriptionHtml ? stripHtmlToText(event.descriptionHtml).trim() : "";

  const text = [
    event.title,
    "",
    ...facts.map(([label, value]) => `${label}: ${value}`),
    ...(descriptionText ? ["", descriptionText] : []),
    ...(registrationUrl ? ["", `${t.register}: ${registrationUrl}`] : []),
    "",
    url,
    "",
    dict.organization.name,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#14243e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
<tr><td style="background:#07285f;padding:28px 32px;color:#ffffff"><img src="${SITE_URL}/kadik/og/logo-white.png" width="56" height="56" alt="" style="vertical-align:middle"> <span style="font-family:Georgia,serif;font-size:26px;letter-spacing:3px;vertical-align:middle;margin-left:12px">KADİK</span></td></tr>
${event.image ? `<tr><td><img src="${escapeHtml(new URL(event.image, SITE_URL).toString())}" width="600" alt="" style="display:block;width:100%;height:auto"></td></tr>` : ""}
<tr><td style="padding:32px">
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:28px;line-height:1.2">${escapeHtml(event.title)}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px">${facts.map(([label, value]) => `<tr><td style="padding:4px 16px 4px 0;color:#0b4da2;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:15px">${escapeHtml(value)}</td></tr>`).join("")}</table>
${event.descriptionHtml ? `<div style="font-size:15px;line-height:1.7;color:#4a5163">${event.descriptionHtml}</div>` : ""}
<p style="margin:28px 0 0">${registrationUrl ? `<a href="${escapeHtml(registrationUrl)}" style="display:inline-block;background:#0b4da2;color:#ffffff;padding:12px 22px;text-decoration:none;font-size:13px;letter-spacing:1px;margin-right:8px">${escapeHtml(t.register)}</a>` : ""}<a href="${escapeHtml(url)}" style="display:inline-block;border:1px solid #07285f;color:#07285f;padding:11px 22px;text-decoration:none;font-size:13px;letter-spacing:1px">${escapeHtml(t.details)}</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#68748a">${escapeHtml(t.addToCalendar)}: the attached .ics file.</p>
</td></tr>
<tr><td style="padding:20px 32px;background:#f4f6fa;font-size:12px;color:#68748a">${escapeHtml(dict.organization.name)} · ${escapeHtml(dict.contact.email)}</td></tr>
</table></td></tr></table></body></html>`;

  const sent = await sendMail({
    to: email,
    subject: `${event.title} · ${dateText}`,
    text,
    html,
    attachments: [{ filename: icsFilename(event), content: buildEventIcs(event, url, dict.organization.name), contentType: "text/calendar; charset=utf-8; method=PUBLISH" }],
  });
  if (!sent) return NextResponse.json({ error: "The email could not be sent." }, { status: 502 });
  await prisma.auditLog.create({ data: { action: "kadik.event.email", entity: "KadikEvent", entityId: event.id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
