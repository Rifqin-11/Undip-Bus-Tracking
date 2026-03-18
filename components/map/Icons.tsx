import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function BuggyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M7 8V6h10v2" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function HalteIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 3v18" />
      <path d="M12 6h7" />
      <path d="M5 10h14l-2 4H7l-2-4Z" />
      <path d="M8 18h8" />
    </svg>
  );
}

export function RouteIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M6 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
      <path d="M8 7h7a3 3 0 1 1 0 6h-2a3 3 0 1 0 0 6h3" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LoginIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M10 17V7a2 2 0 0 1 2-2h7v14h-7a2 2 0 0 1-2-2Z" />
      <path d="m3 12 4-4" />
      <path d="m3 12 4 4" />
      <path d="M7 12h8" />
    </svg>
  );
}
