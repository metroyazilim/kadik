"use client";

import type { ReactNode } from "react";
import { card, cn, helpText, sectionTitle } from "./ui";

type FormSectionProps = Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}>;

/** Non-collapsible section for small forms that should still share card hierarchy. */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn(card, "space-y-4 p-5", className)}>
      <div className="space-y-1">
        <h2 className={sectionTitle}>{title}</h2>
        {description ? <p className={cn(helpText, "leading-5")}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
