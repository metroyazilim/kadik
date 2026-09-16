import type { ReactNode } from "react";
import { card, cn, helpText, sectionTitle } from "./ui";

type InfoCardProps = Readonly<{
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}>;

export function InfoCard({ title, description, children, className }: InfoCardProps) {
  return (
    <section className={cn(card, "space-y-3 p-5", className)}>
      <div className="space-y-1">
        <h2 className={sectionTitle}>{title}</h2>
        {description ? <p className={cn(helpText, "leading-5")}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
