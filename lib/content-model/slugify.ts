/**
 * Route slugs are always derived from the record's own title - there is no
 * hand-typed slug field anywhere in admin. Turkish letters are folded to
 * their ASCII route equivalents first (ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c) because
 * `String.normalize("NFD")` alone leaves `ı` and `ğ` unmapped, which would
 * silently drop them from the address.
 */
const TURKISH_FOLD: Readonly<Record<string, string>> = {
  ı: "i",
  İ: "i",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
  ü: "u",
  Ü: "u",
  ö: "o",
  Ö: "o",
  ç: "c",
  Ç: "c",
};

export function slugifyTitle(value: string): string {
  const folded = [...value.trim()].map((character) => TURKISH_FOLD[character] ?? character).join("");
  return folded
    .toLocaleLowerCase("en")
    .normalize("NFD")
    // Strip combining marks left by NFD (é → e), then anything that is not a
    // route-safe character.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150)
    .replace(/-+$/g, "");
}
