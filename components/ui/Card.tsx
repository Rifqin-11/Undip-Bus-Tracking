import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  active?: boolean;
};

export function Card({
  children,
  active = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        active
          ? "border-blue-500/50 bg-blue-950/40 shadow-lg shadow-blue-900/10"
          : "border-white/6 bg-white/4 hover:border-white/12 hover:bg-white/6"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
