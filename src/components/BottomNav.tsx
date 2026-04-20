import { CalendarPlus, Sparkles, UserRound, Users } from "lucide-react";

export type TabId = "build" | "friends" | "stars" | "profile";

type Props = {
  tab: TabId;
  onChange: (t: TabId) => void;
  labels: Record<TabId, string>;
};

const items: { id: TabId; Icon: typeof CalendarPlus }[] = [
  { id: "build", Icon: CalendarPlus },
  { id: "friends", Icon: Users },
  { id: "stars", Icon: Sparkles },
  { id: "profile", Icon: UserRound },
];

export function BottomNav({ tab, onChange, labels }: Props) {
  return (
    <nav className="nav nav--four" aria-label="Primary">
      {items.map(({ id, Icon }) => {
        const label = labels[id];
        return (
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
        );
      })}
    </nav>
  );
}
