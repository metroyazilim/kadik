import { PageHeader } from "@/components/admin/PageHeader";
import { EditorPageLayout } from "@/components/admin/EditorPageLayout";
import { prisma } from "@/lib/db";
import { resolveAdminContext } from "@/lib/content-model/admin-context";
import { isDeveloperModeActive } from "@/lib/content-model/developer-mode";
import { DeveloperModePanel } from "./DeveloperModePanel";
import { UsersPanel } from "./UsersPanel";

export default async function UsersPage() {
  const admin = await resolveAdminContext();
  const [viewer, developerModeActive] = await Promise.all([
    prisma.adminUser.findUnique({ where: { id: admin.actorId }, select: { role: true } }),
    isDeveloperModeActive(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Sistem"
        title="Yönetici Kullanıcılar"
        description="SUPER_ADMIN, ADMIN ve AUTHOR rollerini ve teknik oturum yetkilerini yönetin."
      />
      <EditorPageLayout
        main={<UsersPanel viewerId={admin.actorId} isSuperAdmin={viewer?.role === "SUPER_ADMIN"} />}
        aside={<DeveloperModePanel active={developerModeActive} isSuperAdmin={viewer?.role === "SUPER_ADMIN"} />}
      />
    </div>
  );
}
