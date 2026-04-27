import { useMemo } from "react";
import { ChevronRight, Pin } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";
import { dominantActivityForDay } from "../lib/weekStats";
import { ActivityIcon } from "./ActivityIcon";
import { AvatarDisplay } from "./AvatarDisplay";
import { storedToTimeBlock } from "./ProfilePostUtils";
import type { SchedulePostDoc } from "../lib/schedulePosts";
import type { Profile } from "../types";

type Props = {
  data: SchedulePostDoc;
  onOpen: () => void;
  /** Feed shows author line; "profile" is your own row (label variant). */
  variant: "feed" | "profile";
  className?: string;
};

/**
 * Horizontal card: poster avatar, dominant activity for that day, metadata.
 */
export function SchedulePostHCard({ data, onOpen, variant, className = "" }: Props) {
  const { t } = useSchedule();
  const { dom, hoursLabel, avatarSource } = useMemo(() => {
    const blocks = data.blocks.map(storedToTimeBlock);
    const d = dominantActivityForDay(blocks);
    const h = !d
      ? "0h"
      : d.hours < 0.1
        ? "0h"
        : (() => {
            const r = Math.round(d.hours * 10) / 10;
            return Number.isInteger(r) ? `${r}h` : `${r}h`;
          })();
    const av = {
      displayName: data.displayName,
      handle: data.handle,
      avatarEmoji: data.avatarEmoji ?? "○",
      avatarImageDataUrl: data.avatarImageDataUrl ?? null,
      avatarAnimalId: data.avatarAnimalId ?? null,
    } as Profile;
    return { dom: d, hoursLabel: h, avatarSource: av };
  }, [data]);

  const actLabel = dom ? t(`act_${dom.activityId}_label`) : "—";
  return (
    <button
      type="button"
      className={`post-hcard glass-panel ${className}`.trim()}
      onClick={onOpen}
      aria-label={t("post_hcard_a11y", { name: data.displayName, day: data.dayKey, act: actLabel })}
    >
      <span className="post-hcard__avatar" aria-hidden>
        <AvatarDisplay source={avatarSource} size="md" />
      </span>
      <span className="post-hcard__body">
        {variant === "feed" ? (
          <span className="post-hcard__kicker">
            <span className="post-hcard__name">{data.displayName}</span>
            <span className="post-hcard__handle">@{data.handle}</span>
          </span>
        ) : (
          <span className="post-hcard__kicker post-hcard__kicker--me">{t("post_hcard_mine")}</span>
        )}
        <span className="post-hcard__title">
          {data.pinned ? (
            <Pin size={16} strokeWidth={2} className="post-hcard__pin" aria-label={t("post_pinned_badge")} />
          ) : null}
          {dom ? <ActivityIcon id={dom.activityId} size={22} className="post-hcard__act-ico" /> : null}
          <span className="post-hcard__act-label">{actLabel}</span>
          <span className="post-hcard__top-h">{t("post_top_badge", { h: hoursLabel })}</span>
        </span>
        <span className="post-hcard__sub">{data.dayKey}</span>
      </span>
      <ChevronRight size={20} strokeWidth={2} className="post-hcard__chev" aria-hidden />
    </button>
  );
}
