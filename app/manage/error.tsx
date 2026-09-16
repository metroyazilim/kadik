"use client";

import { useEffect } from "react";
import { AlertOctagon } from "lucide-react";

/**
 * Error boundary for every `/manage` route. Renders inside `app/manage/layout.tsx`'s
 * existing `<html>/<body>` (this is a segment boundary, not `global-error.tsx`,
 * so it must not redeclare the document shell). Deliberately shows a fixed,
 * safe message regardless of `error.message` content - an uncaught exception
 * here must never surface a stack trace, file path, or database detail to
 * the browser (AC-1.2-04, AC-1.3-02).
 */
export default function ManageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin route error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div role="alert" className="w-full max-w-md rounded-xl border border-brand-danger/30 bg-brand-surface p-8 text-center shadow-[0_1px_2px_rgba(23,32,51,0.04)]">
        <AlertOctagon className="mx-auto h-8 w-8 text-brand-danger" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold text-brand-text">Bir şeyler ters gitti</h1>
        <p className="mt-2 text-sm text-brand-muted">İşleminiz tamamlanamadı. Tekrar deneyebilir veya panele geri dönebilirsiniz.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
        >
          Tekrar dene
        </button>
      </div>
    </div>
  );
}
