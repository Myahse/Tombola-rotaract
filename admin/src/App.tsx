import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ClubsPage } from "./pages/ClubsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/fr" replace />} />
      <Route path="/:lang" element={<Layout />}>
        <Route index element={<ClubsPage />} />
      </Route>
    </Routes>
  );
}
