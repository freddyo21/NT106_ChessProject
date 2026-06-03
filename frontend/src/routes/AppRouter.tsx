import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DeepLinkLandingPage } from "../pages/DeepLinkLandingPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DeepLinkLandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}