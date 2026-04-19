import type { LucideIcon } from "lucide-react";
import { Bird, Bug, Cat, Dog, Fish, Rabbit, Rat, Shell, Squirrel, Turtle } from "lucide-react";

export type AnimalAvatarId =
  | "bird"
  | "cat"
  | "dog"
  | "fish"
  | "rabbit"
  | "rat"
  | "turtle"
  | "squirrel"
  | "shell"
  | "bug";

export type AnimalAvatar = {
  id: AnimalAvatarId;
  label: string;
  Icon: LucideIcon;
};

/** Minimal outline animals — same stroke language as the rest of the app */
export const ANIMAL_AVATARS: AnimalAvatar[] = [
  { id: "bird", label: "Bird", Icon: Bird },
  { id: "cat", label: "Cat", Icon: Cat },
  { id: "dog", label: "Dog", Icon: Dog },
  { id: "fish", label: "Fish", Icon: Fish },
  { id: "rabbit", label: "Rabbit", Icon: Rabbit },
  { id: "rat", label: "Rat", Icon: Rat },
  { id: "turtle", label: "Turtle", Icon: Turtle },
  { id: "squirrel", label: "Squirrel", Icon: Squirrel },
  { id: "shell", label: "Shell", Icon: Shell },
  { id: "bug", label: "Bug", Icon: Bug },
];

export function animalById(id: string | null | undefined): AnimalAvatar | undefined {
  if (!id) return undefined;
  return ANIMAL_AVATARS.find((a) => a.id === id);
}
