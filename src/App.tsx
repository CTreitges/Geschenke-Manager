import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import People from "@/pages/People";
import PersonDetail from "@/pages/PersonDetail";
import GiftDetail from "@/pages/GiftDetail";
import Settings from "@/pages/Settings";
import MyWishlist from "@/pages/MyWishlist";
import Tutorial from "@/pages/Tutorial";
import { isAuthed } from "@/lib/auth";
import { useStore } from "@/lib/hooks";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!isAuthed()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
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
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/people" element={<People />} />
                <Route path="/person/:id" element={<PersonDetail />} />
                <Route path="/gift/:id" element={<GiftDetail />} />
                <Route path="/wishlist" element={<MyWishlist />} />
                <Route path="/tutorial" element={<Tutorial />} />
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
