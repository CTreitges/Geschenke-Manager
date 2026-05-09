import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import People from "@/pages/People";
import PersonDetail from "@/pages/PersonDetail";
import GiftDetail from "@/pages/GiftDetail";
import Settings from "@/pages/Settings";
import MyWishlist from "@/pages/MyWishlist";
import Tutorial from "@/pages/Tutorial";
import Feedback from "@/pages/Feedback";
import { isAuthed } from "@/lib/auth";
import { useStore } from "@/lib/hooks";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!isAuthed()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

const TUTORIAL_SEEN_KEY = "gm:tutorial-seen:v1";

/**
 * Auto-open the tutorial on first visit per browser. Marks itself as
 * seen via localStorage so it never auto-opens again on this device.
 */
function FirstRunTutorial() {
  const nav = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === "/tutorial") return;
    if (localStorage.getItem(TUTORIAL_SEEN_KEY) === "yes") return;
    localStorage.setItem(TUTORIAL_SEEN_KEY, "yes");
    nav("/tutorial");
  }, [location.pathname, nav]);
  return null;
}

export default function App() {
  const { settings } = useStore();

  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [settings.darkMode]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <FirstRunTutorial />
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/people" element={<People />} />
                <Route path="/person/:id" element={<PersonDetail />} />
                <Route path="/gift/:id" element={<GiftDetail />} />
                <Route path="/wishlist" element={<MyWishlist />} />
                <Route path="/tutorial" element={<Tutorial />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
