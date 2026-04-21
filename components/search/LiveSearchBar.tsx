import { useState, useRef, useEffect } from "react";
import { HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import {
  XIcon,
  SearchIcon,
  SpinnerIcon,
  ArrowRightIcon,
  MapPinIcon,
} from "@/components/ui/Icons";

type LiveSearchBarProps = {
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onSubmit: () => void;
  showOriginField: boolean;
  onBackToDestination: () => void;
  panelOpen: boolean;
  isSearching?: boolean;
  mobileTopClass?: string;
};

export function LiveSearchBar({
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  onSubmit,
  showOriginField,
  onBackToDestination,
  panelOpen,
  isSearching = false,
  mobileTopClass = "top-10",
}: LiveSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [focusedField, setFocusedField] = useState<"from" | "to" | null>(null);
  const wrapperRef = useRef<HTMLFormElement>(null);

  const currentInput = focusedField === "from" ? fromValue : toValue;
  const trimmed = currentInput.trim().toLowerCase();
  const suggestions = trimmed
    ? HALTE_LOCATIONS.filter((h) =>
        h.name.toLowerCase().includes(trimmed),
      ).slice(0, 6)
    : [];

  const showDropdown = isFocused && suggestions.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
        setFocusedField(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (name: string) => {
    if (focusedField === "from") {
      onFromChange(name);
    } else {
      onToChange(name);
    }
    setIsFocused(false);
    setFocusedField(null);
  };

  return (
    <form
      ref={wrapperRef}
      className={`absolute left-1/2 ${mobileTopClass} z-40 w-[min(92vw,420px)] -translate-x-1/2 xl:translate-x-0 xl:top-4 ${
        panelOpen
          ? "xl:left-[calc(1rem+4.5rem+1rem+25rem+1rem)]"
          : "xl:left-[calc(1rem+4.5rem+1rem)]"
      }`}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
        setIsFocused(false);
      }}
    >
      <div
        className={`rounded-4xl border border-white/50 bg-white/70 shadow-[0_8px_32px_rgba(15,23,42,0.1)] backdrop-blur-xl transition-all duration-200 ${isFocused ? "border-slate-300/60 bg-white/85 shadow-[0_8px_32px_rgba(15,23,42,0.16)]" : ""}`}
      >
        {/* Origin field (shown after destination is entered) */}
        {showOriginField && (
          <div className="flex items-center gap-2 border-b border-slate-200/50 px-3 py-2">
            <div className="grid h-5 w-5 shrink-0 place-items-center">
              <div className="h-2.5 w-2.5 rounded-full border-2 border-blue-500 bg-white" />
            </div>
            <input
              className="h-8 w-full bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="Dari mana? (cth: Geologi)"
              aria-label="Dari lokasi asal"
              value={fromValue}
              onChange={(e) => onFromChange(e.target.value)}
              onFocus={() => {
                setIsFocused(true);
                setFocusedField("from");
              }}
            />
            <button
              type="button"
              onClick={onBackToDestination}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Ubah tujuan"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Destination field */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="grid h-5 w-5 shrink-0 place-items-center">
            {showOriginField ? (
              <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            ) : (
              <SearchIcon className="h-4 w-4 text-slate-400" />
            )}
          </div>
          <input
            className="h-8 w-full bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Ke mana? (cth: Hukum)"
            aria-label="Ke lokasi tujuan"
            value={toValue}
            onChange={(e) => onToChange(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setFocusedField("to");
            }}
          />

          {/* Submit / loading button */}
          <button
            type="submit"
            disabled={isSearching}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0f1a3b] text-white transition active:bg-[#1a2f68] disabled:opacity-50 xl:hover:bg-[#1a2f68]"
            aria-label={showOriginField ? "Cari rute" : "Cari tujuan"}
          >
            {isSearching ? (
              <SpinnerIcon className="h-4 w-4" />
            ) : (
              <ArrowRightIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showDropdown && (
        <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/50 bg-white/80 shadow-[0_12px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          {suggestions.map((halte) => (
            <button
              key={halte.id}
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-slate-50/80"
              onClick={() => handleSuggestionClick(halte.name)}
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
                <MapPinIcon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-800">
                  {halte.name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
