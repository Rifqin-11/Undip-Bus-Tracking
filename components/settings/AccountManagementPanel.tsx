"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserCog,
} from "lucide-react";
import { AccountFormPanel } from "@/components/settings/AccountFormPanel";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { resolveAssignedBuggy } from "@/lib/buggy/assignment";
import type { Buggy } from "@/types/buggy";

const ACCOUNT_ROLES = ["Admin", "Driver", "Pengguna umum"] as const;

type AccountRole = (typeof ACCOUNT_ROLES)[number];

type ManagedAccount = {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  buggy_id: string | null;
  created_at: string | null;
  avatar: string;
};

type AccountsResponse = {
  accounts?: ManagedAccount[];
  message?: string;
};

type UpdateResponse = {
  account?: ManagedAccount;
  message?: string;
};

type DeleteResponse = {
  message?: string;
};

type AccountManagementPanelProps = {
  onClose: () => void;
};

const fallbackBuggyOptions = [
  { id: "buggy-1", label: "Buggy 01" },
  { id: "buggy-2", label: "Buggy 02" },
  { id: "buggy-3", label: "Buggy 03" },
  { id: "buggy-4", label: "Buggy 04" },
  { id: "buggy-5", label: "Buggy 05" },
];

export function AccountManagementPanel({
  onClose,
}: AccountManagementPanelProps) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { userProfile } = useUserRole();
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManagedAccount | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("Pengguna umum");
  const [buggyId, setBuggyId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [buggies, setBuggies] = useState<Buggy[]>([]);
  const [buggyOptions, setBuggyOptions] = useState(fallbackBuggyOptions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedAccount | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const roleLabel = useCallback(
    (value: string) => {
      if (value === "Admin") return tCommon("admin");
      if (value === "Driver") return tCommon("driver");
      return tCommon("generalUser");
    },
    [tCommon],
  );

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/admin/accounts", {
        cache: "no-store",
      });
      const payload = (await response.json()) as AccountsResponse;

      if (!response.ok) {
        throw new Error(payload.message || t("failedLoadAccounts"));
      }

      setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("failedLoadAccounts"));
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    async function loadBuggyOptions() {
      try {
        const response = await fetch("/api/buggy", { cache: "no-store" });
        if (!response.ok) return;

        const buggies = (await response.json()) as Buggy[];
        const nextOptions = buggies.map((buggy) => ({
          id: buggy.id,
          label: `${buggy.code} - ${buggy.name}`,
        }));

        setBuggies(buggies);

        if (nextOptions.length > 0) {
          setBuggyOptions(nextOptions);
        }
      } catch {
        // Tetap pakai opsi fallback.
      }
    }

    void loadBuggyOptions();
  }, []);

  const visibleBuggyOptions = useMemo(() => {
    if (!buggyId || buggyOptions.some((buggy) => buggy.id === buggyId)) {
      return buggyOptions;
    }

    return [{ id: buggyId, label: buggyId }, ...buggyOptions];
  }, [buggyId, buggyOptions]);

  const getBuggyDisplayName = useCallback(
    (assignedBuggyId: string | null) => {
      if (!assignedBuggyId) return "";

      const assignedBuggy = resolveAssignedBuggy(assignedBuggyId, buggies);
      if (assignedBuggy) return assignedBuggy.name;

      const option = buggyOptions.find((buggy) => buggy.id === assignedBuggyId);
      if (option) {
        return option.label.includes(" - ")
          ? option.label.split(" - ").slice(1).join(" - ")
          : option.label;
      }

      return assignedBuggyId;
    },
    [buggies, buggyOptions],
  );

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return accounts;

    return accounts.filter((account) =>
      [
        account.name,
        account.email,
        account.role,
        account.buggy_id ?? "",
        getBuggyDisplayName(account.buggy_id),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [accounts, getBuggyDisplayName, query]);

  const startEditing = (account: ManagedAccount) => {
    setEditingAccount(account);
    setName(account.name);
    setEmail(account.email);
    setRole(account.role);
    setBuggyId(account.buggy_id ?? "");
    setPassword("");
    setConfirmPassword("");
    setErrorMsg("");
  };

  const closeEditor = () => {
    setEditingAccount(null);
    setPassword("");
    setConfirmPassword("");
    setErrorMsg("");
  };

  const closeCreateAccount = () => {
    setCreatingAccount(false);
    void loadAccounts();
  };

  const handleSave = async () => {
    if (!editingAccount) return;
    if (password !== confirmPassword) {
      setErrorMsg(t("passwordMismatch"));
      return;
    }
    if (!name.trim()) {
      setErrorMsg(t("nameRequired"));
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAccount.id,
          name,
          email: email.trim() || undefined,
          role,
          buggy_id: role === "Driver" ? buggyId : null,
          password: password.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as UpdateResponse;

      if (!response.ok || !payload.account) {
        throw new Error(payload.message || t("failedSaveAccount"));
      }

      setAccounts((prev) =>
        prev.map((account) =>
          account.id === payload.account?.id ? payload.account : account,
        ),
      );
      closeEditor();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("failedSaveAccount"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/admin/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const payload = (await response.json()) as DeleteResponse;

      if (!response.ok) {
        throw new Error(payload.message || t("failedDeleteAccount"));
      }

      setAccounts((prev) =>
        prev.filter((account) => account.id !== deleteTarget.id),
      );

      if (editingAccount?.id === deleteTarget.id) {
        closeEditor();
      }

      setDeleteTarget(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("failedDeleteAccount"));
    } finally {
      setDeleting(false);
    }
  };

  if (creatingAccount) {
    return <AccountFormPanel mode="create" onClose={closeCreateAccount} />;
  }

  if (editingAccount) {
    const isEditingSelf = userProfile?.id === editingAccount.id;

    return (
      <section className="space-y-3">
        <DeleteConfirmModal
          open={deleteTarget?.id === editingAccount.id}
          title={t("deleteAccountTitle")}
          description={t("deleteAccountDescription", {
            name: editingAccount.name,
          })}
          confirmLabel={t("confirmDeleteAccount")}
          loadingLabel={t("deletingAccount")}
          isLoading={deleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => void handleDeleteAccount()}
        />

        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3 lg:p-4">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={closeEditor}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {t("account")}
              </p>
              <h2 className="truncate text-[17px] font-bold tracking-tight text-slate-900">
                {t("editAccount")}
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
                {t("name")}
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                placeholder={t("accountName")}
              />
            </label>

            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
                {t("newEmail")}
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                placeholder={t("optionalEmailPlaceholder")}
              />
              <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                {t("leaveEmailBlankHint")}
              </p>
            </label>

            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
                {t("role")}
              </span>
              <select
                value={role}
                disabled={isEditingSelf}
                onChange={(event) => setRole(event.target.value as AccountRole)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {ACCOUNT_ROLES.map((roleOption) => (
                  <option key={roleOption} value={roleOption}>
                    {roleLabel(roleOption)}
                  </option>
                ))}
              </select>
              {isEditingSelf ? (
                <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                  {t("activeRoleLocked")}
                </p>
              ) : null}
            </label>

            {role === "Driver" ? (
              <label className="block rounded-2xl border border-slate-200 bg-white p-3">
                <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
                  {t("chooseBuggy")}
                </span>
                <select
                  value={buggyId}
                  onChange={(event) => setBuggyId(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                >
                  <option value="">{t("unassigned")}</option>
                  {visibleBuggyOptions.map((buggy) => (
                    <option key={buggy.id} value={buggy.id}>
                      {buggy.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
                {t("newPassword")}
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                placeholder={t("leaveBlankPasswordPlaceholder")}
              />
            </label>

            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
                {t("confirmNewPassword")}
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                placeholder={t("confirmPasswordPlaceholder")}
              />
            </label>

            {errorMsg ? (
              <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-600">
                {errorMsg}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1a3b] px-4 py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#1a2b55] active:scale-[0.98] disabled:opacity-70"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? tCommon("saving") : t("saveChanges")}
          </button>

          {!isEditingSelf ? (
            <button
              type="button"
              onClick={() => setDeleteTarget(editingAccount)}
              disabled={saving || deleting}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] font-bold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 active:scale-[0.98] disabled:opacity-70"
            >
              <Trash2 className="h-4 w-4" />
              {t("deleteAccountTitle")}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3 lg:p-4">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {tCommon("admin")}
            </p>
            <h2 className="truncate text-[17px] font-bold tracking-tight text-slate-900">
              {t("manageAccounts")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void loadAccounts()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-[#0f1a3b] hover:text-[#0f1a3b] active:scale-95"
            aria-label={t("reloadAccounts")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCreatingAccount(true)}
          className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1a3b] px-3 py-2.5 text-[12px] font-bold text-white transition hover:bg-slate-900 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          {t("createAccount")}
        </button>

        <label className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
            placeholder={t("searchAccountPlaceholder")}
          />
        </label>

        {errorMsg ? (
          <p className="mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-600">
            {errorMsg}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
              >
                <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-2.5 w-3/5" />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Skeleton className="h-4 w-12 rounded-full" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAccounts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-500">
            {t("accountNotFound")}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => startEditing(account)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-[#0f1a3b]/30 hover:bg-slate-50 active:scale-[0.99]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#0f1a3b] text-sm font-black text-white">
                  {account.avatar}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-black text-slate-900">
                    {account.name}
                  </span>
                  <span className="block truncate text-[11px] font-semibold text-slate-400">
                    {account.email || t("emailHidden")}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {roleLabel(account.role)}
                  </span>
                  {account.buggy_id ? (
                    <span className="text-[10px] font-semibold text-slate-400">
                      {getBuggyDisplayName(account.buggy_id)}
                    </span>
                  ) : null}
                </span>
                <UserCog className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#0f1a3b]" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
