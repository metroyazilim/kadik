import { Mail, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { card, primaryButton } from "@/components/admin/ui";
import { getMessage } from "@/lib/content";
import { MessagesPanel } from "../MessagesPanel";
import { mailtoHref, telHref } from "../message-links";

type Params = Promise<{ id: string }>;

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "long",
  timeStyle: "short",
});

export default async function MessageDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const message = await getMessage(id);
  if (!message) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Mesajlar"
        title={message.subject?.trim() || "Mesaj detayı"}
        description={`${message.name} tarafından ${dateFormatter.format(message.createdAt)} tarihinde gönderildi.`}
        backHref="/manage/messages"
        backLabel="Gelen kutusuna dön"
        action={
          <a href={mailtoHref(message.email)} className={primaryButton}>
            <Mail className="size-4" aria-hidden="true" />
            Yanıtla
          </a>
        }
      />

      <article className={`${card} p-5`}>
        <div className="grid gap-5 border-b border-brand-border pb-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              Gönderen
            </p>
            <p className="mt-1 text-sm font-bold text-brand-text">
              {message.name}
            </p>
            <a
              href={mailtoHref(message.email)}
              dir="ltr"
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-primary hover:underline"
            >
              <Mail className="size-4" aria-hidden="true" />
              {message.email}
            </a>
            {message.phone ? (
              <a
                href={telHref(message.phone)}
                dir="ltr"
                className="mt-1 flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-primary hover:underline"
              >
                <Phone className="size-4" aria-hidden="true" />
                {message.phone}
              </a>
            ) : (
              <span className="mt-1 flex items-center gap-1.5 text-sm text-brand-muted">
                <Phone className="size-4" aria-hidden="true" />
                Telefon belirtilmedi
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                Dil
              </dt>
              <dd className="mt-1 font-bold uppercase text-brand-text">
                {message.locale}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                Tarih
              </dt>
              <dd className="mt-1 text-brand-text">
                {dateFormatter.format(message.createdAt)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="pt-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
            Konu
          </p>
          <h2 className="mt-1 text-base font-bold text-brand-text">
            {message.subject || "Konu belirtilmedi"}
          </h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-brand-text">
            {message.message}
          </p>
        </div>
      </article>

      <MessagesPanel
        message={{
          id: message.id,
          name: message.name,
          status: message.status,
          version: message.version,
        }}
      />
    </div>
  );
}
