import { CalendarPlus, Compass, Home, UserRound, type LucideIcon } from "lucide-react";

export type TabId = "social" | "build" | "discover" | "profile";

type Props = {
  tab: TabId;
  onChange: (t: TabId) => void;
  labels: Record<TabId, string>;
  /** Shown on You tab when follow requests need attention. */
  profileRequestCount?: number;
};

const items: { id: TabId; Icon: LucideIcon }[] = [
  { id: "social", Icon: Home },
  { id: "build", Icon: CalendarPlus },
  { id: "discover", Icon: Compass },
  { id: "profile", Icon: UserRound },
];

export function BottomNav({
  tab,
  onChange,
  labels,
  profileRequestCount = 0,
}: Props) {
  return (
    <nav className="nav nav--four" aria-label="Primary">
      {items.map(({ id, Icon }) => {
        const label = labels[id];
        const reqProfile = id === "profile" && profileRequestCount > 0;
        return (
          <button
            key={id}
            type="button"
            className={`nav__btn ${tab === id ? "nav__btn--on" : ""}`}
            onClick={() => onChange(id)}
            aria-current={tab === id ? "page" : undefined}
          >
            <span className="nav__icon-wrap">
              <Icon size={20} strokeWidth={2} className="nav__icon" aria-hidden />
              {reqProfile ? (
                <span className="nav__badge" aria-hidden>
                  {profileRequestCount > 9
                    ? "9+"
                    : String(profileRequestCount)}
                </span>
              ) : null}
            </span>
            <span className="nav__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
