import { animalById } from "../data/avatarAnimals";
import type { AvatarFields } from "../types";

type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  sm: "avatar-display--sm",
  md: "avatar-display--md",
  lg: "avatar-display--lg",
};

type Props = {
  source: AvatarFields;
  size?: Size;
  className?: string;
};

export function AvatarDisplay({ source, size = "md", className = "" }: Props) {
  const base = `avatar-display ${sizeClass[size]} ${className}`.trim();

  if (source.avatarImageDataUrl) {
    return (
      <img
        src={source.avatarImageDataUrl}
        alt=""
        className={`${base} avatar-display--img`.trim()}
      />
    );
  }

  const animal = animalById(source.avatarAnimalId ?? undefined);
  if (animal) {
    const Icon = animal.Icon;
    return (
      <span className={`${base} avatar-display--icon`.trim()} aria-hidden>
        <Icon size={size === "lg" ? 34 : size === "sm" ? 18 : 22} strokeWidth={2} />
      </span>
    );
  }

  return (
    <span className={`${base} avatar-display--emoji`.trim()} aria-hidden>
      {source.avatarEmoji}
    </span>
  );
}
