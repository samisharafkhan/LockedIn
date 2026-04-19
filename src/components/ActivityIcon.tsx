import {
  BookOpen,
  Brain,
  Briefcase,
  Bus,
  Dumbbell,
  Moon,
  Plane,
  Sofa,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ActivityId } from "../types";

const ICONS: Record<ActivityId, LucideIcon> = {
  focus: Brain,
  class: BookOpen,
  work: Briefcase,
  gym: Dumbbell,
  commute: Bus,
  chill: Sofa,
  sleep: Moon,
  travel: Plane,
  social: Users,
};

type Props = {
  id: ActivityId;
  size?: number;
  className?: string;
};

export function ActivityIcon({ id, size = 22, className }: Props) {
  const Icon = ICONS[id] ?? Brain;
  return <Icon size={size} strokeWidth={2} className={className} aria-hidden />;
}
