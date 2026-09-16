import { Plus } from "lucide-react";
import { primaryButton } from "./ui";

/**
 * "New <record>" control for a list page.
 *
 * Creating a record is a mutation, so it is a form submit, never a link to a
 * route that writes while rendering: a `<Link>` would let Next.js prefetch
 * the create address on hover and quietly produce empty entities, and
 * writing (plus `revalidatePath`) during a GET render is unsupported by the
 * App Router. The action creates the entity and redirects to its own
 * editor address, so the new record still gets a real, refreshable URL.
 */
export function CreateRecordButton({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form action={action}>
      <button type="submit" className={primaryButton}>
        <Plus className="size-4" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}
