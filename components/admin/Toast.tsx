"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastTone = "success" | "error";
type ToastEntry = { id: number; message: string; tone: ToastTone };
type ToastApi = { toast: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Admin-wide transient feedback. Every server-action result surfaces here
 * instead of pushing the page into an error state, so a save never costs
 * the administrator their scroll position or form focus.
 */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((entry) => entry.id !== id));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast(message, tone = "success") {
        const id = ++counter;
        setToasts((previous) => [...previous, { id, message, tone }]);
        setTimeout(() => dismiss(id), 3800);
      },
    }),
    [dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-100 flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2.5"
      >
        {toasts.map((entry) => {
          const ok = entry.tone === "success";
          const Icon = ok ? CheckCircle2 : AlertTriangle;
          return (
            <div
              key={entry.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-3.5 shadow-lg"
            >
              <span
                className={
                  ok
                    ? "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-success/10 text-brand-success"
                    : "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-danger/10 text-brand-danger"
                }
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <p className="flex-1 pt-1 text-sm text-brand-text">{entry.message}</p>
              <button
                type="button"
                onClick={() => dismiss(entry.id)}
                className="flex size-6 items-center justify-center rounded-[var(--radius-sm)] text-brand-muted transition-colors hover:bg-brand-muted-surface hover:text-brand-text"
                aria-label="Kapat"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
