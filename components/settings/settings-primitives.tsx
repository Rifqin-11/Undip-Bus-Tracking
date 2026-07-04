"use client";

export const settingCardClass =
  "flex items-center justify-between gap-3 rounded-[20px] border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]";

export function ToggleSwitch({
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
