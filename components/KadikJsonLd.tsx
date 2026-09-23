import { jsonLdString } from "@/lib/kadik-content/structured-data";

/** schema.org structured data, rendered server-side into the page body. */
export function KadikJsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
