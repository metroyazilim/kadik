/**
 * Labels for a record's publication state. Saving publishes, so "draft" only
 * appears on records saved before the single-button flow existed.
 */
export const STATUS_LABEL: Record<string, string> = { missing: "Henüz kaydedilmedi", draft: "Yayında değil", published: "Yayında" };
export const STATUS_TONE: Record<string, "muted" | "warning" | "success"> = { missing: "muted", draft: "warning", published: "success" };
