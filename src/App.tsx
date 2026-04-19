import { useState } from "react";
import { BottomNav, type TabId } from "./components/BottomNav";
import { CelebritiesPanel } from "./components/CelebritiesPanel";
import { FriendsPanel } from "./components/FriendsPanel";
import { Onboarding } from "./components/Onboarding";
import { ProfilePanel } from "./components/ProfilePanel";
import { SchedulePanel } from "./components/SchedulePanel";
import { AvatarDisplay } from "./components/AvatarDisplay";
import { PhotoLightbox } from "./components/PhotoLightbox";
import { ScheduleProvider, useSchedule } from "./context/ScheduleContext";

function Shell() {
  const { profile, onboardingDone } = useSchedule();
  const [tab, setTab] = useState<TabId>("build");
  const [headerPhotoOpen, setHeaderPhotoOpen] = useState(false);

  if (!onboardingDone) {
    return <Onboarding />;
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="top__brand">LockedIn</p>
          <p className="top__tag">Build your day, line up with friends, borrow energy from public arcs.</p>
        </div>
        <div className="top__user">
          {profile.avatarImageDataUrl ? (
            <button
              type="button"
              className="top__avatar-hit"
              onClick={() => setHeaderPhotoOpen(true)}
              aria-label="View profile photo full size"
            >
              <div className="top__avatar-wrap" aria-hidden>
                <AvatarDisplay source={profile} size="sm" />
              </div>
            </button>
          ) : (
            <div className="top__avatar-wrap" aria-hidden>
              <AvatarDisplay source={profile} size="sm" />
            </div>
          )}
          <div>
            <p className="top__name">{profile.displayName}</p>
            <p className="top__handle">@{profile.handle}</p>
          </div>
        </div>
      </header>

      <main className="main">
        {tab === "build" ? <SchedulePanel /> : null}
        {tab === "friends" ? <FriendsPanel /> : null}
        {tab === "stars" ? <CelebritiesPanel /> : null}
        {tab === "profile" ? <ProfilePanel /> : null}
      </main>

      <BottomNav tab={tab} onChange={setTab} />

      {profile.avatarImageDataUrl ? (
        <PhotoLightbox
          src={profile.avatarImageDataUrl}
          open={headerPhotoOpen}
          onClose={() => setHeaderPhotoOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <ScheduleProvider>
      <Shell />
    </ScheduleProvider>
  );
}
