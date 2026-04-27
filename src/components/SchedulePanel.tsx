import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Printer, Send, Sparkles } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";
import { BlockShareSheet, IncomingShareSheet } from "./EventShareSheets";
import { BlockSheet } from "./BlockSheet";
import { AiDaySheet } from "./AiDaySheet";
import { IconButton } from "./IconButton";
import { PillButton } from "./PillButton";
import { ScheduleTimeline } from "./ScheduleTimeline";
import { SectionHeader } from "./SectionHeader";
import { SoftCard } from "./SoftCard";
import { subscribeIncomingShares } from "../lib/blockShares";
import type { BlockOutcome, TimeBlock } from "../types";
import {
  blockEndMinutesExclusive,
  blockStartMinutes,
  defaultNewBlockRange,
} from "../lib/scheduleBlocks";
import { layoutDayBlocks } from "../lib/calendarLayout";
import { createSchedulePost } from "../lib/schedulePosts";
import { timeBlockToStored } from "../lib/storage";
import { getFirestoreDb } from "../lib/firebaseApp";
import { formatHm, minutesSinceMidnight } from "../lib/time";
import { loadMePrefs } from "../lib/mePrefs";
import { createIncomingNotification } from "../lib/socialNotifications";

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

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function activityTone(activityId: TimeBlock["activityId"]): "sage" | "blue" | "purple" | "butter" | "beige" {
  if (activityId === "work" || activityId === "focus" || activityId === "class") return "beige";
  if (activityId === "social" || activityId === "chill") return "purple";
  if (activityId === "gym" || activityId === "commute") return "blue";
  if (activityId === "travel") return "butter";
  return "sage";
}

export function SchedulePanel() {
  const {
    blocks,
    profile,
    scheduleByDay,
    addBlock,
    updateBlock,
    removeBlock,
    setBlockOutcome,
    tick,
    t,
    firebaseUser,
    todayKey,
    mergeBlockIntoDay,
  } = useSchedule();
  const [postBusy, setPostBusy] = useState(false);
  const [postHint, setPostHint] = useState<string | null>(null);
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
  const [aiOpen, setAiOpen] = useState(false);
  const remindedRef = useRef(new Set<string>());

  const nowMin = useMemo(() => minutesSinceMidnight(new Date()), [tick, blocks]);
  const dayLayouts = useMemo(() => layoutDayBlocks(blocks), [blocks]);

  useEffect(() => {
    if (!firebaseUser) {
      setIncomingShareIds([]);
      return;
    }
    return subscribeIncomingShares(firebaseUser.uid, setIncomingShareIds);
  }, [firebaseUser]);

  const pending = useMemo(() => blocks.filter((b) => needsCheckIn(b, nowMin)), [blocks, nowMin]);

  useEffect(() => {
    const prefs = loadMePrefs();
    if (!prefs.blockReminders) return;
    const upcoming = blocks
      .map((b) => ({ b, startsIn: blockStartMinutes(b) - nowMin }))
      .filter((x) => x.startsIn > 0 && x.startsIn <= 10)
      .sort((a, b) => a.startsIn - b.startsIn)[0];
    if (!upcoming) return;
    const reminderKey = `${todayKey}:${upcoming.b.id}`;
    if (remindedRef.current.has(reminderKey)) return;
    remindedRef.current.add(reminderKey);
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") {
        new Notification(t("schedule_reminder_title"), {
          body: t("schedule_reminder_body", {
            act: t(`act_${upcoming.b.activityId}_label`),
            min: String(upcoming.startsIn),
          }),
        });
      } else if (Notification.permission !== "denied") {
        void Notification.requestPermission();
      }
    }
    const db = getFirestoreDb();
    if (db && firebaseUser) {
      void createIncomingNotification(db, {
        toUid: firebaseUser.uid,
        actorUid: firebaseUser.uid,
        type: "block_reminder",
        message: t("schedule_reminder_body", {
          act: t(`act_${upcoming.b.activityId}_label`),
          min: String(upcoming.startsIn),
        }),
      }).catch(() => {});
    }
  }, [blocks, nowMin, t, todayKey, firebaseUser]);

  const timelineBlocks = useMemo(() => {
    const startMin = 8 * 60;
    const endMin = 22 * 60;
    const range = endMin - startMin;
    return blocks
      .map((b) => {
        const layout = dayLayouts.get(b.id);
        const from = blockStartMinutes(b);
        const to = blockEndMinutesExclusive(b);
        const clippedStart = Math.max(startMin, Math.min(from, endMin));
        const clippedEnd = Math.max(startMin, Math.min(to, endMin));
        const normalizedStart = clamp01((clippedStart - startMin) / range) * 100;
        const normalizedHeight = clamp01((clippedEnd - clippedStart) / range) * 100;
        return {
          id: b.id,
          activityId: b.activityId,
          label: t(`act_${b.activityId}_label`),
          timeLabel: `${formatHm(b.startHour, b.startMinute)} - ${
            b.endHour === 24 && b.endMinute === 0 ? t("schedule_midnight") : formatHm(b.endHour, b.endMinute)
          }`,
          topPct: normalizedStart,
          heightPct: normalizedHeight,
          leftPct: layout?.leftPct ?? 0,
          widthPct: layout?.widthPct ?? 100,
          tone: activityTone(b.activityId),
          rightTag: b.outcome === "done" ? "Done" : b.outcome === "not_done" ? "Missed" : undefined,
        };
      })
      .filter((b) => b.heightPct > 0);
  }, [blocks, t, dayLayouts]);

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

  const onSave = (
    payload: Omit<TimeBlock, "id"> & {
      id?: string;
      repeatMode?: "none" | "daily" | "weekdays" | "weekends";
      repeatWeeks?: number;
    },
  ) => {
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
      const repeatMode = payload.repeatMode ?? "none";
      const repeatWeeks = Math.max(1, Math.min(12, payload.repeatWeeks ?? 1));
      if (repeatMode !== "none") {
        const base = new Date(`${todayKey}T12:00:00`);
        const dayCount = repeatWeeks * 7;
        for (let i = 1; i < dayCount; i += 1) {
          const d = new Date(base);
          d.setDate(base.getDate() + i);
          const weekday = d.getDay();
          const isWeekday = weekday >= 1 && weekday <= 5;
          const ok =
            repeatMode === "daily" ||
            (repeatMode === "weekdays" && isWeekday) ||
            (repeatMode === "weekends" && !isWeekday);
          if (!ok) continue;
          const key = d.toISOString().slice(0, 10);
          mergeBlockIntoDay(key, {
            id: `r-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 7)}`,
            startHour: payload.startHour,
            startMinute: payload.startMinute,
            endHour: payload.endHour,
            endMinute: payload.endMinute,
            activityId: payload.activityId,
          });
        }
      }
    }
  };

  const mark = (id: string, outcome: BlockOutcome) => {
    setBlockOutcome(id, outcome);
  };

  const printCalendar = () => {
    window.setTimeout(() => window.print(), 100);
  };

  const postTodayToProfile = async () => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser) {
      setPostHint(t("build_post_need_signin"));
      return;
    }
    const list = scheduleByDay[todayKey] ?? [];
    if (list.length === 0) {
      setPostHint(t("build_post_empty"));
      return;
    }
    setPostBusy(true);
    setPostHint(null);
    try {
      await createSchedulePost(db, {
        ownerUid: firebaseUser.uid,
        dayKey: todayKey,
        blocks: list.map(timeBlockToStored),
        displayName: (profile.displayName ?? "").toString().trim() || "User",
        handle: (profile.handle ?? "").toString().trim() || "user",
        avatarEmoji: profile.avatarEmoji ?? "○",
        avatarImageDataUrl: profile.avatarImageDataUrl ?? null,
        avatarAnimalId: profile.avatarAnimalId ?? null,
      });
      setPostHint(t("build_post_done"));
    } catch (e) {
      console.error("[LockedIn] createSchedulePost:", e);
      const code = typeof e === "object" && e && "code" in e ? String((e as { code: string }).code) : "";
      if (code === "permission-denied") {
        setPostHint(t("build_post_err_permission"));
      } else {
        setPostHint(t("err_generic"));
      }
    } finally {
      setPostBusy(false);
    }
  };

  return (
    <section className="schedule-panel" aria-labelledby="sched-heading">
      <SoftCard className="schedule-panel__card">
        <SectionHeader
          id="sched-heading"
          eyebrow="BUILD"
          title={todayLabel()}
          subtitle="Stack your day with blocks."
        />
        <div className="schedule-panel__actions">
          {firebaseUser ? (
            <PillButton variant="secondary" disabled={postBusy} onClick={() => void postTodayToProfile()}>
              <Send size={15} strokeWidth={2} aria-hidden />
              {postBusy ? t("build_posting") : "Post day"}
            </PillButton>
          ) : null}
          <PillButton variant="secondary" onClick={printCalendar}>
            <Printer size={15} strokeWidth={2} aria-hidden />
            Save PDF
          </PillButton>
        </div>
        {postHint ? <p className="schedule-panel__hint">{postHint}</p> : null}
      </SoftCard>

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

      <ScheduleTimeline
        blocks={timelineBlocks}
        onOpenBlock={(id) => {
          const target = blocks.find((b) => b.id === id);
          if (target) openEdit(target);
        }}
        emptyTitle="Nothing here yet"
        emptyDescription="Tap + to add your first block."
      />

      <div className="fab-group" aria-label={t("build_fab_group_a11y")}>
        <IconButton
          icon={<Sparkles size={18} strokeWidth={2.1} />}
          className="fab fab--secondary fab--secondary-subtle"
          onClick={() => setAiOpen(true)}
          aria-label={t("build_ai_a11y")}
        />
        <IconButton
          icon={<Plus size={22} strokeWidth={2.25} />}
          className="fab fab--primary"
          onClick={openAdd}
          aria-label={t("schedule_add_block_a11y")}
        />
      </div>

      <AiDaySheet open={aiOpen} onClose={() => setAiOpen(false)} />

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
        eventDayKey={todayKey}
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

      {createPortal(
        <div id="schedule-print-root" aria-hidden>
          <h1 className="schedule-print__title">LockedIn · {todayLabel()}</h1>
          <p className="schedule-print__sub">
            {todayKey} — {t("schedule_print_disclaimer")}
          </p>
          <table>
            <thead>
              <tr>
                <th>{t("schedule_print_col_time")}</th>
                <th>{t("schedule_print_col_activity")}</th>
              </tr>
            </thead>
            <tbody>
              {blocks.length === 0 ? (
                <tr>
                  <td colSpan={2}>{t("schedule_empty_title")}</td>
                </tr>
              ) : (
                blocks.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {formatHm(b.startHour, b.startMinute)} –{" "}
                      {b.endHour === 24 && b.endMinute === 0 ? t("schedule_midnight") : formatHm(b.endHour, b.endMinute)}
                    </td>
                    <td>{t(`act_${b.activityId}_label`)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>,
        document.body,
      )}
    </section>
  );
}
