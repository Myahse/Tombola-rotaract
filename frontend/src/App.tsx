import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { TombolaPage } from "./pages/TombolaPage";
import { BuyPage } from "./pages/BuyPage";
import { EventTicketsPage } from "./pages/EventTicketsPage";
import { TicketsPage } from "./pages/TicketsPage";
import { ResultsPage } from "./pages/ResultsPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AccountPage } from "./pages/AccountPage";
import { DonatePage } from "./pages/DonatePage";
import { TermsPage } from "./pages/TermsPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/fr" replace />} />
      <Route path="/:lang" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tombola" element={<TombolaPage />} />
        <Route path="buy" element={<BuyPage />} />
        <Route path="tickets/:token" element={<TicketsPage />} />
        <Route path="my-tickets/:eventId" element={<EventTicketsPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="donate" element={<DonatePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot" element={<ForgotPasswordPage />} />
        <Route path="reset" element={<ResetPasswordPage />} />
        <Route path="verify" element={<VerifyEmailPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
    </Routes>
  );
}
