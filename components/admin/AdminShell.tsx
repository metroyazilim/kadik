"use client";

import { useState, type ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { ToastProvider } from "./Toast";

/**
 * Mounted once in `app/manage/(panel)/layout.tsx`. Every panel is a real
 * route below that layout, so navigating between panels re-renders only
 * the page slot - the rail, the top bar, and the toast stack persist.
 */
export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="admin-root min-h-svh bg-brand-page">
        <AdminSidebar email={email} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="lg:ml-64">
          <AdminTopbar onMenuOpen={() => setMobileOpen(true)} />
          <main className="px-4 py-6 lg:px-8 lg:py-7">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

export default AdminShell;
