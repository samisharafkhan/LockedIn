import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";

const MARKS = ["◆", "◇", "◎", "✶", "⌁", "☽", "○"];

export function MePanel() {
  const { profile, setProfile } = useSchedule();
  const [showReset, setShowReset] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [mark, setMark] = useState(profile.avatarEmoji);

  useEffect(() => {
    setName(profile.displayName);
    setMark(profile.avatarEmoji);
  }, [profile.displayName, profile.avatarEmoji]);

  const saveProfile = () => {
    const trimmed = name.trim() || profile.displayName;
    const handle = trimmed.toLowerCase().replace(/\s+/g, "") || profile.handle;
    setProfile({ displayName: trimmed, handle, avatarEmoji: mark });
  };

  const resetLocal = () => {
    localStorage.removeItem("lockedin:v1");
    window.location.reload();
  };

  return (
    <section className="me" aria-labelledby="me-heading">
      <div className="me__hero">
        <div className="me__avatar" aria-hidden>
          {profile.avatarEmoji}
        </div>
        <div>
          <h2 id="me-heading" className="me__name">
            {profile.displayName}
          </h2>
          <p className="me__handle">@{profile.handle}</p>
        </div>
      </div>

      <div className="me__card">
        <h3 className="me__card-title">Profile</h3>
        <label className="me__field">
          <span>Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
        </label>
        <p className="me__field-label">Mark</p>
        <div className="me__marks" role="listbox" aria-label="Avatar mark">
          {MARKS.map((m) => (
            <button
              key={m}
              type="button"
              className={`me__mark ${m === mark ? "me__mark--on" : ""}`}
              onClick={() => setMark(m)}
              aria-pressed={m === mark}
            >
              {m}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--primary me__save" onClick={saveProfile}>
          Save profile
        </button>
      </div>

      <div className="me__card">
        <h3 className="me__card-title">Data on this device</h3>
        <p className="me__card-body">
          Your schedule and pulse live in this browser. Reset removes everything so you can start
          over.
        </p>
        {!showReset ? (
          <button type="button" className="btn btn--outline" onClick={() => setShowReset(true)}>
            Reset app data…
          </button>
        ) : (
          <div className="me__confirm">
            <p className="me__warn">This clears your schedule, pulse, and profile.</p>
            <div className="me__confirm-row">
              <button type="button" className="btn btn--ghost" onClick={() => setShowReset(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={resetLocal}>
                <LogOut size={18} strokeWidth={2} aria-hidden />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
