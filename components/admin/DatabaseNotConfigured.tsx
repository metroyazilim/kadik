import { DatabaseZap } from "lucide-react";
import { card } from "./ui";

/**
 * Shared "the environment isn't ready yet" surface. Every `/manage` route
 * bails to this before touching the database when `hasDatabase()` /
 * `hasAuthSecret()` fail - previously each page duplicated this markup
 * (and the public `text-brand`/`font-display` tokens) inline.
 */
export function DatabaseNotConfigured({ context }: { context: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-5 py-16">
      <section className={`${card} w-full p-8`}>
        <div className="flex items-center gap-2 text-brand-danger">
          <DatabaseZap className="h-5 w-5" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-wide">Yönetim paneli</p>
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-brand-text">Veritabanı yapılandırılmadı</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          {context} için <code className="rounded bg-brand-page px-1.5 py-0.5 text-brand-text">DATABASE_URL</code> ve en az 32 karakterlik{" "}
          <code className="rounded bg-brand-page px-1.5 py-0.5 text-brand-text">AUTH_SECRET</code> tanımlayın.
        </p>
      </section>
    </main>
  );
}
