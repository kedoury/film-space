import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StudioPage } from "@/pages/StudioPage";
import { ScenesPage } from "@/pages/ScenesPage";
import { VideosPage } from "@/pages/VideosPage";
import { SharePage } from "@/pages/SharePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/studio" replace />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/scenes" element={<ScenesPage />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/share/:type/:token" element={<SharePage />} />
      </Routes>
    </BrowserRouter>
  );
}
