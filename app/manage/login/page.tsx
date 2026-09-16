"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "../actions";
import { AuthLayout } from "@/components/admin/AuthLayout";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { fieldInput, fieldLabel, primaryButton } from "@/components/admin/ui";

const initialState = { error: "" };

export default function ManageLoginPage() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <AuthLayout>
      <div className="mb-8">
        <span className="mb-5 flex size-12 items-center justify-center rounded-[var(--radius-sm)] bg-brand-invert text-base font-extrabold text-brand-on-invert">
          M
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-brand-text">Yönetim paneline giriş</h1>
        <p className="mt-1 text-sm text-brand-muted">Site içeriğini düzenlemek için oturum açın.</p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col">
          <label htmlFor="email" className={fieldLabel}>
            E-posta
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className={fieldInput} />
        </div>

        <div className="flex flex-col">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="password" className={fieldLabel}>
              Şifre
            </label>
            <Link
              href="/manage/forgot-password"
              className="text-xs font-semibold text-brand-primary hover:underline"
            >
              Şifremi unuttum
            </Link>
          </div>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>

        {state.error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-sm)] border border-brand-danger/30 bg-brand-danger/5 px-3 py-2 text-sm text-brand-danger"
          >
            {state.error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={`${primaryButton} mt-2 w-full py-2.5`}>
          {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </AuthLayout>
  );
}
