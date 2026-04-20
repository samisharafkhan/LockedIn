import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSchedule } from "../context/ScheduleContext";

/** Redirects to /language until the user has completed the first-run language step. */
export function useRequireLanguageFirst() {
  const { languageOnboardingComplete } = useSchedule();
  const navigate = useNavigate();

  useEffect(() => {
    if (!languageOnboardingComplete) {
      navigate("/language", { replace: true });
    }
  }, [languageOnboardingComplete, navigate]);
}
