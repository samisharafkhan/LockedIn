import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { AvatarDisplay } from "./AvatarDisplay";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import { blockEndMinutesExclusive, blockStartMinutes } from "../lib/scheduleBlocks";
import { formatMinRange, overlapSegments } from "../lib/overlap";
import { minutesSinceMidnight } from "../lib/time";

export function CelebritiesPanel() {
  const { celebrities, blocks, profile, t } = useSchedule();
  const [id, setId] = useState(celebrities[0]?.id ?? "");

  const celeb = useMemo(() => celebrities.find((c) => c.id === id) ?? celebrities[0], [id, celebrities]);
  const nowMin = minutesSinceMidnight(new Date());
  const segs = useMemo(
    () => (celeb ? overlapSegments(blocks, celeb.blocks) : []),
    [blocks, celeb],
  );
  const both = segs.filter((s) => s.mine && s.theirs);
  const mineNow = blocks.find((b) => {
    const s = blockStartMinutes(b);
    const e = blockEndMinutesExclusive(b);
    return nowMin >= s && nowMin < e;
  });
  const theirsNow = celeb?.blocks.find((b) => {
    const s = blockStartMinutes(b);
    const e = blockEndMinutesExclusive(b);
    return nowMin >= s && nowMin < e;
  });

  if (!celeb) return null;

  return (
    <section className="stars" aria-labelledby="stars-heading">
      <div className="stars__head">
        <div>
          <p className="eyebrow eyebrow--dark">{t("stars_eyebrow")}</p>
          <h2 id="stars-heading" className="stars__title">
            {t("stars_title")}
          </h2>
          <p className="stars__banner">
            <Sparkles size={16} strokeWidth={2} aria-hidden />
            {t("stars_banner")}
          </p>
        </div>
        <div className="avatar-ring" aria-hidden>
          <AvatarDisplay source={profile} size="md" />
        </div>
      </div>

      <div className="seg-tabs" role="tablist" aria-label="Public figure">
        {celebrities.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`seg-tab ${c.id === celeb.id ? "seg-tab--on" : ""}`}
            onClick={() => setId(c.id)}
            aria-pressed={c.id === celeb.id}
          >
            {c.name.replace(" (archetype)", "")}
          </button>
        ))}
      </div>

      <article className="stars__card">
        <h3 className="stars__name">{celeb.name}</h3>
        <p className="stars__tag">{celeb.tagline}</p>
        <p className="stars__note">{celeb.note}</p>
        <div className="stars__now">
          <div>
            <p className="stars__now-label">{t("stars_now_you")}</p>
            <p className="stars__now-value">
              {mineNow ? t(`act_${mineNow.activityId}_label`) : t("stars_no_block")}
            </p>
          </div>
          <div>
            <p className="stars__now-label">{t("stars_now_their")}</p>
            <p className="stars__now-value">
              {theirsNow ? t(`act_${theirsNow.activityId}_label`) : t("stars_off_template")}
            </p>
          </div>
        </div>
      </article>

      <div className="overlap-list">
        <h4 className="overlap-list__title">{t("stars_overlap_title")}</h4>
        <ul>
          {both.map((s, i) => (
            <li key={`${s.startMin}-${i}`}>
              <span className="overlap-pill overlap-pill--soft">{t("stars_overlap_label")}</span>
              <span className="overlap-range">{formatMinRange(s.startMin, s.endMin)}</span>
            </li>
          ))}
        </ul>
        {both.length === 0 ? (
          <p className="friends__muted">{t("stars_overlap_none")}</p>
        ) : null}
      </div>

      <ol className="stars__timeline">
        {celeb.blocks.map((b) => {
          return (
            <li key={b.id} className="stars__tl-item">
              <span className="stars__tl-icon" aria-hidden>
                <ActivityIcon id={b.activityId} size={18} />
              </span>
              <div>
                <p className="stars__tl-label">{t(`act_${b.activityId}_label`)}</p>
                <p className="stars__tl-time">
                  {formatMinRange(blockStartMinutes(b), blockEndMinutesExclusive(b))}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
