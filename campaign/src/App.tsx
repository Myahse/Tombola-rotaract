import { Navigate, Route, Routes } from "react-router-dom";
import { CampaignLayout } from "./components/CampaignLayout";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { CampaignEditorPage } from "./pages/CampaignEditorPage";
import { JoinPage } from "./pages/JoinPage";
import { JoinSponsorPage } from "./pages/JoinSponsorPage";
import { NewCampaignPage } from "./pages/NewCampaignPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/fr" replace />} />
      <Route path="/join" element={<Navigate to="/fr/join" replace />} />
      <Route path="/:lang/join/sponsor/:token" element={<JoinSponsorPage />} />
      <Route path="/:lang/join" element={<JoinPage />} />
      <Route path="/:lang" element={<CampaignLayout />}>
        <Route index element={<CampaignsPage />} />
        <Route path="new" element={<NewCampaignPage />} />
        <Route path="forms" element={<ApplicationsPage />} />
        <Route path="forms/:id" element={<ApplicationDetailPage />} />
        <Route path=":id" element={<CampaignEditorPage />} />
      </Route>
    </Routes>
  );
}
