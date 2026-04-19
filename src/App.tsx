import { useState } from "react";
import { BottomNav, type TabId } from "./components/BottomNav";
import { MePanel } from "./components/MePanel";
import { Onboarding } from "./components/Onboarding";
import { PulsePanel } from "./components/PulsePanel";
import { SchedulePanel } from "./components/SchedulePanel";
import { ScheduleProvider, useSchedule } from "./context/ScheduleContext";

function Shell() {
  const { profile, onboardingDone } = useSchedule();
  const [tab, setTab] = useState<TabId>("schedule");

  if (!onboardingDone) {
    return <Onboarding />;
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="top__brand">LockedIn</p>
          <p className="top__tag">Your day, your blocks — share the vibe, not every detail.</p>
        </div>
        <div className="top__user">
          <span className="top__emoji" aria-hidden>
            {profile.avatarEmoji}
          </span>
          <div>
            <p className="top__name">{profile.displayName}</p>
            <p className="top__handle">@{profile.handle}</p>
          </div>
        </div>
      </header>

      <main className="main">
        {tab === "schedule" ? <SchedulePanel /> : null}
        {tab === "pulse" ? <PulsePanel /> : null}
        {tab === "me" ? <MePanel /> : null}
      </main>

      <BottomNav tab={tab} onChange={setTab} />
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
