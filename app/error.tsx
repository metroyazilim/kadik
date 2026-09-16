"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-[15px] text-ink">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-danger/10 text-brand-danger">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-ink">Beklenmeyen bir hata oluştu</h1>
        <p className="mt-2 text-sm text-muted">
          İşleminiz gerçekleştirilirken bir sorunla karşılaştık. Lütfen tekrar deneyin.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90"
          >
            Tekrar dene
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-base px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface"
          >
            Ana sayfaya dön
          </a>
        </div>
      </div>
    </div>
  );
}
