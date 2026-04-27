import { AvatarDisplay } from "./AvatarDisplay";
import type { AvatarFields } from "../types";

type StoryBubbleProps = {
  name: string;
  active?: boolean;
  onClick?: () => void;
  avatar: AvatarFields;
  /** "You" bubble with a small + badge (e.g. add story). */
  showAddBadge?: boolean;
};

export function StoryBubble({ name, active = false, onClick, avatar, showAddBadge = false }: StoryBubbleProps) {
  return (
    <button
      type="button"
      className={`story-bubble${active ? " story-bubble--active" : ""}${
        showAddBadge ? " story-bubble--you-plus" : ""
      }`}
      onClick={onClick}
      aria-label={showAddBadge ? "Your story, add a photo" : `Open ${name}'s story`}
    >
      <span className="story-bubble__avatar">
        <AvatarDisplay source={avatar} size="md" />
        {showAddBadge ? (
          <span className="story-bubble__plus" aria-hidden>
            +
          </span>
        ) : null}
      </span>
      <span className="story-bubble__name">{name}</span>
    </button>
  );
}
