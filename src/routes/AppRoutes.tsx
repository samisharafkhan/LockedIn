import { Navigate, Route, Routes } from "react-router-dom";
import { isFirebaseAuthConfigured } from "../lib/firebaseApp";
import { BottomNav, type TabId } from "../components/BottomNav";
import { CelebritiesPanel } from "../components/CelebritiesPanel";
import { FriendsPanel } from "../components/FriendsPanel";
import { Onboarding } from "../components/Onboarding";
import { ProfilePanel } from "../components/ProfilePanel";
import { SchedulePanel } from "../components/SchedulePanel";
import { AvatarDisplay } from "../components/AvatarDisplay";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { useSchedule } from "../context/ScheduleContext";
import { needsEmailVerification } from "../lib/authHelpers";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { LanguagePage } from "../pages/LanguagePage";
import { PhoneAuthPage } from "../pages/PhoneAuthPage";
import { SignInPage } from "../pages/SignInPage";
import { SignUpPage } from "../pages/SignUpPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { WelcomePage } from "../pages/WelcomePage";
import { useState } from "react";

function Shell() {
  const { profile, t } = useSchedule();
  const [tab, setTab] = useState<TabId>("build");
  const [headerPhotoOpen, setHeaderPhotoOpen] = useState(false);

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="top__brand">LockedIn</p>
          <p className="top__tag">{t("app_tagline")}</p>
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

      <BottomNav
        tab={tab}
        onChange={setTab}
        labels={{
          build: t("nav_build"),
          friends: t("nav_friends"),
          stars: t("nav_stars"),
          profile: t("nav_profile"),
        }}
      />

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

function ProfileSetupRoute() {
  const { firebaseUser, languageOnboardingComplete } = useSchedule();
  if (!languageOnboardingComplete) {
    return <Navigate to="/language" replace />;
  }
  if (!isFirebaseAuthConfigured() || !firebaseUser) {
    return <Navigate to="/welcome" replace />;
  }
  return <Onboarding />;
}

function MainGate() {
  const { firebaseUser, onboardingDone, languageOnboardingComplete } = useSchedule();

  if (!languageOnboardingComplete) {
    return <Navigate to="/language" replace />;
  }

  if (!isFirebaseAuthConfigured()) {
    return <Navigate to="/welcome" replace />;
  }

  if (!firebaseUser) {
    return <Navigate to="/welcome" replace />;
  }

  if (needsEmailVerification(firebaseUser)) {
    return <Navigate to="/verify-email" replace />;
  }

  if (!onboardingDone) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <Shell />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/phone" element={<PhoneAuthPage />} />
      <Route path="/language" element={<LanguagePage />} />
      <Route path="/profile-setup" element={<ProfileSetupRoute />} />
      <Route path="/*" element={<MainGate />} />
    </Routes>
  );
}
