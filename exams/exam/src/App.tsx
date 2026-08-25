import { Navigate, createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ExamPage } from "./pages/ExamPage";
import { LoginPage } from "./pages/LoginPage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/fr/induction" replace /> },
  {
    path: "/:lang",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="induction" replace /> },
      { path: "login", element: <LoginPage /> },
      { path: ":slug", element: <ExamPage /> },
    ],
  },
]);
