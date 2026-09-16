import type { AdminRole, PrismaClient } from "@prisma/client";
import { ContentModelError } from "./errors";

/**
 * Who may permanently delete which collection.
 *
 * SUPER_ADMIN and ADMIN may delete any collection record. AUTHOR - the blog
 * author role - may delete the content collections they produce (services,
 * FAQ, projects, products, blog posts) but not the team roster, which is
 * organisational data rather than editorial content.
 *
 * The check reads the actor's role from the database rather than trusting a
 * client-supplied value: `AdminContext` only carries an identity, and role
 * changes must take effect immediately, not at next login.
 */
const AUTHOR_DELETABLE: Readonly<Record<string, true>> = {
  service: true,
  faq: true,
  project: true,
  product: true,
  post: true,
};

export async function assertCanDeleteContentType(
  client: PrismaClient,
  actorId: string,
  contentType: string,
): Promise<AdminRole> {
  const actor = await client.adminUser.findUnique({ where: { id: actorId }, select: { role: true } });
  if (!actor) {
    throw new ContentModelError("invalidInput", "Silme yetkisi doğrulanamadı.");
  }

  if (actor.role === "SUPER_ADMIN" || actor.role === "ADMIN") return actor.role;
  if (actor.role === "AUTHOR" && AUTHOR_DELETABLE[contentType] === true) return actor.role;

  throw new ContentModelError("invalidInput", "Bu kaydı silme yetkiniz yok.");
}
