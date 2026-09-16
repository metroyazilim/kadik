"use client";

import { useActionState } from "react";
import { disableDeveloperModeAction, enableDeveloperModeAction } from "../developer-actions";
import { FormStatus } from "@/components/admin/StateSurfaces";
import { InfoCard } from "@/components/admin/InfoCard";
import { ToneBadge } from "@/components/admin/StatusBadge";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { fieldHint, fieldInput, fieldLabel, primaryButton, secondaryButton } from "@/components/admin/ui";

type DeveloperModePanelProps = Readonly<{
  active: boolean;
  isSuperAdmin: boolean;
}>;

/** Developer Mode is a 15-minute, password-re-authenticated session
 * capability for SUPER_ADMIN - not a global flag (Spec 14 AD-4). */
export function DeveloperModePanel({ active, isSuperAdmin }: DeveloperModePanelProps) {
  const [enableState, enableAction, enabling] = useActionState(enableDeveloperModeAction, {} as { error?: string; success?: string });
  const [disableState, disableAction, disabling] = useActionState(
    async () => disableDeveloperModeAction(),
    {} as { error?: string; success?: string },
  );

  return (
    <InfoCard
      title="Developer Mode"
      description="Tehlikeli teknik işlemler için SUPER_ADMIN şifresiyle açılan 15 dakikalık oturum yetkisi. Süre bitince kendiliğinden kapanır."
    >
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={active ? "warning" : "muted"} label={active ? "Aktif" : "Kapalı"} />
        {!isSuperAdmin ? <span className={fieldHint}>Bu yetki yalnızca SUPER_ADMIN rolüne açıktır.</span> : null}
      </div>

      {active ? (
        <form action={disableAction} className="space-y-2">
          <button type="submit" disabled={disabling} className={secondaryButton}>
            {disabling ? "Kapatılıyor…" : "Şimdi kapat"}
          </button>
          <FormStatus error={disableState.error} success={disableState.success} />
        </form>
      ) : (
        <form action={enableAction} className="space-y-3">
          <label className={fieldLabel}>
            Şifreniz
            <PasswordInput name="password" autoComplete="current-password" required disabled={!isSuperAdmin} />
          </label>
          <button type="submit" disabled={enabling || !isSuperAdmin} className={primaryButton}>
            {enabling ? "Doğrulanıyor…" : "15 dakika için aç"}
          </button>
          <FormStatus error={enableState.error} success={enableState.success} />
        </form>
      )}
    </InfoCard>
  );
}
