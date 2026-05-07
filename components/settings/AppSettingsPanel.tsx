"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  Info,
  KeyRound,
  LogIn,
  LogOut,
  Map as MapIcon,
  PanelRightOpen,
  RotateCcw,
  Radar,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";
import {
  AccountFormPanel,
  type AccountFormMode,
} from "@/components/settings/AccountFormPanel";
import { AccountManagementPanel } from "@/components/settings/AccountManagementPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  MAP_STYLE_OPTIONS,
  NEARBY_ALERT_RADIUS_OPTIONS,
  type AdminSettings,
} from "@/hooks/useAdminSettings";
import { useUserRole } from "@/hooks/useUserRole";

type NotificationPermissionState = "unsupported" | NotificationPermission;

type AppSettingsPanelProps = {
  mode: "public" | "admin";
  settings: AdminSettings;
  onUpdateSetting: <Key extends keyof AdminSettings>(
    key: Key,
    value: AdminSettings[Key],
  ) => void;
  /** Reset semua preferensi ke default. */
  onResetSettings?: () => void;
  onToggleBrowserNotification?: () => Promise<void> | void;
  onLogin?: () => void;
  onLogout?: () => Promise<void> | void;
  accountForm?: AccountFormMode | null;
  onAccountFormChange?: (mode: AccountFormMode | null) => void;
};

const settingCardClass =
  "flex items-center justify-between gap-3 rounded-[20px] border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]";

function ToggleSwitch({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
        checked ? "bg-[#0f1a3b]" : "bg-slate-300"
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function AppSettingsPanel({
  mode,
  settings,
  onUpdateSetting,
  onResetSettings,
  onToggleBrowserNotification,
  onLogin,
  onLogout,
  accountForm: controlledAccountForm,
  onAccountFormChange,
}: AppSettingsPanelProps) {
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(() =>
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "unsupported",
    );
  const [localAccountForm, setLocalAccountForm] =
    useState<AccountFormMode | null>(null);
  const [accountManagementOpen, setAccountManagementOpen] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);
  const pendingResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const {
    userProfile,
    loading: userLoading,
    isAdmin,
    isDriver,
  } = useUserRole();

  // Auto-revert konfirmasi reset setelah 4 detik agar tombol tidak "stuck".
  useEffect(() => {
    if (!pendingReset) return;
    pendingResetTimerRef.current = setTimeout(() => {
      setPendingReset(false);
    }, 4000);
    return () => {
      if (pendingResetTimerRef.current) {
        clearTimeout(pendingResetTimerRef.current);
        pendingResetTimerRef.current = null;
      }
    };
  }, [pendingReset]);

  const handleResetClick = () => {
    if (!onResetSettings) return;
    if (!pendingReset) {
      setPendingReset(true);
      return;
    }
    onResetSettings();
    setPendingReset(false);
  };

  const isDashboardMode = mode === "admin";
  const rawAccountForm = controlledAccountForm ?? localAccountForm;
  const activeAccountForm = userProfile ? rawAccountForm : null;
  const notificationDescription = isDriver
    ? "Notifikasi geofence armada"
    : isAdmin
      ? "Notifikasi operasional dashboard"
      : "Notifikasi buggy mendekati halte";

  const setActiveAccountForm = (nextMode: AccountFormMode | null) => {
    if (onAccountFormChange) {
      onAccountFormChange(nextMode);
      return;
    }
    setLocalAccountForm(nextMode);
  };

  const handleToggleNotification = async () => {
    await onToggleBrowserNotification?.();

    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    setNotificationPermission(Notification.permission);
  };

  const handleLogout = async () => {
    setActiveAccountForm(null);
    setAccountManagementOpen(false);

    if (onLogout) {
      await onLogout();
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const permissionLabel =
    notificationPermission === "unsupported"
      ? "Tidak didukung"
      : notificationPermission === "granted"
        ? "Diizinkan"
        : notificationPermission === "denied"
          ? "Diblokir"
          : "Belum diminta";

  if (activeAccountForm && (activeAccountForm === "edit" || isAdmin)) {
    return (
      <AccountFormPanel
        mode={activeAccountForm}
        onClose={() => setActiveAccountForm(null)}
      />
    );
  }

  if (isAdmin && accountManagementOpen) {
    return (
      <AccountManagementPanel onClose={() => setAccountManagementOpen(false)} />
    );
  }

  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="mb-3">
          <h2 className="text-[17px] font-bold text-slate-900">Settings</h2>
          <p className="text-[11px] text-slate-400">
            {isDashboardMode
              ? isDriver
                ? "Profil driver dan akses data armada"
                : "Akun dan preferensi dashboard admin"
              : "Profil dan preferensi aplikasi"}
          </p>
        </div>

        <div className="rounded-[20px] border border-slate-200/80 bg-white p-3.5">
          <div className="flex items-center gap-3">
            {userLoading ? (
              <Skeleton className="size-12 shrink-0 rounded-full" />
            ) : (
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#0f1a3b] text-lg font-black text-white">
                {userProfile?.avatar ?? (isDashboardMode ? "A" : "L")}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {userLoading ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-black tracking-tight text-slate-900">
                      {userProfile?.name ??
                        (isDashboardMode ? "Admin" : "Guest")}
                    </h3>
                  </div>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-400">
                    {userProfile?.role ??
                      (isDashboardMode
                        ? "SIMOBI Operator"
                        : "Sign-In untuk akses fitur yang lebih lengkap")}
                  </p>
                </>
              )}
            </div>
          </div>

          {userLoading ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Skeleton className="h-10 flex-1 rounded-2xl" />
              {isDashboardMode ? (
                <Skeleton className="h-10 flex-1 rounded-2xl" />
              ) : null}
              <Skeleton className="h-10 w-24 rounded-2xl" />
            </div>
          ) : userProfile ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveAccountForm("edit")}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-bold text-slate-700 transition hover:border-[#0f1a3b] hover:text-[#0f1a3b] active:scale-[0.98]"
              >
                <UserCog className="h-4 w-4" />
                Edit Account
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setAccountManagementOpen(true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] font-bold text-slate-700 transition hover:border-[#0f1a3b] hover:text-[#0f1a3b] active:scale-[0.98]"
                >
                  <Users className="h-4 w-4" />
                  Manage Accounts
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-[12px] font-bold text-rose-600 transition hover:border-rose-200 hover:bg-rose-100 active:scale-[0.98] ${
                  isAdmin ? "w-full" : ""
                }`}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1a3b] px-3 py-2.5 text-[12px] font-bold text-white transition hover:bg-slate-900 active:scale-[0.98]"
            >
              <LogIn className="h-4 w-4" />
              Sign-In
            </button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600">
            <Info className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold tracking-tight text-slate-900">
              Informasi Bus Kampus
            </h3>
            <p className="text-[11px] font-semibold text-slate-400">
              Solusi nyaman dan ramah lingkungan
            </p>
          </div>
        </div>
        <div className="space-y-2 text-[12px] leading-relaxed text-slate-500">
          <p className="rounded-[18px] border border-slate-200 bg-white px-3 py-2.5">
            SIMOBI membantu civitas UNDIP memantau bus kampus, halte, dan rute
            aktif secara realtime.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Jadwal
              </p>
              <p className="mt-1 font-bold text-slate-800">07.00 - 17.00</p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Rute
              </p>
              <p className="mt-1 font-bold text-slate-800">Lingkar Kampus</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="px-1 pb-1">
          <h3 className="text-[15px] font-bold tracking-tight text-slate-900">
            Pengaturan Aplikasi
          </h3>
          <p className="text-[11px] font-semibold text-slate-400">
            Preferensi tersimpan di perangkat ini
          </p>
        </div>

        {userLoading ? (
          <div className={settingCardClass}>
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-44" />
              </div>
            </div>
            <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
          </div>
        ) : userProfile ? (
          <div className={settingCardClass}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                <Bell className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-slate-900">
                  Browser Notification
                </p>
                <p className="text-[11px] font-semibold text-slate-400">
                  {notificationDescription} · {permissionLabel}
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.browserNotificationEnabled}
              onClick={() => void handleToggleNotification()}
              label="Browser Notification"
            />
          </div>
        ) : null}

        <div className={settingCardClass}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <PanelRightOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-black text-slate-900">
                Panel Terbuka
              </p>
              <p className="text-[11px] font-semibold text-slate-400">
                {isDashboardMode ? "Dashboard operator" : "Dashboard utama"}
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={settings.openPanelOnDashboard}
            onClick={() =>
              onUpdateSetting(
                "openPanelOnDashboard",
                !settings.openPanelOnDashboard,
              )
            }
            label="Panel terbuka otomatis"
          />
        </div>

        {/* Map Style ── segmented control */}
        <div className="rounded-[20px] border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-2.5 flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <MapIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-black text-slate-900">
                Style Peta
              </p>
              <p className="text-[11px] font-semibold text-slate-400">
                Pilih tampilan dasar peta
              </p>
            </div>
          </div>
          <div
            role="radiogroup"
            aria-label="Style peta"
            className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1"
          >
            {MAP_STYLE_OPTIONS.map((opt) => {
              const active = settings.mapStyle === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onUpdateSetting("mapStyle", opt.value)}
                  className={`rounded-xl py-1.5 text-[11px] font-bold transition active:scale-95 ${
                    active
                      ? "bg-white text-[#0f1a3b] shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nearby alert radius ── chip selector */}
        <div className="rounded-[20px] border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-2.5 flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600">
              <Radar className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-slate-900">
                Radius Alert Bus
              </p>
              <p className="text-[11px] font-semibold text-slate-400">
                Bus dianggap mendekat halte saat &lt;{" "}
                {settings.nearbyAlertRadiusMeters} m
              </p>
            </div>
          </div>
          <div
            role="radiogroup"
            aria-label="Radius alert bus mendekat"
            className="flex flex-wrap gap-1.5"
          >
            {NEARBY_ALERT_RADIUS_OPTIONS.map((opt) => {
              const active = settings.nearbyAlertRadiusMeters === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    onUpdateSetting("nearbyAlertRadiusMeters", opt.value)
                  }
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition active:scale-95 ${
                    active
                      ? "bg-[#0f1a3b] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-[#0f1a3b]/30 hover:text-[#0f1a3b]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {isAdmin ? (
          <div className={settingCardClass}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600">
                <SlidersHorizontal className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-slate-900">
                  Mode Compact
                </p>
                <p className="text-[11px] font-semibold text-slate-400">
                  Panel data admin
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.compactAdminPanels}
              onClick={() =>
                onUpdateSetting(
                  "compactAdminPanels",
                  !settings.compactAdminPanels,
                )
              }
              label="Mode compact panel data"
            />
          </div>
        ) : null}

        {/* Reset preferensi (2-step confirm, auto-revert 4s) */}
        {onResetSettings ? (
          <button
            type="button"
            onClick={handleResetClick}
            className={`mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-[12px] font-bold transition active:scale-[0.98] ${
              pendingReset
                ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                : "border-slate-200 bg-white text-slate-600 hover:border-[#0f1a3b]/30 hover:text-[#0f1a3b]"
            }`}
            aria-label={
              pendingReset
                ? "Konfirmasi reset preferensi"
                : "Reset preferensi aplikasi"
            }
          >
            <RotateCcw className="h-4 w-4" />
            {pendingReset
              ? "Tap lagi untuk konfirmasi reset"
              : "Reset preferensi ke default"}
          </button>
        ) : null}

        <div className="flex items-center gap-2 rounded-[18px] border border-slate-200/80 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold text-slate-500">
          {isAdmin ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <KeyRound className="h-4 w-4 shrink-0 text-slate-500" />
          )}
          {isAdmin
            ? "Session admin mengikuti autentikasi yang sudah aktif."
            : isDriver
              ? "Driver hanya dapat melihat armada yang ditugaskan."
              : userProfile
                ? "Akun pengguna aktif untuk fitur publik."
                : "Sign-In diperlukan untuk membuka fitur tambahan."}
        </div>
      </div>
    </section>
  );
}
