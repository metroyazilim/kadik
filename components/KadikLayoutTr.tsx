import type { ReactNode } from "react";
import KadikLayout from "./KadikLayout";

/** Document root for every `/tr/*` route - the same shell as the English
 * default, with `lang="tr"`. */
export default function KadikLayoutTr({ children }: { children: ReactNode }) {
  return <KadikLayout lang="tr">{children}</KadikLayout>;
}
