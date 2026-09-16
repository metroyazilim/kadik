"use client";

import type { ReactNode } from "react";
import { cn } from "./ui";

type FieldGridProps = Readonly<{
  children: ReactNode;
  columns?: 2 | 3;
  className?: string;
}>;

/** Responsive grid for related form fields. */
export function FieldGrid({ children, columns = 2, className }: FieldGridProps) {
  return (
    <div className={cn("grid gap-5", columns === 3 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2", className)}>
      {children}
    </div>
  );
}
