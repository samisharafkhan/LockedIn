import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = {
  icon: ReactNode;
  "aria-label": string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function IconButton({ icon, className, ...props }: IconButtonProps) {
  return (
    <button type="button" {...props} className={`icon-pill-btn${className ? ` ${className}` : ""}`}>
      {icon}
    </button>
  );
}
