import { AvatarDisplay } from "./AvatarDisplay";
import type { AvatarFields } from "../types";

type FriendRowProps = {
  name: string;
  handle: string;
  status: string;
  avatar: AvatarFields;
  indicator?: "green" | "yellow" | "none";
  onClick?: () => void;
  actionLabel?: string;
};

export function FriendRow({
  name,
  handle,
  status,
  avatar,
  indicator = "green",
  onClick,
  actionLabel,
}: FriendRowProps) {
  return (
    <button type="button" className="friend-row" onClick={onClick} aria-label={`View ${name}`}>
      <span className="friend-row__avatar">
        <AvatarDisplay source={avatar} size="md" />
      </span>
      <span className="friend-row__body">
        <span className="friend-row__name">{name}</span>
        <span className="friend-row__meta">@{handle}</span>
        <span className="friend-row__status">{status}</span>
      </span>
      {actionLabel ? <span className="friend-row__action">{actionLabel}</span> : null}
      {indicator !== "none" ? (
        <span
          className={`friend-row__dot friend-row__dot--${indicator}`}
          aria-hidden
        />
      ) : null}
    </button>
  );
}
