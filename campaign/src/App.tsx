import { Navigate, Route, Routes } from "react-router-dom";
import { CampaignLayout } from "./components/CampaignLayout";
import { CampaignsPage } from "./pages/CampaignsPage";
import { CampaignEditorPage } from "./pages/CampaignEditorPage";
import { NewCampaignPage } from "./pages/NewCampaignPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/fr" replace />} />
      <Route path="/:lang" element={<CampaignLayout />}>
        <Route index element={<CampaignsPage />} />
        <Route path="new" element={<NewCampaignPage />} />
        <Route path=":id" element={<CampaignEditorPage />} />
      </Route>
    </Routes>
  );
}
