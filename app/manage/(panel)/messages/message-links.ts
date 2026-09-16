import type { MessageStatusFilter } from "@/lib/content";

/** Builds the server-rendered inbox filter links without item query state. */
export function messagesHref(
  status: MessageStatusFilter,
  page = 1,
): string {
  const search = new URLSearchParams();
  if (status !== "ALL") search.set("status", status);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/manage/messages?${query}` : "/manage/messages";
}

/** Creates an email link for contact details shown inside the admin panel. */
export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}

/** Creates a dialable link while preserving the formatted phone as label text. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
