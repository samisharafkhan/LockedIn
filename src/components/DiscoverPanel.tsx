import { useEffect, useMemo, useState } from "react";
import { Compass, Search } from "lucide-react";
import { AvatarDisplay } from "./AvatarDisplay";
import { UserPublicProfileSheet } from "./UserPublicProfileSheet";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import { isoDate } from "../lib/dates";
import {
  fetchPublishedSchedulesForDay,
  searchDirectoryUsers,
  type DirectoryUser,
  type PublishedScheduleDoc,
} from "../lib/userDirectory";
import { getFirestoreDb } from "../lib/firebaseApp";
import { formatHm } from "../lib/time";
import type { ActivityId, TimeBlock } from "../types";
import type { StoredBlock } from "../lib/storage";

function storedToBlock(b: StoredBlock): TimeBlock {
  return {
    id: b.id,
    startHour: b.startHour,
    startMinute: b.startMinute,
    endHour: b.endHour,
    endMinute: b.endMinute,
    activityId: b.activityId as ActivityId,
    ...(b.outcome ? { outcome: b.outcome } : {}),
  };
}

export function DiscoverPanel() {
  const { profile, firebaseUser, t, tick } = useSchedule();
  const [rows, setRows] = useState<PublishedScheduleDoc[]>([]);
  const [busy, setBusy] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [searchHits, setSearchHits] = useState<DirectoryUser[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [profilePreview, setProfilePreview] = useState<{
    displayName: string;
    handle: string;
    avatarEmoji?: string;
    bio?: string;
    isPrivate?: boolean;
  } | null>(null);

  const dayKey = useMemo(() => isoDate(new Date()), [tick]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(searchQ), 320);
    return () => window.clearTimeout(id);
  }, [searchQ]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void fetchPublishedSchedulesForDay(dayKey).then((list) => {
      if (cancelled) return;
      const mine = firebaseUser?.uid;
      setRows(mine ? list.filter((r) => r.ownerUid !== mine) : list);
      setBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dayKey, firebaseUser?.uid]);

  useEffect(() => {
    const db = getFirestoreDb();
    const uid = firebaseUser?.uid;
    if (!db || !uid || debouncedQ.trim().length < 2) {
      setSearchHits([]);
      setSearchBusy(false);
      return;
    }
    let cancelled = false;
    setSearchBusy(true);
    void searchDirectoryUsers(db, debouncedQ, uid)
      .then((list) => {
        if (!cancelled) setSearchHits(list);
      })
      .finally(() => {
        if (!cancelled) setSearchBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, firebaseUser]);

  const openProfile = (u: DirectoryUser) => {
    setProfileUid(u.uid);
    setProfilePreview({
      displayName: u.displayName,
      handle: u.handle,
      avatarEmoji: u.avatarEmoji,
      bio: u.bio,
      isPrivate: u.isPrivate === true || u.accountPublic === false,
    });
    setProfileOpen(true);
  };

  const openProfileFromPublished = (row: PublishedScheduleDoc) => {
    setProfileUid(row.ownerUid);
    setProfilePreview({
      displayName: row.displayName,
      handle: row.handle,
      avatarEmoji: row.avatarEmoji,
      bio: row.bio,
    });
    setProfileOpen(true);
  };

  return (
    <section className="discover" aria-labelledby="discover-heading">
      <div className="discover__head">
        <div>
          <p className="eyebrow eyebrow--dark">{t("discover_eyebrow")}</p>
          <h2 id="discover-heading" className="discover__title">
            {t("discover_title")}
          </h2>
          <p className="discover__sub">{t("discover_sub")}</p>
        </div>
        <div className="avatar-ring discover__icon-wrap" aria-hidden>
          <Compass size={28} strokeWidth={2} className="discover__compass" />
        </div>
      </div>

      <div className="discover__search-wrap">
        <Search className="discover__search-icon" size={18} strokeWidth={2} aria-hidden />
        <input
          type="search"
          className="discover__search-input"
          placeholder={t("discover_search_placeholder")}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          enterKeyHint="search"
          autoComplete="off"
          aria-label={t("discover_search_placeholder")}
        />
      </div>
      {!getFirestoreDb() || !firebaseUser ? (
        <p className="friends__muted">{t("discover_search_sign_in")}</p>
      ) : searchBusy ? (
        <p className="friends__muted">{t("discover_search_busy")}</p>
      ) : debouncedQ.trim().length >= 2 && searchHits.length === 0 ? (
        <p className="friends__muted">{t("discover_search_empty")}</p>
      ) : debouncedQ.trim().length >= 2 ? (
        <ul className="discover__search-results" role="list">
          {searchHits.map((u) => (
            <li key={u.uid}>
              <button type="button" className="discover__search-hit" onClick={() => openProfile(u)}>
                <span className="discover__search-mark" aria-hidden>
                  {u.avatarEmoji ?? "○"}
                </span>
                <span className="discover__search-text">
                  <span className="discover__search-name">{u.displayName}</span>
                  <span className="discover__search-handle">@{u.handle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="discover__search-hint friends__muted">{t("discover_search_hint")}</p>
      )}

      <div className="discover__hint-card">
        <p className="discover__hint">{t("discover_hint_publish")}</p>
      </div>

      <p className="discover__feed-label">{t("discover_feed_label")}</p>

      {busy ? (
        <p className="friends__muted">{t("discover_loading")}</p>
      ) : rows.length === 0 ? (
        <p className="friends__muted">{t("discover_empty")}</p>
      ) : (
        <ul className="discover__list" role="list">
          {rows.map((row) => (
            <li key={row.ownerUid}>
              <button type="button" className="discover__card discover__card--btn" onClick={() => openProfileFromPublished(row)}>
                <div className="discover__card-head">
                  <span className="discover__mark" aria-hidden>
                    {row.avatarEmoji ?? "○"}
                  </span>
                  <div>
                    <p className="discover__name">{row.displayName}</p>
                    <p className="discover__handle">@{row.handle}</p>
                  </div>
                </div>
                {row.bio ? <p className="discover__card-bio">{row.bio}</p> : null}
                <p className="discover__day-label">{t("discover_today_schedule")}</p>
                <ol className="discover__blocks">
                  {row.blocks.length === 0 ? (
                    <li className="friends__muted">{t("discover_no_blocks_today")}</li>
                  ) : (
                    row.blocks.map((sb) => {
                      const b = storedToBlock(sb);
                      return (
                        <li key={b.id} className="discover__block-row">
                          <span className="discover__block-ico" aria-hidden>
                            <ActivityIcon id={b.activityId} size={18} />
                          </span>
                          <div>
                            <p className="discover__block-label">{t(`act_${b.activityId}_label`)}</p>
                            <p className="discover__block-time">
                              {formatHm(b.startHour, b.startMinute)} –{" "}
                              {b.endHour === 24 && b.endMinute === 0
                                ? t("schedule_midnight")
                                : formatHm(b.endHour, b.endMinute)}
                            </p>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ol>
                <p className="discover__tap-profile">{t("discover_tap_profile")}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="discover__me">
        <AvatarDisplay source={profile} size="sm" />
        <p className="discover__me-text">{t("discover_you_footer")}</p>
      </div>

      <UserPublicProfileSheet
        open={profileOpen}
        targetUid={profileUid}
        preview={profilePreview}
        onClose={() => {
          setProfileOpen(false);
          setProfileUid(null);
          setProfilePreview(null);
        }}
      />
    </section>
  );
}
