import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { ScheduleProvider } from "./context/ScheduleContext";
import { applyThemeFromPrefs } from "./lib/mePrefs";
import { AppRoutes } from "./routes/AppRoutes";

export default function App() {
  useEffect(() => {
    applyThemeFromPrefs();
  }, []);

  return (
    <BrowserRouter>
      <ScheduleProvider>
        <AppRoutes />
      </ScheduleProvider>
    </BrowserRouter>
  );
}
