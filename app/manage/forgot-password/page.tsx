"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction } from "../password-reset-actions";
import { AuthLayout } from "@/components/admin/AuthLayout";
import { fieldInput, fieldLabel, primaryButton } from "@/components/admin/ui";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, {});

  return (
    <AuthLayout>
      <div className="mb-8">
        <span className="mb-5 flex size-12 items-center justify-center rounded-[var(--radius-sm)] bg-brand-invert text-base font-extrabold text-brand-on-invert">
          M
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-brand-text">Şifremi unuttum</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Hesabınızın e-posta adresini girin; sıfırlama bağlantısını gönderelim.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col">
          <label htmlFor="email" className={fieldLabel}>
            E-posta
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className={fieldInput} />
        </div>

        {state.error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-sm)] border border-brand-danger/30 bg-brand-danger/5 px-3 py-2 text-sm text-brand-danger"
          >
            {state.error}
          </p>
        ) : null}

        {state.success ? (
          <p
            role="status"
            className="rounded-[var(--radius-sm)] border border-brand-success/30 bg-brand-success/5 px-3 py-2 text-sm text-brand-success"
          >
            {state.success}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={`${primaryButton} mt-2 w-full py-2.5`}>
          {pending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
        </button>

        <Link href="/manage/login" className="text-center text-sm font-semibold text-brand-primary hover:underline">
          Girişe dön
        </Link>
      </form>
    </AuthLayout>
  );
}
