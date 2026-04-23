import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AvatarDisplay } from "./AvatarDisplay";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import { BlockShareSheet, IncomingShareSheet } from "./EventShareSheets";
import { BlockSheet } from "./BlockSheet";
import { subscribeIncomingShares } from "../lib/blockShares";
import type { BlockOutcome, TimeBlock } from "../types";
import {
  blockEndMinutesExclusive,
  blockStartMinutes,
  defaultNewBlockRange,
} from "../lib/scheduleBlocks";
import { formatHm, minutesSinceMidnight } from "../lib/time";

const VIEW_START_MIN = 0;
const VIEW_END_MIN = 24 * 60;

function blockLayout(b: TimeBlock) {
  const s = blockStartMinutes(b);
  const e = blockEndMinutesExclusive(b);
  const viewLen = VIEW_END_MIN - VIEW_START_MIN;
  const clipS = Math.max(s, VIEW_START_MIN);
  const clipE = Math.min(e, VIEW_END_MIN);
  if (clipE <= clipS) return null;
  const top = ((clipS - VIEW_START_MIN) / viewLen) * 100;
  const height = ((clipE - clipS) / viewLen) * 100;
  return { top, height };
}

function todayLabel() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

function needsCheckIn(b: TimeBlock, nowMin: number) {
  return nowMin >= blockEndMinutesExclusive(b) && !b.outcome;
}

function isActive(b: TimeBlock, nowMin: number) {
  return nowMin >= blockStartMinutes(b) && nowMin < blockEndMinutesExclusive(b);
}

function progress01(b: TimeBlock, nowMin: number) {
  const s = blockStartMinutes(b);
  const e = blockEndMinutesExclusive(b);
  if (e <= s) return 0;
  return Math.min(1, Math.max(0, (nowMin - s) / (e - s)));
}

export function SchedulePanel() {
  const {
    blocks,
    profile,
    addBlock,
    updateBlock,
    removeBlock,
    setBlockOutcome,
    tick,
    t,
    firebaseUser,
    todayKey,
  } = useSchedule();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<
    | { kind: "add"; defaults: Omit<TimeBlock, "id"> }
    | { kind: "edit"; block: TimeBlock }
    | null
  >(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBlock, setShareBlock] = useState<TimeBlock | null>(null);
  const [incomingShareIds, setIncomingShareIds] = useState<string[]>([]);
  const [openIncomingShareId, setOpenIncomingShareId] = useState<string | null>(null);

  const nowMin = useMemo(() => minutesSinceMidnight(new Date()), [tick, blocks]);

  useEffect(() => {
    if (!firebaseUser) {
      setIncomingShareIds([]);
      return;
    }
    return subscribeIncomingShares(firebaseUser.uid, setIncomingShareIds);
  }, [firebaseUser]);

  const pending = useMemo(() => blocks.filter((b) => needsCheckIn(b, nowMin)), [blocks, nowMin]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = 0; h <= 23; h += 1) list.push(h);
    return list;
  }, []);

  const openAdd = () => {
    const d = defaultNewBlockRange(blocks);
    setSheetMode({
      kind: "add",
      defaults: {
        ...d,
        activityId: "work",
      },
    });
    setSheetOpen(true);
  };

  const openEdit = (b: TimeBlock) => {
    setSheetMode({ kind: "edit", block: b });
    setSheetOpen(true);
  };

  const openShareFromSheet = () => {
    if (sheetMode?.kind !== "edit") return;
    setShareBlock(sheetMode.block);
    setSheetOpen(false);
    setSheetMode(null);
    setShareOpen(true);
  };

  const onSave = (payload: Omit<TimeBlock, "id"> & { id?: string }) => {
    if (payload.id) {
      updateBlock(payload.id, {
        startHour: payload.startHour,
        startMinute: payload.startMinute,
        endHour: payload.endHour,
        endMinute: payload.endMinute,
        activityId: payload.activityId,
      });
    } else {
      addBlock({
        startHour: payload.startHour,
        startMinute: payload.startMinute,
        endHour: payload.endHour,
        endMinute: payload.endMinute,
        activityId: payload.activityId,
      });
    }
  };

  const mark = (id: string, outcome: BlockOutcome) => {
    setBlockOutcome(id, outcome);
  };

  return (
    <section className="schedule" aria-labelledby="sched-heading">
      <div className="schedule__intro">
        <div>
          <p className="eyebrow eyebrow--dark">{t("schedule_eyebrow")}</p>
          <h2 id="sched-heading" className="schedule__title">
            {todayLabel()}
          </h2>
          <p className="schedule__sub">{t("schedule_intro")}</p>
        </div>
        <button type="button" className="avatar-ring" aria-label={t("nav_profile")}>
          <AvatarDisplay source={profile} size="md" />
        </button>
      </div>

      {incomingShareIds.length > 0 && firebaseUser ? (
        <div className="share-inbox" role="region" aria-label={t("share_inbox_label")}>
          <p className="share-inbox__title">{t("share_inbox_title", { n: String(incomingShareIds.length) })}</p>
          <ul className="share-inbox__list">
            {incomingShareIds.map((id) => (
              <li key={id}>
                <button type="button" className="share-inbox__open" onClick={() => setOpenIncomingShareId(id)}>
                  {t("share_inbox_open")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pending.length ? (
        <div className="checkin-banner" role="region" aria-label={t("schedule_checkin_title")}>
          <p className="checkin-banner__title">{t("schedule_checkin_title")}</p>
          <p className="checkin-banner__sub">{t("schedule_checkin_sub")}</p>
          <ul className="checkin-list">
            {pending.map((b) => {
              return (
                <li key={b.id} className="checkin-row">
                  <div>
                    <p className="checkin-row__name">{t(`act_${b.activityId}_label`)}</p>
                    <p className="checkin-row__time">
                      {formatHm(b.startHour, b.startMinute)} –{" "}
                      {b.endHour === 24 && b.endMinute === 0
                        ? t("schedule_midnight")
                        : formatHm(b.endHour, b.endMinute)}
                    </p>
                  </div>
                  <div className="checkin-row__actions">
                    <button type="button" className="btn btn--sm btn--primary" onClick={() => mark(b.id, "done")}>
                      {t("schedule_done")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--outline"
                      onClick={() => mark(b.id, "not_done")}
                    >
                      {t("schedule_not_done")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="cal">
        <div className="cal__grid" aria-hidden>
          {hours.map((h) => (
            <div key={h} className="cal__hour-row">
              <span className="cal__hour-label">
                {new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(
                  new Date(2000, 0, 1, h, 0),
                )}
              </span>
              <span className="cal__hour-line" />
            </div>
          ))}
        </div>

        <div className="cal__blocks">
          <span className="cal__now-line" style={{ top: `${(nowMin / (24 * 60)) * 100}%` }} aria-hidden />
          {blocks.length === 0 ? (
            <div className="cal__empty">
              <p className="cal__empty-title">{t("schedule_empty_title")}</p>
              <p className="cal__empty-text">{t("schedule_empty_text")}</p>
            </div>
          ) : null}
          {blocks.map((b) => {
            const layout = blockLayout(b);
            if (!layout) return null;
            const active = isActive(b, nowMin);
            const past = nowMin >= blockEndMinutesExclusive(b);
            const pct = active ? progress01(b, nowMin) * 100 : past ? 100 : 0;
            const pendingFlag = needsCheckIn(b, nowMin);
            return (
              <button
                key={b.id}
                type="button"
                className={`cal__block ${active ? "cal__block--active" : ""} ${past ? "cal__block--past" : ""} ${pendingFlag ? "cal__block--pending" : ""}`}
                style={{ top: `${layout.top}%`, height: `${Math.max(layout.height, 3)}%` }}
                onClick={() => openEdit(b)}
              >
                {active ? <div className="cal__block-progress" style={{ height: `${pct}%` }} /> : null}
                <span className="cal__block-icon" aria-hidden>
                  <ActivityIcon id={b.activityId} size={18} />
                </span>
                <span className="cal__block-text">
                  <span className="cal__block-name">{t(`act_${b.activityId}_label`)}</span>
                  <span className="cal__block-time">
                    {formatHm(b.startHour, b.startMinute)} –{" "}
                    {b.endHour === 24 && b.endMinute === 0
                      ? t("schedule_midnight")
                      : formatHm(b.endHour, b.endMinute)}
                  </span>
                  {b.outcome === "done" ? (
                    <span className="cal__badge cal__badge--done">{t("schedule_badge_done")}</span>
                  ) : null}
                  {b.outcome === "not_done" ? (
                    <span className="cal__badge cal__badge--miss">{t("schedule_badge_missed")}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" className="fab" onClick={openAdd} aria-label={t("schedule_add_block_a11y")}>
        <Plus size={26} strokeWidth={2.25} />
      </button>

      <BlockSheet
        open={sheetOpen}
        mode={sheetMode}
        allBlocks={blocks}
        onClose={() => {
          setSheetOpen(false);
          setSheetMode(null);
        }}
        onSave={onSave}
        onDelete={removeBlock}
        onShare={firebaseUser ? openShareFromSheet : undefined}
      />

      <BlockShareSheet
        open={shareOpen}
        block={shareBlock}
        dayKey={todayKey}
        onClose={() => {
          setShareOpen(false);
          setShareBlock(null);
        }}
      />

      {openIncomingShareId ? (
        <IncomingShareSheet
          shareId={openIncomingShareId}
          onClose={() => setOpenIncomingShareId(null)}
        />
      ) : null}
    </section>
  );
}
