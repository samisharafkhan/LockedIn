import { AvatarDisplay } from "./AvatarDisplay";
import type { Profile } from "../types";

type TopHeaderProps = {
  title: string;
  subtitle: string;
  profile: Profile;
  onAvatarClick?: () => void;
};

export function TopHeader({ title, subtitle, profile, onAvatarClick }: TopHeaderProps) {
  const avatarNode = (
    <div className="top-header__avatar-wrap" aria-hidden>
      <AvatarDisplay source={profile} size="sm" />
    </div>
  );
  return (
    <header className="top-header">
      <div>
        <p className="top-header__brand">{title}</p>
        <p className="top-header__subtitle">{subtitle}</p>
      </div>
      <div className="top-header__user">
        {profile.avatarImageDataUrl && onAvatarClick ? (
          <button
            type="button"
            className="top-header__avatar-hit"
            onClick={onAvatarClick}
            aria-label="Open profile image"
          >
            {avatarNode}
          </button>
        ) : (
          avatarNode
        )}
        <div>
          <p className="top-header__name">{profile.displayName}</p>
          <p className="top-header__handle">@{profile.handle}</p>
        </div>
      </div>
    </header>
  );
}
