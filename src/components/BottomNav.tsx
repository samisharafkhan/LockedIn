import { CalendarPlus, Compass, UserRound, Users } from "lucide-react";

export type TabId = "build" | "friends" | "discover" | "profile";

type Props = {
  tab: TabId;
  onChange: (t: TabId) => void;
  labels: Record<TabId, string>;
  /** Shown on Friends tab when follow requests need attention. */
  friendsRequestCount?: number;
  /** Shown on You tab when follow requests need attention. */
  profileRequestCount?: number;
};

const items: { id: TabId; Icon: typeof CalendarPlus }[] = [
  { id: "build", Icon: CalendarPlus },
  { id: "friends", Icon: Users },
  { id: "discover", Icon: Compass },
  { id: "profile", Icon: UserRound },
];

export function BottomNav({
  tab,
  onChange,
  labels,
  friendsRequestCount = 0,
  profileRequestCount = 0,
}: Props) {
  return (
    <nav className="nav nav--four" aria-label="Primary">
      {items.map(({ id, Icon }) => {
        const label = labels[id];
        const reqFriends = id === "friends" && friendsRequestCount > 0;
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
              {reqFriends || reqProfile ? (
                <span className="nav__badge" aria-hidden>
                  {(reqFriends ? friendsRequestCount : profileRequestCount) > 9
                    ? "9+"
                    : String(reqFriends ? friendsRequestCount : profileRequestCount)}
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
