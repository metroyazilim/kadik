"use client";

// Shared contact form: used on /contact and as the "request a quote" CTA on
// the services page. Posts to submitContactMessage, which writes a real
// Message row - no simulated success screen.
import { useActionState } from "react";
import { submitContactMessage } from "@/lib/contact-actions";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";

type State = { status: "idle" | "error" | "rateLimited" | "success" };
const initialState: State = { status: "idle" };

interface ContactFormProps {
  locale: Locale;
  dict: Dictionary;
  /** Pre-fills the subject field, e.g. with a service's title. */
  subjectPreset?: string;
}

export default function ContactForm({ locale, dict, subjectPreset }: ContactFormProps) {
  const [state, action, pending] = useActionState(submitContactMessage, initialState);
  const { contactPage: copy } = dict;

  if (state.status === "success") {
    return (
      <p role="status" className="border-s-2 border-brand bg-brand-soft px-6 py-5 font-semibold text-ink">
        {copy.successMessage}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot: hidden from sighted users and screen readers, real
          visitors never fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          {copy.nameLabel}
          <input
            name="name"
            required
            className="mt-2 w-full border border-hairline bg-base px-4 py-3 outline-none focus:border-brand"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          {copy.emailFieldLabel}
          <input
            name="email"
            type="email"
            required
            className="mt-2 w-full border border-hairline bg-base px-4 py-3 outline-none focus:border-brand"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          {copy.phoneFieldLabel}
          <input
            name="phone"
            type="tel"
            className="mt-2 w-full border border-hairline bg-base px-4 py-3 outline-none focus:border-brand"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          {copy.subjectLabel}
          <input
            name="subject"
            defaultValue={subjectPreset}
            className="mt-2 w-full border border-hairline bg-base px-4 py-3 outline-none focus:border-brand"
          />
        </label>
      </div>
      <label className="block text-sm font-semibold text-ink">
        {copy.messageLabel}
        <textarea
          name="message"
          required
          rows={5}
          className="mt-2 w-full resize-y border border-hairline bg-base px-4 py-3 leading-7 outline-none focus:border-brand"
        />
      </label>
      {state.status === "error" ? (
        <p role="alert" className="border-s-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
          {copy.errorMessage}
        </p>
      ) : null}
      {state.status === "rateLimited" ? (
        <p role="alert" className="border-s-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
          {copy.rateLimitedMessage}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-pill bg-brand px-8 py-4 font-semibold text-base transition hover:bg-navy disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? copy.sendingLabel : copy.submitLabel}
      </button>
    </form>
  );
}
