import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { PwaInstallTipDialog } from "@/components/PwaInstallTipDialog";
import { TestMailTipDialog } from "@/components/TestMailTipDialog";
import Login from "@/pages/Login";
import CreateGroup from "@/pages/CreateGroup";
import Home from "@/pages/Home";
import People from "@/pages/People";
import PersonDetail from "@/pages/PersonDetail";
import GiftDetail from "@/pages/GiftDetail";
import Settings from "@/pages/Settings";
import MyWishlist from "@/pages/MyWishlist";
import PastGifts from "@/pages/PastGifts";
import Tutorial from "@/pages/Tutorial";
import Feedback from "@/pages/Feedback";
import MagicLink from "@/pages/MagicLink";
import ShareGift from "@/pages/ShareGift";
import {
  addKnownGroup,
  getGroupId,
  getKnownGroups,
  isAuthed,
  setAuthed,
  setGroupId,
  useGroupId,
} from "@/lib/auth";
import { consumeGoogleRedirectResult } from "@/lib/firebase";
import { isEntryLinkSession } from "@/lib/onboarding";
import { useStore } from "@/lib/hooks";
import { listMyGroupsCF, setActiveGroup } from "@/lib/storage";
import { autoMigrateLegacyIfNeeded, consolidateFeedbackOnce } from "@/lib/migrate";
import { syncPushToken, usePushNavigation } from "@/lib/messaging";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const groupId = useGroupId();
  if (!isAuthed() || !groupId) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

/**
 * Picks up the result of a signInWithRedirect / linkWithRedirect that the
 * installed PWA triggered before the page reload. Mirrors the toast +
 * navigation logic that the popup branch runs inline in Login/Settings.
 *
 * Runs only once per page load — sessionStorage is cleared inside
 * consumeGoogleRedirectResult, so a duplicate effect call from StrictMode
 * resolves to null on the second pass.
 */
function GoogleRedirectHandler() {
  const nav = useNavigate();
  useEffect(() => {
    console.info("[auth] GoogleRedirectHandler mounted");
    (async () => {
      try {
        const outcome = await consumeGoogleRedirectResult();
        if (!outcome) return;
        console.info("[auth] post-redirect outcome", outcome);
        if (outcome.source === "login") {
          let serverGroups: string[] = [];
          try {
            serverGroups = await listMyGroupsCF();
            serverGroups.forEach((g) => addKnownGroup(g));
          } catch (e) {
            console.warn("listMyGroups failed:", e);
          }
          if (outcome.linked) toast.success("Mit Google verknüpft 🎉");
          else if (outcome.switched) toast.success("Mit Google angemeldet 🎉");
          else toast.success("Mit Google angemeldet");
          const known = getKnownGroups();
          const target = getGroupId() ?? serverGroups[0] ?? known[0] ?? null;
          console.info("[auth] post-redirect target group", { target, serverGroups, known });
          if (target) {
            setGroupId(target);
            setAuthed(true);
            setActiveGroup(target);
            nav("/");
          } else {
            console.warn("[auth] no target group after google-login — staying on /login");
          }
        } else {
          if (outcome.linked) {
            toast.success("Mit Google verknüpft 🎉");
          } else if (outcome.switched) {
            toast.message("Anderes Google-Konto übernommen", {
              description:
                "Tritt der Gruppe einmal mit Passwort bei — dann ist auch dieses Konto Mitglied.",
            });
            setAuthed(false);
            nav("/login");
          } else {
            toast.success("Mit Google angemeldet");
          }
        }
      } catch (err) {
        const code = (err as { code?: string })?.code ?? "";
        if (code === "auth/operation-not-allowed") {
          toast.error("Google-Login ist im Firebase-Projekt noch nicht aktiviert");
        } else if (code === "auth/network-request-failed") {
          toast.error("Keine Internet-Verbindung");
        } else if (code === "auth/account-exists-with-different-credential") {
          toast.error("Dieser Account existiert schon mit einem anderen Provider");
        } else {
          console.error("Google redirect failed:", err);
          const msg = code || (err as Error)?.message || "unbekannt";
          toast.error(`Google-Login fehlgeschlagen (${msg})`);
        }
      }
    })();
    // We intentionally run this only on the first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * Push: Klicks auf Meldungen (GM_NAVIGATE vom Push-Worker) im Router
 * ausführen und den FCM-Token beim Start frisch halten (höchstens 1×/Tag,
 * nur mit erteilter Berechtigung, nur angemeldet).
 */
function PushBridge({ groupId }: { groupId: string | null }) {
  usePushNavigation();
  useEffect(() => {
    if (groupId && isAuthed()) void syncPushToken();
  }, [groupId]);
  return null;
}

const TUTORIAL_SEEN_KEY = "gm:tutorial-seen:v5";

/**
 * Auto-open the tutorial on first visit per browser. Marks itself as
 * seen via localStorage so it never auto-opens again on this device.
 */
function FirstRunTutorial() {
  const nav = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === "/tutorial") return;
    if ((location.state as Record<string, unknown>)?.fromShareLink) return;
    // Share-/Magic-Link-Einstieg unterbricht nie (B14: Mail-Link → Wunschliste).
    if (isEntryLinkSession()) return;
    if (localStorage.getItem(TUTORIAL_SEEN_KEY) === "yes") return;
    localStorage.setItem(TUTORIAL_SEEN_KEY, "yes");
    nav("/tutorial");
  }, [location.pathname, nav]);
  return null;
}

export default function App() {
  const groupId = useGroupId();
  const { settings } = useStore();
  const [bootDone, setBootDone] = useState(false);

  // Boot once: legacy → group "Jeg" auto-migration, then pull any
  // group-scoped feedback back to the global /feedback collection, then
  // mark the app as ready.
  useEffect(() => {
    (async () => {
      try {
        await autoMigrateLegacyIfNeeded();
      } catch {
        /* ignore — user can still create a fresh group manually */
      }
      // Make sure the currently-active group is in the known-list, even
      // if it predates the multi-group switcher.
      const current = getGroupId();
      if (current) addKnownGroup(current);
      try {
        await consolidateFeedbackOnce(getKnownGroups());
      } catch {
        /* ignore */
      }
      setBootDone(true);
    })();
  }, []);

  // Wire active Firestore subscriptions to whatever group is currently
  // selected. Re-runs when login/logout/create-group dispatches the
  // gm:group-change event.
  useEffect(() => {
    setActiveGroup(groupId);
    // Migration: vor v1.7.2 wurde die "Wer bin ich?"-Auswahl nur in
    // localStorage gespeichert. Damit der grüne Marker auch für Leute
    // sichtbar wird, die die App schon seit Längerem nutzen, schreiben
    // wir die lokale Identität beim Group-Wechsel einmal in die Cloud
    // nach (idempotent, setDoc+merge). Andere Geräte sehen die
    // Identität dann automatisch in der members-Subscription.
    if (groupId) {
      const localId = localStorage.getItem(`gm:identity:v1:${groupId}`);
      if (localId) {
        import("@/lib/storage")
          .then((s) => s.setMyIdentityCloud(localId))
          .catch(() => {
            /* best-effort */
          });
      }
    }
  }, [groupId]);

  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [settings.darkMode]);

  // GoogleRedirectHandler MUSS unabhängig vom bootDone-Gate gemounted sein —
  // sonst ruft `getRedirectResult` erst nach autoMigrate+consolidate auf,
  // verzögert oder verpasst den Post-Redirect-State. Wir rendern ihn auch
  // während des Loaders.
  return (
    <>
      <GoogleRedirectHandler />
      <PushBridge groupId={groupId} />
      {!bootDone ? (
        <div
          className="min-h-screen flex items-center justify-center text-stone-500 dark:text-stone-400 text-sm"
          style={{
            background:
              "radial-gradient(120% 60% at 50% 0%, #EDE9FE 0%, var(--gm-bg) 55%)",
          }}
        >
          Lade Gruppendaten…
        </div>
      ) : (
        <AppRoutes />
      )}
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/login/new" element={<CreateGroup />} />
      <Route path="/m/:token" element={<MagicLink />} />
      <Route path="/g/:groupId/gift/:giftId" element={<ShareGift />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <FirstRunTutorial />
            <PwaInstallTipDialog />
            <TestMailTipDialog />
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/people" element={<People />} />
                <Route path="/person/:id" element={<PersonDetail />} />
                <Route path="/gift/:id" element={<GiftDetail />} />
                <Route path="/wishlist" element={<MyWishlist />} />
                <Route path="/past" element={<PastGifts />} />
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
