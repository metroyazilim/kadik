import { prisma } from "@/lib/db";
import { UsersManager, type AdminUserRow } from "./UsersManager";

export async function UsersPanel({ viewerId, isSuperAdmin }: { viewerId: string; isSuperAdmin: boolean }) {
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const rows: AdminUserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }));

  return <UsersManager users={rows} viewerId={viewerId} isSuperAdmin={isSuperAdmin} />;
}
