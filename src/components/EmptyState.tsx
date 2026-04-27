import type { ReactNode } from "react";
import { MascotBubble } from "./MascotBubble";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  mascot?: boolean;
};

export function EmptyState({ title, description, action, mascot = false }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {mascot ? <MascotBubble /> : null}
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__description">{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
