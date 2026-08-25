import { Navigate, Route, Routes } from "react-router-dom";
import { MonitorLayout } from "./components/MonitorLayout";
import { MonitorPage } from "./pages/MonitorPage";
import { QcmEditorPage } from "./pages/QcmEditorPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/fr" replace />} />
      <Route path="/:lang" element={<MonitorLayout />}>
        <Route index element={<MonitorPage />} />
        <Route path="questions" element={<QcmEditorPage />} />
      </Route>
    </Routes>
  );
}
