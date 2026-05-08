"use client";

import { useState } from "react";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
};

export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const inputId = label.toLowerCase().replaceAll(" ", "-");

  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
      </span>
      <div className="relative">
        <input
          id={inputId}
          type={isVisible ? "text" : "password"}
          className="h-11 w-full rounded-2xl border border-slate-300/80 bg-white/90 px-3.5 pr-11 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a4f8e] focus:ring-3 focus:ring-[#2a4f8e]/15"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
          aria-pressed={isVisible}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
        >
          {isVisible ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4.5 w-4.5"
            >
              <path d="M3 3l18 18" />
              <path d="M10.58 10.58a2 2 0 0 0 2.84 2.84" />
              <path d="M9.88 4.24A10.6 10.6 0 0 1 12 4c5 0 8.5 4 10 8a13.4 13.4 0 0 1-2.16 3.43" />
              <path d="M6.61 6.61A13.2 13.2 0 0 0 2 12c1.5 4 5 8 10 8a10.8 10.8 0 0 0 4.04-.78" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4.5 w-4.5"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}
