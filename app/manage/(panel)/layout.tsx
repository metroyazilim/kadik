import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DatabaseNotConfigured } from "@/components/admin/DatabaseNotConfigured";
import { getAdminSession } from "@/lib/admin-auth";
import { hasAuthSecret, hasDatabase } from "@/lib/env";

/**
 * Never prerendered. Every screen below this layout is session-gated and
 * reads (and idempotently bootstraps) live database rows, so a build-time
 * export has nothing valid to produce: the session cookie bailout and the
 * panel's own queries race, and a database that is unreachable during
 * `next build` (the Docker image builds with a placeholder
 * `DATABASE_URL`) failed the export instead of falling back.
 */
export const dynamic = "force-dynamic";

/**
 * The single auth gate for every `/manage` screen. Each panel below this
 * layout is its own route, so this session read happens once per
 * navigation and the shell (rail, top bar, toast stack) is never
 * remounted. `/manage/login` is a sibling route outside this group and is
 * deliberately not wrapped.
 *
 * Individual mutations re-resolve the admin context themselves - this gate
 * decides what is *offered*, not what is *allowed*.
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  if (!hasDatabase() || !hasAuthSecret()) return <DatabaseNotConfigured context="Yönetim paneli" />;

  const session = await getAdminSession();
  if (!session) redirect("/manage/login");

  return <AdminShell email={session.email}>{children}</AdminShell>;
}
