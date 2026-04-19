import { CalendarDays, UserRound, Zap } from "lucide-react";

export type TabId = "schedule" | "pulse" | "me";

type Props = {
  tab: TabId;
  onChange: (t: TabId) => void;
};

const items: { id: TabId; label: string; Icon: typeof CalendarDays }[] = [
  { id: "schedule", label: "Day", Icon: CalendarDays },
  { id: "pulse", label: "Now", Icon: Zap },
  { id: "me", label: "Me", Icon: UserRound },
];

export function BottomNav({ tab, onChange }: Props) {
  return (
    <nav className="nav" aria-label="Primary">
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`nav__btn ${tab === id ? "nav__btn--on" : ""}`}
          onClick={() => onChange(id)}
          aria-current={tab === id ? "page" : undefined}
        >
          <Icon size={22} strokeWidth={2} className="nav__icon" aria-hidden />
          <span className="nav__label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
