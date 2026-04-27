import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useSchedule } from "./ScheduleContext";
import { getFirestoreDb } from "../lib/firebaseApp";
import { addStoryReply, subscribeRecentStories, subscribeStoryReplies, type StoryDoc } from "../lib/stories";
import { fetchDirectoryUser, type DirectoryUser } from "../lib/userDirectory";

type StoryViewContextValue = {
  openUserStory: (uid: string) => void;
  visibleStories: { id: string; data: StoryDoc }[];
  storyOwners: string[];
  profilesByUid: Record<string, DirectoryUser | null>;
};

const StoryViewContext = createContext<StoryViewContextValue | null>(null);

type ProviderProps = { children: ReactNode };

export function StoryViewProvider({ children }: ProviderProps) {
  const { firebaseUser, followingIds } = useSchedule();
  const [stories, setStories] = useState<{ id: string; data: StoryDoc }[]>([]);
  const [profilesByUid, setProfilesByUid] = useState<Record<string, DirectoryUser | null>>({});
  const [viewerOwner, setViewerOwner] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replies, setReplies] = useState<{ id: string; data: { authorUid: string; text: string } }[]>([]);
  const [dragY, setDragY] = useState(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => subscribeRecentStories(setStories), []);

  const allowedSet = useMemo(() => {
    const set = new Set<string>(followingIds);
    if (firebaseUser?.uid) set.add(firebaseUser.uid);
    return set;
  }, [followingIds, firebaseUser]);

  const visibleStories = useMemo(
    () => stories.filter((s) => allowedSet.has(s.data.ownerUid)),
    [stories, allowedSet],
  );

  const storyOwners = useMemo(() => {
    const owners: string[] = [];
    const seen = new Set<string>();
    for (const row of visibleStories) {
      const uid = row.data.ownerUid;
      if (!seen.has(uid)) {
        seen.add(uid);
        owners.push(uid);
      }
    }
    return owners;
  }, [visibleStories]);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || storyOwners.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, DirectoryUser | null> = {};
      for (const uid of storyOwners) {
        if (profilesByUid[uid] !== undefined) continue;
        next[uid] = await fetchDirectoryUser(db, uid);
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setProfilesByUid((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storyOwners, profilesByUid]);

  const openUserStory = useCallback((uid: string) => {
    setViewerOwner(uid);
    setViewerIndex(0);
  }, []);

  const viewerStories = useMemo(() => {
    if (!viewerOwner) return [];
    return visibleStories.filter((s) => s.data.ownerUid === viewerOwner);
  }, [viewerOwner, visibleStories]);

  const activeStory = viewerStories[viewerIndex] ?? null;

  useEffect(() => {
    if (!activeStory) {
      setReplies([]);
      return;
    }
    return subscribeStoryReplies(activeStory.id, (rows) => {
      setReplies(rows.map((r) => ({ id: r.id, data: { authorUid: r.data.authorUid, text: r.data.text } })));
    });
  }, [activeStory]);

  useEffect(() => {
    if (!activeStory) return;
    let raf = 0;
    const durationMs = 5000;
    let lastTs: number | null = null;
    const tick = (ts: number) => {
      if (lastTs == null) lastTs = ts;
      const dt = ts - lastTs;
      lastTs = ts;
      if (!paused) {
        setProgress((prev) => {
          const next = prev + dt / durationMs;
          if (next >= 1) {
            if (viewerIndex < viewerStories.length - 1) setViewerIndex((x) => x + 1);
            else {
              setViewerOwner(null);
              setViewerIndex(0);
            }
            return 0;
          }
          return next;
        });
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [activeStory, paused, viewerIndex, viewerStories.length]);

  useEffect(() => {
    setProgress(0);
  }, [activeStory?.id]);

  const closeViewer = () => {
    setViewerOwner(null);
    setViewerIndex(0);
    setPaused(false);
    setDragY(0);
    setTouchStartY(null);
  };

  const goNext = () => {
    if (!activeStory) return;
    if (viewerIndex < viewerStories.length - 1) {
      setViewerIndex((x) => x + 1);
      setProgress(0);
      return;
    }
    closeViewer();
  };

  const goPrev = () => {
    if (!activeStory) return;
    if (viewerIndex > 0) {
      setViewerIndex((x) => x - 1);
      setProgress(0);
      return;
    }
    setProgress(0);
  };

  const sendReply = async () => {
    if (!activeStory || !firebaseUser) return;
    const text = replyText.trim();
    if (!text) return;
    await addStoryReply(activeStory.id, firebaseUser.uid, text);
    setReplyText("");
  };

  const value = useMemo(
    () => ({
      openUserStory,
      visibleStories,
      storyOwners,
      profilesByUid,
    }),
    [openUserStory, visibleStories, storyOwners, profilesByUid],
  );

  return (
    <StoryViewContext.Provider value={value}>
      {children}
      {activeStory ? (
        <div className="feed-day-overlay" role="dialog" aria-modal="true" aria-label="Story viewer">
          <button type="button" className="feed-day-overlay__backdrop" onClick={closeViewer} aria-label="Close story viewer" />
          <div
            className="feed-day-overlay__panel glass-panel feed-day-overlay__panel--lift social-story-viewer"
            style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
          >
            <div className="social-story-viewer__progress">
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <button type="button" className="icon-btn social-story-viewer__close" onClick={closeViewer} aria-label="Close story viewer">
              <X size={20} />
            </button>
            <div
              className="social-story-viewer__media"
              onMouseDown={() => setPaused(true)}
              onMouseUp={() => setPaused(false)}
              onMouseLeave={() => setPaused(false)}
              onTouchStart={(e) => {
                setPaused(true);
                setTouchStartY(e.touches[0]?.clientY ?? null);
              }}
              onTouchMove={(e) => {
                if (touchStartY == null) return;
                const currentY = e.touches[0]?.clientY ?? touchStartY;
                const delta = Math.max(0, currentY - touchStartY);
                setDragY(delta);
              }}
              onTouchEnd={() => {
                setPaused(false);
                if (dragY > 100) {
                  closeViewer();
                } else {
                  setDragY(0);
                }
                setTouchStartY(null);
              }}
              onTouchCancel={() => {
                setPaused(false);
                setDragY(0);
                setTouchStartY(null);
              }}
            >
              <button type="button" className="social-story-viewer__tap-zone social-story-viewer__tap-zone--left" onClick={goPrev} aria-label="Previous story" />
              <button type="button" className="social-story-viewer__tap-zone social-story-viewer__tap-zone--right" onClick={goNext} aria-label="Next story" />
              <img src={activeStory.data.mediaDataUrl} alt={activeStory.data.caption || "Story image"} className="social-story-viewer__image" />
            </div>
            <p className="social-story-viewer__caption">{activeStory.data.caption || " "}</p>
            <div className="social-story-viewer__replies">
              {replies.slice(-3).map((r) => (
                <p key={r.id} className="social-story-viewer__reply">
                  @{r.data.authorUid.slice(0, 8)}: {r.data.text}
                </p>
              ))}
              <div className="share-comment-form">
                <input
                  className="field__input"
                  placeholder="Reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void sendReply();
                  }}
                />
                <button type="button" className="btn btn--primary btn--sm" onClick={() => void sendReply()}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </StoryViewContext.Provider>
  );
}

export function useStoryView() {
  const ctx = useContext(StoryViewContext);
  if (!ctx) throw new Error("useStoryView must be used within StoryViewProvider");
  return ctx;
}
