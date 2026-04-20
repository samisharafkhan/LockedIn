import { BrowserRouter } from "react-router-dom";
import { ScheduleProvider } from "./context/ScheduleContext";
import { AppRoutes } from "./routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <ScheduleProvider>
        <AppRoutes />
      </ScheduleProvider>
    </BrowserRouter>
  );
}
