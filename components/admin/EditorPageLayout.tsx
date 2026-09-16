"use client";

import type { ReactNode } from "react";
import { cn } from "./ui";

type EditorPageLayoutProps = Readonly<{
  main: ReactNode;
  aside: ReactNode;
  className?: string;
  mainClassName?: string;
  asideClassName?: string;
}>;

/** Shared two-column editor shell: primary form body plus contextual side panel. */
export function EditorPageLayout({ main, aside, className, mainClassName, asideClassName }: EditorPageLayoutProps) {
  return (
    <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start", className)}>
      <div className={cn("min-w-0", mainClassName)}>{main}</div>
      <aside className={cn("min-w-0 xl:sticky xl:top-24", asideClassName)}>{aside}</aside>
    </div>
  );
}
