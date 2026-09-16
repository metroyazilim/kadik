"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { applyPasswordResetAction } from "../password-reset-actions";
import { AuthLayout } from "@/components/admin/AuthLayout";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { fieldLabel, primaryButton } from "@/components/admin/ui";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action, pending] = useActionState(applyPasswordResetAction, {});

  return (
    <>
      <div className="mb-8">
        <span className="mb-5 flex size-12 items-center justify-center rounded-[var(--radius-sm)] bg-brand-invert text-base font-extrabold text-brand-on-invert">
          M
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-brand-text">Yeni şifre belirle</h1>
        <p className="mt-1 text-sm text-brand-muted">Şifreniz en az 12 karakter olmalıdır.</p>
      </div>

      {token ? (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />

          <div className="flex flex-col">
            <label htmlFor="password" className={fieldLabel}>
              Yeni şifre
            </label>
            <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={12} />
          </div>

          <div className="flex flex-col">
            <label htmlFor="passwordConfirm" className={fieldLabel}>
              Yeni şifre (tekrar)
            </label>
            <PasswordInput
              id="passwordConfirm"
              name="passwordConfirm"
              autoComplete="new-password"
              required
              minLength={12}
            />
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
            {pending ? "Kaydediliyor…" : "Şifreyi güncelle"}
          </button>
        </form>
      ) : (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] border border-brand-danger/30 bg-brand-danger/5 px-3 py-2 text-sm text-brand-danger"
        >
          Sıfırlama bağlantısı eksik veya hatalı. Lütfen yeni bir bağlantı isteyin.
        </p>
      )}

      <Link
        href="/manage/login"
        className="mt-6 block text-center text-sm font-semibold text-brand-primary hover:underline"
      >
        Girişe dön
      </Link>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<p className="text-sm text-brand-muted">Yükleniyor…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
