import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { UserPublicProfileSheet } from "./UserPublicProfileSheet";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import { PageIntro } from "./PageIntro";
import { SoftCard } from "./SoftCard";
import { isoDate } from "../lib/dates";
import {
  fetchPublishedSchedulesForDay,
  searchDirectoryUsers,
  type DirectoryUser,
  type PublishedScheduleDoc,
} from "../lib/userDirectory";
import { buildDiscoverCelebrityRows, isSyntheticCelebrityUid } from "../data/discoverCelebrities";
import { getFirestoreDb } from "../lib/firebaseApp";
import { PostSocialBar } from "./PostSocialBar";
import { formatHm } from "../lib/time";
import type { ActivityId, TimeBlock } from "../types";
import type { StoredBlock } from "../lib/storage";
import { PillButton } from "./PillButton";

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

const INITIAL = 6;
type DiscoverFilter = "everyone" | "friends" | "celebs";

export function DiscoverPanel() {
  const { profile, setProfile, firebaseUser, t, tick, followingIds } = useSchedule();
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
  const [filter, setFilter] = useState<DiscoverFilter>("everyone");
  const [showAll, setShowAll] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);

  const dayKey = useMemo(() => isoDate(new Date()), [tick]);
  const celebrityRows = useMemo(() => buildDiscoverCelebrityRows(dayKey), [dayKey]);
  const following = useMemo(() => new Set(followingIds), [followingIds]);

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
      const real = mine ? list.filter((r) => r.ownerUid !== mine) : list;
      const celebLimit = 4;
      const celebPart = buildDiscoverCelebrityRows(dayKey).slice(0, celebLimit);
      const merged = [...real, ...celebPart].sort((a, b) => a.displayName.localeCompare(b.displayName));
      setRows(merged);
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

  const celebSearchHits = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (q.length < 2) return [];
    return celebrityRows.filter((row) => {
      return row.displayName.toLowerCase().includes(q) || row.handle.toLowerCase().includes(q);
    });
  }, [debouncedQ, celebrityRows]);

  const filteredRows = useMemo(() => {
    if (filter === "celebs") return rows.filter((r) => isSyntheticCelebrityUid(r.ownerUid));
    if (filter === "friends")
      return rows.filter((r) => !isSyntheticCelebrityUid(r.ownerUid) && following.has(r.ownerUid));
    return rows;
  }, [rows, filter, following]);

  const visibleRows = useMemo(
    () => (showAll ? filteredRows : filteredRows.slice(0, INITIAL)),
    [filteredRows, showAll],
  );

  const chips: { id: DiscoverFilter; label: string }[] = [
    { id: "everyone", label: t("discover_chip_everyone") },
    { id: "friends", label: t("discover_chip_friends") },
    { id: "celebs", label: t("discover_chip_celebs") },
  ];

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
      <PageIntro id="discover-heading" label={t("discover_eyebrow")} title={t("discover_title")} />

      <SoftCard className="discover__search-card">
        <label className="visually-hidden" htmlFor="discover-search-input">
          {t("discover_search_placeholder_v2")}
        </label>
        <Search className="discover__search-icon" size={18} strokeWidth={2} aria-hidden />
        <input
          id="discover-search-input"
          type="search"
          className="discover__search-input"
          placeholder={t("discover_search_placeholder_v2")}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          enterKeyHint="search"
          autoComplete="off"
        />
        {!getFirestoreDb() || !firebaseUser ? (
          <p className="discover__search-hint friends__muted" style={{ marginTop: 8, marginBottom: 0 }}>
            {t("discover_search_sign_in")}
          </p>
        ) : null}
      </SoftCard>

      {searchBusy ? (
        <p className="friends__muted">{t("discover_search_busy")}</p>
      ) : debouncedQ.trim().length >= 2 && searchHits.length === 0 && celebSearchHits.length === 0 ? (
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
          {celebSearchHits.map((row) => (
            <li key={row.ownerUid}>
              <button type="button" className="discover__search-hit" onClick={() => openProfileFromPublished(row)}>
                <span className="discover__search-mark" aria-hidden>
                  {row.avatarEmoji ?? "○"}
                </span>
                <span className="discover__search-text">
                  <span className="discover__search-name">{row.displayName}</span>
                  <span className="discover__search-handle">@{row.handle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="discover__filter-chips" role="toolbar" aria-label="Discover filters">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`discover__chip${filter === c.id ? " discover__chip--on" : ""}`}
            onClick={() => {
              setFilter(c.id);
              setShowAll(false);
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <SoftCard>
        <p className="discover__publish-line">{t("discover_publish_short")}</p>
        <div className="discover__publish-actions">
          {firebaseUser ? (
            <PillButton
              variant="primary"
              type="button"
              disabled={profile.isPrivate === true}
              onClick={() => setProfile({ publishTodayToDiscover: !profile.publishTodayToDiscover })}
            >
              {profile.publishTodayToDiscover ? t("discover_published_pill") : t("discover_publish_today_pill")}
            </PillButton>
          ) : null}
          <button type="button" className="discover__learn-more" onClick={() => setLearnOpen((o) => !o)}>
            {t("discover_learn_privacy_link")}
          </button>
        </div>
        {learnOpen ? <p className="friends__muted discover__learn-body discover__learn-body--spaced">{t("discover_privacy_learn_short")}</p> : null}
      </SoftCard>

      {busy ? (
        <p className="friends__muted">{t("discover_loading")}</p>
      ) : filteredRows.length === 0 ? (
        <p className="friends__muted">{t("discover_empty")}</p>
      ) : (
        <>
          <ul className="discover__grid" role="list">
            {visibleRows.map((row) => (
              <li key={row.ownerUid}>
                <div className="discover__card discover__card--grid">
                  <button
                    type="button"
                    className="discover__card-main discover__card-main--grid"
                    onClick={() => openProfileFromPublished(row)}
                  >
                    <span className="discover__mark discover__mark--grid" aria-hidden>
                      {row.avatarEmoji ?? "○"}
                    </span>
                    <p className="discover__name">{row.displayName}</p>
                    <p className="discover__handle">@{row.handle}</p>
                    <ol className="discover__blocks discover__blocks--compact">
                      {row.blocks.slice(0, 2).map((sb) => {
                        const b = storedToBlock(sb);
                        return (
                          <li key={b.id} className="discover__block-row discover__block-row--compact">
                            <span className="discover__block-ico" aria-hidden>
                              <ActivityIcon id={b.activityId} size={16} />
                            </span>
                            <p className="discover__block-time">
                              {t(`act_${b.activityId}_label`)} · {formatHm(b.startHour, b.startMinute)}
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  </button>
                  {firebaseUser && getFirestoreDb() && !isSyntheticCelebrityUid(row.ownerUid) ? (
                    <div className="discover__card-social">
                      <PostSocialBar variant="published" publishedOwnerUid={row.ownerUid} />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {filteredRows.length > INITIAL ? (
            <PillButton variant="secondary" type="button" onClick={() => setShowAll((s) => !s)} style={{ width: "100%" }}>
              {showAll ? t("discover_show_less") : t("discover_show_more", { n: String(filteredRows.length) })}
            </PillButton>
          ) : null}
        </>
      )}

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
