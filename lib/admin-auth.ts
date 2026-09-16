import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ADMIN_SESSION_COOKIE, signSessionToken, verifySessionToken } from "./session-token";

export { ADMIN_SESSION_COOKIE };
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function startAdminSession(user: { id: string; email: string; name: string; tokenVersion: number }) {
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, await signSessionToken(user, SESSION_MAX_AGE), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSession() {
  const store = await cookies();
  const payload = await verifySessionToken(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!payload?.sub) return null;
  const user = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!user || user.tokenVersion !== payload.ver) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/manage/login");
  return session;
}

export async function recordAudit(data: { action: string; entity: string; entityId?: string; userId?: string; metadata?: Prisma.InputJsonValue }) {
  await prisma.auditLog.create({ data: { ...data, metadata: data.metadata ?? undefined } });
}
