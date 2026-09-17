import type { ReactNode } from "react";
import "@/app/globals.css";

export default function KadikLayout({ children }: { children: ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>;
}
