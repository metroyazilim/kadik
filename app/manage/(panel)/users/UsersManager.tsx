"use client";

import { useActionState, useState } from "react";
import { Trash2, KeyRound } from "lucide-react";
import { FormStatus } from "@/components/admin/StateSurfaces";
import { ToneBadge } from "@/components/admin/StatusBadge";
import {
  card,
  cardPadded,
  dangerLinkButton,
  fieldHint,
  fieldInput,
  fieldLabel,
  primaryButton,
  secondaryButton,
  sectionTitle,
  tableCell,
  tableHeadCell,
  tableHeadRow,
  tableRow,
  tableWrap,
} from "@/components/admin/ui";
import {
  changeAdminUserRoleAction,
  createAdminUserAction,
  deleteAdminUserAction,
  resetAdminUserPasswordAction,
  type UserActionState,
} from "./actions";

export type AdminUserRow = Readonly<{
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "AUTHOR";
  createdAt: string;
}>;

const ROLE_LABEL: Record<AdminUserRow["role"], string> = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  AUTHOR: "AUTHOR",
};

const ROLE_HINT = "SUPER_ADMIN: her şey + kullanıcı yönetimi · ADMIN: tüm içerik · AUTHOR: yalnızca blog";

const EMPTY: UserActionState = {};

/**
 * Read-only for ADMIN/AUTHOR, full CRUD for SUPER_ADMIN. The server actions
 * re-check the caller's database role, so hiding the controls here is a UX
 * affordance, not the security boundary.
 */
export function UsersManager({
  users,
  viewerId,
  isSuperAdmin,
}: {
  users: readonly AdminUserRow[];
  viewerId: string;
  isSuperAdmin: boolean;
}) {
  const [createState, createAction, isCreating] = useActionState(createAdminUserAction, EMPTY);
  const [rowState, rowAction, isRowPending] = useActionState(
    async (previous: UserActionState, formData: FormData) => {
      const intent = formData.get("intent");
      if (intent === "role") return changeAdminUserRoleAction(previous, formData);
      if (intent === "password") return resetAdminUserPasswordAction(previous, formData);
      if (intent === "delete") return deleteAdminUserAction(previous, formData);
      return { error: "Bilinmeyen işlem." };
    },
    EMPTY,
  );
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

  return (
    <div className="space-y-6">
      {isSuperAdmin ? (
        <form action={createAction} className={`${cardPadded} space-y-4`}>
          <div>
            <h2 className={sectionTitle}>Yeni yönetici ekle</h2>
            <p className={fieldHint}>{ROLE_HINT}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={fieldLabel}>
              Ad Soyad
              <input name="name" className={fieldInput} required maxLength={120} autoComplete="off" />
            </label>
            <label className={fieldLabel}>
              E-posta
              <input name="email" type="email" className={fieldInput} required autoComplete="off" />
            </label>
            <label className={fieldLabel}>
              Rol
              <select name="role" className={fieldInput} defaultValue="ADMIN">
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="ADMIN">ADMIN</option>
                <option value="AUTHOR">AUTHOR</option>
              </select>
            </label>
            <label className={fieldLabel}>
              Geçici şifre
              <input
                name="password"
                type="text"
                className={fieldInput}
                required
                minLength={10}
                autoComplete="new-password"
              />
              <span className={fieldHint}>En az 10 karakter. Kullanıcı ilk girişten sonra kendi şifresini belirleyebilir.</span>
            </label>
          </div>
          <FormStatus error={createState.error} success={createState.success} />
          <button type="submit" className={primaryButton} disabled={isCreating}>
            {isCreating ? "Ekleniyor..." : "Kullanıcı ekle"}
          </button>
        </form>
      ) : (
        <div className={`${card} p-4`}>
          <p className={fieldHint}>Kullanıcı ekleme ve rol değiştirme yalnızca SUPER_ADMIN yetkisine açıktır.</p>
        </div>
      )}

      <FormStatus error={rowState.error} success={rowState.success} />

      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={tableHeadRow}>
            <tr>
              <th className={tableHeadCell}>Ad Soyad</th>
              <th className={tableHeadCell}>E-posta</th>
              <th className={tableHeadCell}>Rol</th>
              <th className={tableHeadCell}>Kayıt Tarihi</th>
              {isSuperAdmin ? <th className={tableHeadCell}>İşlem</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border bg-brand-surface">
            {users.map((user) => (
              <tr key={user.id} className={tableRow}>
                <td className={tableCell}>
                  <div className="font-medium text-brand-text">{user.name}</div>
                  {user.id === viewerId ? <span className="text-xs text-brand-muted">bu hesap sizsiniz</span> : null}
                </td>
                <td className={tableCell}>{user.email}</td>
                <td className={tableCell}>
                  {isSuperAdmin ? (
                    <form action={rowAction} className="flex items-center gap-2">
                      <input type="hidden" name="intent" value="role" />
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="role"
                        defaultValue={user.role}
                        className={`${fieldInput} w-auto py-1.5`}
                        aria-label={`${user.name} rolü`}
                      >
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="AUTHOR">AUTHOR</option>
                      </select>
                      <button type="submit" className={secondaryButton} disabled={isRowPending}>
                        Kaydet
                      </button>
                    </form>
                  ) : (
                    <ToneBadge
                      tone={user.role === "SUPER_ADMIN" ? "success" : user.role === "ADMIN" ? "primary" : "muted"}
                      label={ROLE_LABEL[user.role]}
                    />
                  )}
                </td>
                <td className={tableCell}>{new Date(user.createdAt).toLocaleDateString("tr-TR")}</td>
                {isSuperAdmin ? (
                  <td className={tableCell}>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => setResetTarget(resetTarget === user.id ? null : user.id)}
                      >
                        <KeyRound className="size-3.5" aria-hidden="true" /> Şifre
                      </button>
                      {user.id === viewerId ? null : (
                        <button type="button" className={dangerLinkButton} onClick={() => setDeleteTarget(user)}>
                          <Trash2 className="size-3.5" aria-hidden="true" /> Sil
                        </button>
                      )}
                    </div>
                    {resetTarget === user.id ? (
                      <form
                        action={(formData) => {
                          setResetTarget(null);
                          return rowAction(formData);
                        }}
                        className="mt-3 flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="intent" value="password" />
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          name="password"
                          type="text"
                          className={`${fieldInput} w-56 py-1.5`}
                          placeholder="Yeni şifre (en az 10 karakter)"
                          minLength={10}
                          required
                          autoComplete="new-password"
                        />
                        <button type="submit" className={primaryButton} disabled={isRowPending}>
                          Şifreyi güncelle
                        </button>
                      </form>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/40 p-4">
          <div role="dialog" aria-modal="true" className={`${cardPadded} w-full max-w-md space-y-4`}>
            <h2 className={sectionTitle}>{deleteTarget.email} silinsin mi?</h2>
            <p className={fieldHint}>
              Hesap kalıcı olarak silinir ve açık oturumları kapanır. Kullanıcının yazdığı içerikler silinmez; denetim
              kaydı korunur.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button type="button" className={secondaryButton} onClick={() => setDeleteTarget(null)}>
                Vazgeç
              </button>
              <form
                action={(formData) => {
                  setDeleteTarget(null);
                  return rowAction(formData);
                }}
              >
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="userId" value={deleteTarget.id} />
                <button type="submit" className={primaryButton} disabled={isRowPending}>
                  Kalıcı sil
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
