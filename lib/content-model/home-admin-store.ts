import type { HomeSectionKey, PrismaClient } from "@prisma/client";
import { assertAdminContext, type AdminContext } from "./admin-context";
import type { MaybeTransactionClient } from "./publishing";
import {
  publishHomeLayout,
  reorderHomeSections,
  setHomeSectionVisibility,
  type HomeLayoutPublishResult,
  type HomeLayoutSaveResult,
} from "./home-layout";
import { getHomeLayoutAdminView, type HomeLayoutAdminView } from "./home-registry-view";

/**
 * `AdminContentStore`'s Home-layout equivalent (Story 2.1, mirroring Story
 * 0.3's `admin-content-store.ts`). Every function rejects any `context` not
 * produced by `resolveAdminContext()`/`issueTestAdminContext()` before
 * touching the database, and derives the actor solely from the verified
 * context - never from `input`.
 */

export async function adminGetHomeLayoutView(
  client: PrismaClient,
  context: AdminContext,
): Promise<HomeLayoutAdminView> {
  assertAdminContext(context);
  return getHomeLayoutAdminView(client);
}

export type AdminReorderHomeSectionsInput = Readonly<{
  expectedVersion: number;
  orderedKeys: readonly HomeSectionKey[];
}>;

export async function adminReorderHomeSections(
  client: PrismaClient,
  context: AdminContext,
  input: AdminReorderHomeSectionsInput,
): Promise<HomeLayoutSaveResult> {
  assertAdminContext(context);
  return reorderHomeSections(client, { ...input, createdBy: context.actorId });
}

export type AdminSetHomeSectionVisibilityInput = Readonly<{
  expectedVersion: number;
  key: HomeSectionKey;
  enabled: boolean;
}>;

export async function adminSetHomeSectionVisibility(
  client: PrismaClient,
  context: AdminContext,
  input: AdminSetHomeSectionVisibilityInput,
): Promise<HomeLayoutSaveResult> {
  assertAdminContext(context);
  return setHomeSectionVisibility(client, { ...input, createdBy: context.actorId });
}

export type AdminPublishHomeLayoutInput = Readonly<{
  expectedVersion: number;
  expectedDraftRevisionId: string;
}>;

export async function adminPublishHomeLayout(
  client: MaybeTransactionClient,
  context: AdminContext,
  input: AdminPublishHomeLayoutInput,
): Promise<HomeLayoutPublishResult> {
  assertAdminContext(context);
  return publishHomeLayout(client, { ...input, publishedBy: context.actorId });
}
