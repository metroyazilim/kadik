import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional e-mail boundary. Configuration is read lazily (not at module
 * load) so a deployment without SMTP credentials still boots - the caller
 * gets `false` and decides how to degrade, instead of the whole route
 * crashing on an unset variable.
 *
 * Nothing here ever throws a raw SMTP error into a UI response: send
 * failures are logged server-side and reported as a boolean, because a
 * password-reset form must not tell a visitor whether an address exists or
 * how the mail server is configured.
 */
export type MailMessage = Readonly<{
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: readonly Readonly<{ filename: string; content: string; contentType: string }>[];
}>;

const globalForMail = globalThis as unknown as { metroMailTransport?: Transporter | null };

function resolveTransport(): Transporter | null {
  if (globalForMail.metroMailTransport !== undefined) return globalForMail.metroMailTransport;

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  // `SMTP_PASSWORD` is accepted as an alias: older .env.local files used that name.
  const pass = (process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD)?.trim();
  const port = Number.parseInt(process.env.SMTP_PORT?.trim() || "465", 10);

  if (!host || !user || !pass || !Number.isFinite(port)) {
    globalForMail.metroMailTransport = null;
    return null;
  }

  globalForMail.metroMailTransport = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587/25 negotiate STARTTLS after connecting.
    secure: port === 465,
    auth: { user, pass },
  });
  return globalForMail.metroMailTransport;
}

export function isMailConfigured(): boolean {
  return resolveTransport() !== null;
}

export async function sendMail(message: MailMessage): Promise<boolean> {
  const transport = resolveTransport();
  if (!transport) {
    console.warn("[mail] SMTP is not configured; message dropped:", message.subject);
    return false;
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments?.map((attachment) => ({ ...attachment })),
    });
    return true;
  } catch (error) {
    console.error("[mail] send failed:", error instanceof Error ? error.message : error);
    return false;
  }
}
