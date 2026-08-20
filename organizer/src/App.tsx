import { Navigate, Route, Routes } from "react-router-dom";
import { OrganizerLayout } from "./components/OrganizerLayout";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { TombolaPage } from "./pages/admin/TombolaPage";
import { BuyersPage } from "./pages/admin/BuyersPage";
import { DrawPage } from "./pages/admin/DrawPage";
import { QrPage } from "./pages/admin/QrPage";
import { ClubSettingsPage } from "./pages/admin/ClubSettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/fr" replace />} />
      <Route path="/:lang" element={<OrganizerLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="tombola" element={<TombolaPage />} />
        <Route path="buyers" element={<BuyersPage />} />
        <Route path="qr" element={<QrPage />} />
        <Route path="draw" element={<DrawPage />} />
        <Route path="settings" element={<ClubSettingsPage />} />
        <Route path="login" element={<Navigate to=".." replace />} />
      </Route>
    </Routes>
  );
}
