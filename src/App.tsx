import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import CreateGroup from "@/pages/CreateGroup";
import Home from "@/pages/Home";
import People from "@/pages/People";
import PersonDetail from "@/pages/PersonDetail";
import GiftDetail from "@/pages/GiftDetail";
import Settings from "@/pages/Settings";
import MyWishlist from "@/pages/MyWishlist";
import Tutorial from "@/pages/Tutorial";
import Feedback from "@/pages/Feedback";
import { isAuthed, useGroupId } from "@/lib/auth";
import { useStore } from "@/lib/hooks";
import { setActiveGroup, updateSettings } from "@/lib/storage";
import { autoMigrateLegacyIfNeeded } from "@/lib/migrate";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const groupId = useGroupId();
  if (!isAuthed() || !groupId) {
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

const DARK_DEFAULT_FLAG = "gm:dark-default-v1";

export default function App() {
  const groupId = useGroupId();
  const { settings, loaded } = useStore();
  const [bootDone, setBootDone] = useState(false);

  // Boot once: run the one-shot legacy → group "Jeg" auto-migration, then
  // mark the app as ready. Errors do not block the UI (the user will hit
  // a "group not found" if migration silently failed and they try Jeg).
  useEffect(() => {
    autoMigrateLegacyIfNeeded()
      .catch(() => {
        /* ignore — user can still create a fresh group manually */
      })
      .finally(() => setBootDone(true));
  }, []);

  // Wire active Firestore subscriptions to whatever group is currently
  // selected. Re-runs when login/logout/create-group dispatches the
  // gm:group-change event.
  useEffect(() => {
    setActiveGroup(groupId);
  }, [groupId]);

  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [settings.darkMode]);

  // One-time rollout: dark mode is now the default. If this browser still
  // sees the old `darkMode: false` (because it was the previous default and
  // got persisted at some point), flip it once. Users who actively want
  // light mode can toggle it back in Settings — we won't re-flip after that.
  useEffect(() => {
    if (!loaded) return;
    if (localStorage.getItem(DARK_DEFAULT_FLAG) === "done") return;
    localStorage.setItem(DARK_DEFAULT_FLAG, "done");
    if (!settings.darkMode) updateSettings({ darkMode: true });
  }, [loaded, settings.darkMode]);

  if (!bootDone) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-stone-500 dark:text-stone-400 text-sm"
        style={{
          background:
            "radial-gradient(120% 60% at 50% 0%, #EDE9FE 0%, var(--gm-bg) 55%)",
        }}
      >
        Lade Gruppendaten…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/login/new" element={<CreateGroup />} />
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
