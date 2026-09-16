"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn, helpText } from "./ui";

type LazyEditorBoundaryProps = Readonly<{
  children: ReactNode;
  fallback?: string;
  className?: string;
}>;

/**
 * Defers a heavy editor (TipTap instances, block composers) until after the
 * first paint, so opening an editor page is not blocked by editor
 * initialisation (Spec 15).
 *
 * The state flip happens inside a `requestAnimationFrame` callback, not
 * synchronously in the effect body: synchronous `setState` in an effect
 * forces a second render pass before the browser paints, which is exactly
 * the stall this component exists to avoid.
 */
export function LazyEditorBoundary({ children, fallback = "Düzenleyici yükleniyor…", className }: LazyEditorBoundaryProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!ready) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex min-h-[8rem] items-center justify-center rounded-[var(--radius-md)] border border-brand-border bg-brand-page",
          helpText,
          className,
        )}
      >
        {fallback}
      </div>
    );
  }

  return <>{children}</>;
}
