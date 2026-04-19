import { CalendarPlus, Sparkles, UserRound, Users } from "lucide-react";

export type TabId = "build" | "friends" | "stars" | "profile";

type Props = {
  tab: TabId;
  onChange: (t: TabId) => void;
};

const items: { id: TabId; label: string; Icon: typeof CalendarPlus }[] = [
  { id: "build", label: "Build", Icon: CalendarPlus },
  { id: "friends", label: "Friends", Icon: Users },
  { id: "stars", label: "Stars", Icon: Sparkles },
  { id: "profile", label: "You", Icon: UserRound },
];

export function BottomNav({ tab, onChange }: Props) {
  return (
    <nav className="nav nav--four" aria-label="Primary">
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`nav__btn ${tab === id ? "nav__btn--on" : ""}`}
          onClick={() => onChange(id)}
          aria-current={tab === id ? "page" : undefined}
        >
          <Icon size={20} strokeWidth={2} className="nav__icon" aria-hidden />
          <span className="nav__label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
