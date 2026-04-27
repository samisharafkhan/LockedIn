import type { ButtonHTMLAttributes, ReactNode } from "react";

type PillButtonVariant = "primary" | "secondary" | "ghost";

type PillButtonProps = {
  children: ReactNode;
  variant?: PillButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function PillButton({ children, variant = "secondary", className, ...props }: PillButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`pill-btn pill-btn--${variant}${className ? ` ${className}` : ""}`}
    >
      {children}
    </button>
  );
}
