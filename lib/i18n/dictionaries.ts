import type { Locale } from "./config";
import { en } from "./dictionaries/en";
import { tr } from "./dictionaries/tr";
import type { Dictionary } from "./types";

// Static server-only imports keep the two canonical dictionaries out of the
// client bundle while avoiding runtime loader branches.
export const DICTIONARIES: Record<Locale, Dictionary> = { tr, en };
