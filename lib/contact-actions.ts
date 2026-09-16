"use server";

// Public contact form submission. Unlike app/manage/actions.ts this file is
// reachable by any visitor, so it carries its own narrow validation, a
// honeypot, a PostgreSQL-backed rate limit, and idempotent persistence
// instead of relying on admin auth.
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "./db";
import { CONTACT_RATE_LIMIT_MAX_SUBMISSIONS, CONTACT_RATE_LIMIT_SCOPE, CONTACT_RATE_LIMIT_WINDOW_MS, createMessage } from "./content";
import { checkRateLimit, cleanupExpiredRateLimitWindows, hashRateLimitKey } from "./content-model/rate-limit";
import { notifyContactMessage } from "./contact-notification";
import { isLocale } from "./i18n/config";

const ContactSchema = z.object({
  locale: z.string().refine(isLocale),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  phone: z.string().trim().max(50).optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
});
type ContactFormState = { status: "idle" | "error" | "rateLimited" | "success" };

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * First forwarded-for entry (the original client, per the standard
 * leftmost-is-client convention), falling back to `x-real-ip`, then a
 * fixed placeholder when neither header is present - never throws, never
 * blocks a request whose IP cannot be determined.
 *
 * Trust assumption: this header is only a meaningful identity signal
 * behind a reverse proxy/edge (Vercel, most managed PaaS/CDN fronting)
 * that overwrites a client-supplied `x-forwarded-for` with the real
 * connecting IP before forwarding. Next.js Server Actions have no access
 * to the raw socket, so there is no lower-level source of truth available
 * here. A deployment reachable directly (no trusted proxy stripping
 * client-supplied headers) lets an attacker spoof a fresh value per
 * request and bypass the per-IP rate limit below - a deployment-topology
 * constraint, not a code-level gap; production hosting MUST sit behind a
 * proxy that owns this header.
 */
async function clientIdentifier(): Promise<string> {
  const store = await headers();
  const forwardedFor = store.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return store.get("x-real-ip") ?? "unknown";
}

export async function submitContactMessage(
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  // Honeypot: a real visitor never fills this hidden field. A filled field
  // reports success without writing anything, so a bot cannot tell it was
  // caught. Kept outside the try block below: it never touches the
  // database, so there is nothing for that block's safety net to protect.
  if (text(formData, "company").length > 0) return { status: "success" };

  // CAP-8: a DB/unexpected failure anywhere below (rate-limit check,
  // cleanup, or the create itself) must resolve to the same safe `error`
  // state the Zod-validation-failure path already returns, never an
  // unhandled exception escaping the Server Action - mirrors
  // `app/manage/messages/actions.ts`'s `runStatusUpdate` try/catch on the
  // admin-mutation side of this same domain.
  try {
    const bucketKey = hashRateLimitKey(await clientIdentifier(), CONTACT_RATE_LIMIT_SCOPE);
    const rateLimit = await checkRateLimit(prisma, {
      scope: CONTACT_RATE_LIMIT_SCOPE,
      bucketKey,
      windowMs: CONTACT_RATE_LIMIT_WINDOW_MS,
      limit: CONTACT_RATE_LIMIT_MAX_SUBMISSIONS,
    });
    // Best-effort, never awaited into the rejection path below.
    void cleanupExpiredRateLimitWindows(prisma, 60 * 60 * 1000).catch(() => undefined);
    if (!rateLimit.allowed) return { status: "rateLimited" };

    const input = ContactSchema.safeParse({
      locale: text(formData, "locale"),
      name: text(formData, "name"),
      email: text(formData, "email"),
      phone: text(formData, "phone") || undefined,
      subject: text(formData, "subject") || undefined,
      message: text(formData, "message"),
    });
    if (!input.success) return { status: "error" };

    const created = await createMessage({
      locale: input.data.locale,
      name: input.data.name,
      email: input.data.email,
      phone: input.data.phone ?? null,
      subject: input.data.subject ?? null,
      message: input.data.message,
    });

    // The inbox row is the record of truth; the e-mail is a notification.
    // It is deliberately not awaited into the failure path: an SMTP outage
    // must never turn a stored message into an error for the visitor.
    void notifyContactMessage({
      id: created.id,
      locale: input.data.locale,
      name: input.data.name,
      email: input.data.email,
      phone: input.data.phone ?? null,
      subject: input.data.subject ?? null,
      message: input.data.message,
    }).catch(() => undefined);

    return { status: "success" };
  } catch {
    return { status: "error" };
  }
}
