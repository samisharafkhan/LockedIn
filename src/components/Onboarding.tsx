import { useState } from "react";
import { useSchedule } from "../context/ScheduleContext";

const MARKS = ["◆", "◇", "◎", "✶", "⌁", "☽", "○"];

export function Onboarding() {
  const { setProfile, finishOnboarding } = useSchedule();
  const [name, setName] = useState("");
  const [mark, setMark] = useState("◆");

  const go = () => {
    const trimmed = name.trim() || "Friend";
    const handle = trimmed.toLowerCase().replace(/\s+/g, "") || "friend";
    setProfile({
      displayName: trimmed,
      handle,
      avatarEmoji: mark,
    });
    finishOnboarding();
  };

  return (
    <div className="onboard">
      <div className="onboard__card">
        <p className="eyebrow eyebrow--dark">LockedIn</p>
        <h1 className="onboard__title">Let’s set you up</h1>
        <p className="onboard__lede">
          You’ll build your own day — no fake people, no mystery icons. This takes a few taps.
        </p>
        <label className="field">
          <span className="field__label">Display name</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
            maxLength={24}
            autoFocus
          />
        </label>
        <div className="field">
          <span className="field__label">Mark</span>
          <div className="emoji-row" role="listbox" aria-label="Choose avatar mark">
            {MARKS.map((m) => (
              <button
                key={m}
                type="button"
                className={`emoji-chip ${m === mark ? "emoji-chip--on" : ""}`}
                onClick={() => setMark(m)}
                aria-pressed={m === mark}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn--primary btn--wide" onClick={go}>
          Continue
        </button>
      </div>
    </div>
  );
}
