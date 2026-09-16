import "server-only";
import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export type AuditEntryView = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorEmail: string | null;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
};

const SENSITIVE_KEYS = new Set(["password", "passwordHash", "token", "secret", "authorization", "cookie"]);

function sanitizeMetadata(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeMetadata);
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      sanitized[k] = "[REDACTED]";
    } else {
      sanitized[k] = sanitizeMetadata(v);
    }
  }
  return sanitized;
}

export async function getRecentAuditEntries(take = 50): Promise<AuditEntryView[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      createdAt: true,
      metadata: true,
      user: { select: { email: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    actorEmail: row.user?.email ?? null,
    createdAt: row.createdAt,
    metadata: sanitizeMetadata(row.metadata) as Prisma.JsonValue | null,
  }));
}
