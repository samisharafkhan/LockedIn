import type { ReactNode } from "react";

type SoftCardProps = {
  children: ReactNode;
  className?: string;
};

export function SoftCard({ children, className }: SoftCardProps) {
  return <section className={`soft-card${className ? ` ${className}` : ""}`}>{children}</section>;
}
