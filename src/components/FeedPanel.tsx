import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Profile } from "../types";
import { useSchedule } from "../context/ScheduleContext";
import { getFirestoreDb } from "../lib/firebaseApp";
import { fetchDirectoryUser, fetchPublishedSchedulesForDay, type DirectoryUser, type PublishedScheduleDoc } from "../lib/userDirectory";
import { mergeSchedulePostWithDirectory, subscribeRecentSchedulePosts, type SchedulePostDoc } from "../lib/schedulePosts";
import { UserPublicProfileSheet } from "./UserPublicProfileSheet";
import { storedToTimeBlock } from "./ProfilePostUtils";
import { AvatarDisplay } from "./AvatarDisplay";
import { ReadOnlyDayCalendar } from "./ReadOnlyDayCalendar";
import { PostSocialBar } from "./PostSocialBar";
import { MomentumCard } from "./MomentumCard";
import { FeedPostCard } from "./FeedPostCard";
import { SoftCard } from "./SoftCard";
import { PillButton } from "./PillButton";

type Row = { id: string; data: SchedulePostDoc };

const FEED_PAGE = 3;

type FeedPanelProps = {
  /** When true, omitted duplicate page header (used inside Social → Posts). */
  embedded?: boolean;
};

export function FeedPanel({ embedded = false }: FeedPanelProps) {
  const { t, followingIds, firebaseUser, scheduleByDay, todayKey } = useSchedule();
  const [raw, setRaw] = useState<Row[]>([]);
  const [dirByUid, setDirByUid] = useState<Record<string, DirectoryUser | null>>({});
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [openPost, setOpenPost] = useState<Row | null>(null);
  const [publishedRows, setPublishedRows] = useState<PublishedScheduleDoc[]>([]);
  const [feedExpanded, setFeedExpanded] = useState(false);

  const following = useMemo(() => new Set(followingIds), [followingIds]);

  const items = useMemo(() => {
    if (!firebaseUser) return [];
    return raw
      .filter(
        (r) =>
          r.data.ownerUid !== firebaseUser.uid &&
          following.has(r.data.ownerUid),
      )
      .slice(0, 50);
  }, [raw, following, firebaseUser]);

  const streakDays = useMemo(() => {
    let streak = 0;
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(`${todayKey}T12:00:00`);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if ((scheduleByDay[key] ?? []).length > 0) streak += 1;
      else break;
    }
    return streak;
  }, [scheduleByDay, todayKey]);

  const rewardPoints = useMemo(() => {
    let points = 0;
    for (const list of Object.values(scheduleByDay)) {
      for (const block of list) {
        points += 10;
        if (block.outcome === "done") points += 15;
      }
    }
    return points;
  }, [scheduleByDay]);

  const itemOwnerKey = useMemo(
    () => [...new Set(items.map((i) => i.data.ownerUid))].sort().join(","),
    [items],
  );

  const openPostDisplay = useMemo(() => {
    if (!openPost) return null;
    return mergeSchedulePostWithDirectory(openPost.data, dirByUid[openPost.data.ownerUid] ?? null);
  }, [openPost, dirByUid]);

  const visibleFeed = useMemo(
    () => (feedExpanded ? items : items.slice(0, FEED_PAGE)),
    [items, feedExpanded],
  );

  useEffect(() => {
    if (!itemOwnerKey) return;
    const db = getFirestoreDb();
    if (!db) return;
    const uids = itemOwnerKey.split(",");
    let cancel = false;
    void (async () => {
      const m: Record<string, DirectoryUser | null> = {};
      await Promise.all(
        uids.map(async (uid) => {
          m[uid] = await fetchDirectoryUser(db, uid);
        }),
      );
      if (!cancel) {
        setDirByUid((prev) => {
          const next = { ...prev };
          for (const uid of uids) {
            next[uid] = m[uid] ?? null;
          }
          return next;
        });
      }
    })();
    return () => {
      cancel = true;
    };
  }, [itemOwnerKey]);

  useEffect(() => {
    if (!firebaseUser) {
      setRaw([]);
      return;
    }
    return subscribeRecentSchedulePosts(120, setRaw);
  }, [firebaseUser]);

  useEffect(() => {
    let cancelled = false;
    void fetchPublishedSchedulesForDay(todayKey).then((rows) => {
      if (cancelled) return;
      setPublishedRows(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  const publishedVisible = useMemo(() => {
    const set = new Set(followingIds);
    if (firebaseUser?.uid) set.add(firebaseUser.uid);
    return publishedRows.filter((row) => set.has(row.ownerUid));
  }, [publishedRows, followingIds, firebaseUser]);

  useEffect(() => {
    if (!openPost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPost(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPost]);

  if (!firebaseUser) {
    return (
      <section className={`feed${embedded ? " feed-embed" : ""}`} aria-labelledby={embedded ? undefined : "feed-heading"}>
        {!embedded ? (
          <>
            <p className="eyebrow eyebrow--dark">{t("feed_eyebrow")}</p>
            <h2 id="feed-heading" className="page-intro__title">
              {t("feed_title")}
            </h2>
          </>
        ) : null}
        <p className="feed__empty friends__muted">{t("feed_need_signin")}</p>
      </section>
    );
  }

  if (following.size === 0) {
    return (
      <section className={`feed${embedded ? " feed-embed" : ""}`} aria-labelledby={embedded ? undefined : "feed-heading"}>
        {!embedded ? (
          <>
            <p className="eyebrow eyebrow--dark">{t("feed_eyebrow")}</p>
            <h2 id="feed-heading" className="page-intro__title">
              {t("feed_title")}
            </h2>
          </>
        ) : null}
        <p className="feed__empty friends__muted">{t("feed_no_following")}</p>
      </section>
    );
  }

  return (
    <section className={`feed${embedded ? " feed-embed" : ""}`} aria-labelledby={embedded ? undefined : "feed-heading"}>
      {!embedded ? (
        <>
          <p className="eyebrow eyebrow--dark">{t("feed_eyebrow")}</p>
          <h2 id="feed-heading" className="page-intro__title">
            {t("feed_title")}
          </h2>
        </>
      ) : null}

      {items.length > 0 ? <MomentumCard streakDays={streakDays} points={rewardPoints} /> : null}

      {items.length === 0 ? (
        <p className="feed__empty friends__muted">{t("feed_empty")}</p>
      ) : (
        <>
          <ul className="post-hcard-list" role="list">
            {visibleFeed.map((row) => {
              const merged = mergeSchedulePostWithDirectory(row.data, dirByUid[row.data.ownerUid] ?? null);
              return (
                <li key={row.id} className="post-hcard-list__item" role="listitem">
                  <FeedPostCard
                    data={merged}
                    onOpen={() => setOpenPost({ ...row, data: merged })}
                    variant="feed"
                  />
                </li>
              );
            })}
          </ul>
          {items.length > FEED_PAGE ? (
            <PillButton
              variant="secondary"
              className="feed-embed__more"
              type="button"
              onClick={() => setFeedExpanded((e) => !e)}
            >
              {feedExpanded ? t("feed_view_less") : t("feed_view_more", { n: String(items.length) })}
            </PillButton>
          ) : null}
        </>
      )}

      {publishedVisible.length > 0 ? (
        <SoftCard className="feed-published-deemph">
          <p className="section-header__eyebrow">{t("discover_feed_label")}</p>
          <ul className="discover__blocks" style={{ marginTop: 6 }}>
            {publishedVisible.slice(0, 4).map((row) => (
              <li key={row.ownerUid} className="discover__block-row">
                <span className="discover__block-ico" aria-hidden>
                  {row.avatarEmoji ?? "○"}
                </span>
                <div>
                  <p className="discover__block-label">{row.displayName}</p>
                  <p className="discover__block-time">
                    @{row.handle} · {row.blocks.length} blocks
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </SoftCard>
      ) : null}

      <UserPublicProfileSheet
        open={profileUid != null}
        onClose={() => setProfileUid(null)}
        targetUid={profileUid}
      />

      {openPost ? (
        <div className="feed-day-overlay" role="dialog" aria-modal="true" aria-labelledby="feed-day-title">
          <button
            type="button"
            className="feed-day-overlay__backdrop"
            aria-label={t("block_close")}
            onClick={() => setOpenPost(null)}
          />
          <div className="feed-day-overlay__panel glass-panel feed-day-overlay__panel--lift">
            <header className="feed-day-overlay__head">
              <div className="feed-day-overlay__person">
                <span className="feed-day-overlay__avatar" aria-hidden>
                  <AvatarDisplay
                    source={
                      openPostDisplay
                        ? ({
                            displayName: openPostDisplay.displayName,
                            handle: openPostDisplay.handle,
                            avatarEmoji: openPostDisplay.avatarEmoji ?? "○",
                            avatarImageDataUrl: openPostDisplay.avatarImageDataUrl ?? null,
                            avatarAnimalId: openPostDisplay.avatarAnimalId ?? null,
                          } as Profile)
                        : ({ displayName: "", handle: "", avatarEmoji: "○" } as Profile)
                    }
                    size="md"
                  />
                </span>
                <div>
                  <h3 id="feed-day-title" className="feed-day-overlay__title">
                    {openPostDisplay ? openPostDisplay.displayName : openPost.data.displayName}
                  </h3>
                  <p className="feed-day-overlay__sub">
                    @
                    {openPostDisplay ? openPostDisplay.handle : openPost.data.handle} · {openPost.data.dayKey}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn glass-hit"
                onClick={() => setOpenPost(null)}
                aria-label={t("block_close")}
              >
                <X size={22} strokeWidth={2} />
              </button>
            </header>

            <PostSocialBar
              variant="schedulePost"
              postId={openPost.id}
              ownerUid={openPost.data.ownerUid}
              showPinControl={false}
            />

            <div className="feed-day-overlay__cal-wrap">
              <ReadOnlyDayCalendar blocks={openPost.data.blocks.map(storedToTimeBlock)} />
            </div>

            <div className="feed-day-overlay__foot">
              <button
                type="button"
                className="btn btn--outline glass-hit"
                onClick={() => {
                  const uid = openPost.data.ownerUid;
                  setOpenPost(null);
                  setProfileUid(uid);
                }}
              >
                {t("feed_view_profile")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
