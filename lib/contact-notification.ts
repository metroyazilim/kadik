import "server-only";

import { sendMail } from "./mail";

export type ContactNotification = Readonly<{
  id: string;
  locale: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
}>;

/** Escapes visitor-supplied text before it is embedded in the HTML body -
 * the notification is mail, not a trusted admin surface. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends the admin inbox notification for a contact submission. The message
 * row is already stored when this runs, so a delivery failure only costs the
 * notification - never the message itself. `Reply-To` is not set through
 * `sendMail`'s narrow contract; the visitor's address is in the body and in
 * the admin inbox instead.
 */
export async function notifyContactMessage(message: ContactNotification): Promise<boolean> {
  const subject = message.subject?.trim()
    ? `Yeni iletişim mesajı: ${message.subject.trim()}`
    : `Yeni iletişim mesajı - ${message.name}`;

  const lines = [
    `Ad Soyad: ${message.name}`,
    `E-posta: ${message.email}`,
    message.phone ? `Telefon: ${message.phone}` : null,
    `Dil: ${message.locale.toUpperCase()}`,
    message.subject ? `Konu: ${message.subject}` : null,
    "",
    message.message,
    "",
    `Yönetim panelinde aç: /manage/messages/${message.id}`,
  ].filter((line): line is string => line !== null);

  return sendMail({
    to: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || "",
    subject,
    text: lines.join("\n"),
    html: lines.map((line) => (line === "" ? "<br />" : `<p>${escapeHtml(line)}</p>`)).join(""),
  });
}
