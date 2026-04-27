import { Navigate, Route, Routes } from "react-router-dom";
import { isFirebaseAuthConfigured } from "../lib/firebaseApp";
import { BottomNav, type TabId } from "../components/BottomNav";
import { AppShell } from "../components/AppShell";
import { DiscoverPanel } from "../components/DiscoverPanel";
import { Onboarding } from "../components/Onboarding";
import { ProfilePanel } from "../components/ProfilePanel";
import { SchedulePanel } from "../components/SchedulePanel";
import { SocialPanel } from "../components/SocialPanel";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { TopHeader } from "../components/TopHeader";
import { useSchedule } from "../context/ScheduleContext";
import { StoryViewProvider } from "../context/StoryViewContext";
import { needsEmailVerification } from "../lib/authHelpers";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { LanguagePage } from "../pages/LanguagePage";
import { PhoneAuthPage } from "../pages/PhoneAuthPage";
import { SignInPage } from "../pages/SignInPage";
import { SignUpPage } from "../pages/SignUpPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { WelcomePage } from "../pages/WelcomePage";
import { SharedEventPage } from "../pages/SharedEventPage";
import { useEffect, useState } from "react";
import { getFirestoreDb } from "../lib/firebaseApp";
import { subscribeMyNotifications } from "../lib/socialNotifications";

function Shell() {
  const { profile, t, pendingIncomingFollows, firebaseUser } = useSchedule();
  const [tab, setTab] = useState<TabId>("social");
  const [headerPhotoOpen, setHeaderPhotoOpen] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser) {
      setNotificationUnreadCount(0);
      return;
    }
    return subscribeMyNotifications(db, firebaseUser.uid, (rows) => {
      setNotificationUnreadCount(rows.filter((r) => r.data.read !== true).length);
    });
  }, [firebaseUser]);

  return (
    <AppShell>
      <TopHeader
        title="LockedIn"
        subtitle="Plan with friends."
        profile={profile}
        onAvatarClick={() => setHeaderPhotoOpen(true)}
      />
      <main className="main-content">
        {tab === "social" ? <SocialPanel /> : null}
        {tab === "build" ? <SchedulePanel /> : null}
        {tab === "discover" ? <DiscoverPanel /> : null}
        {tab === "profile" ? <ProfilePanel /> : null}
      </main>

      <BottomNav
        tab={tab}
        onChange={setTab}
        profileRequestCount={pendingIncomingFollows.length + notificationUnreadCount}
        labels={{
          social: t("nav_social"),
          build: t("nav_build"),
          discover: t("nav_discover"),
          profile: "You",
        }}
      />

      {profile.avatarImageDataUrl ? (
        <PhotoLightbox
          src={profile.avatarImageDataUrl}
          open={headerPhotoOpen}
          onClose={() => setHeaderPhotoOpen(false)}
        />
      ) : null}
    </AppShell>
  );
}

function ProfileSetupRoute() {
  const { firebaseUser, languageOnboardingComplete } = useSchedule();
  if (!isFirebaseAuthConfigured() || !firebaseUser) {
    return <Navigate to="/welcome" replace />;
  }
  if (needsEmailVerification(firebaseUser)) {
    return <Navigate to="/verify-email" replace />;
  }
  if (!languageOnboardingComplete) {
    return <Navigate to="/language" replace />;
  }
  return <Onboarding />;
}

function MainGate() {
  const { firebaseUser, onboardingDone, languageOnboardingComplete } = useSchedule();

  if (!isFirebaseAuthConfigured()) {
    return <Navigate to="/welcome" replace />;
  }

  if (!firebaseUser) {
    return <Navigate to="/welcome" replace />;
  }

  if (needsEmailVerification(firebaseUser)) {
    return <Navigate to="/verify-email" replace />;
  }

  if (!languageOnboardingComplete) {
    return <Navigate to="/language" replace />;
  }

  if (!onboardingDone) {
    return <Navigate to="/profile-setup" replace />;
  }

  return (
    <StoryViewProvider>
      <Shell />
    </StoryViewProvider>
  );
}

function SharedEventGate() {
  const { firebaseUser, languageOnboardingComplete, onboardingDone } = useSchedule();

  if (!isFirebaseAuthConfigured()) {
    return <Navigate to="/welcome" replace />;
  }

  if (!firebaseUser) {
    return <Navigate to="/welcome" replace />;
  }

  if (needsEmailVerification(firebaseUser)) {
    return <Navigate to="/verify-email" replace />;
  }

  if (!languageOnboardingComplete) {
    return <Navigate to="/language" replace />;
  }

  if (!onboardingDone) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <SharedEventPage />;
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
      <Route path="/s/:shareId" element={<SharedEventGate />} />
      <Route path="/*" element={<MainGate />} />
    </Routes>
  );
}
