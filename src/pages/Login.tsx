import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Icon, Input } from "@/components/ui";
import { sha256, setAuthed } from "@/lib/auth";
import { useStore } from "@/lib/hooks";
import { updateSettings } from "@/lib/storage";
import { toast } from "sonner";

export default function Login() {
  const { settings, loaded } = useStore();
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const firstTime = loaded && !settings.passwordHash;

  useEffect(() => {
    document.title = "Geschenke-Manager — Login";
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw || !loaded) return;
    setBusy(true);
    try {
      const hash = await sha256(pw);
      if (firstTime) {
        await updateSettings({ passwordHash: hash });
        setAuthed(true);
        toast.success("Passwort gesetzt — willkommen!");
        nav("/");
        return;
      }
      if (hash === settings.passwordHash) {
        setAuthed(true);
        toast.success("Reingekommen 🎉");
        nav("/");
      } else {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        toast.error("Falsches Passwort");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-center px-6"
      style={{
        background:
          "radial-gradient(120% 60% at 50% 0%, #FEF3C7 0%, var(--gm-bg) 55%)",
      }}
    >
      <div className="text-center mb-7">
        <div
          className="w-[78px] h-[78px] mx-auto mb-4 rounded-3xl flex items-center justify-center text-[38px]"
          style={{
            background: "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
            boxShadow:
              "0 12px 28px -8px rgba(249,115,22,0.5), inset 0 0 0 1px rgba(255,255,255,0.2)",
          }}
        >
          🎁
        </div>
        <h1 className="m-0 text-[26px] font-extrabold tracking-tight text-stone-900 dark:text-stone-50">
          Geschenke-Manager
        </h1>
        <p className="mt-1.5 text-sm leading-[1.5] text-stone-500 dark:text-stone-400">
          {!loaded ? (
            "Verbinde mit Firebase…"
          ) : firstTime ? (
            <>Wähle ein Passwort für deine Gruppe.<br />Es wird gehasht gespeichert.</>
          ) : (
            <>Wer bekommt als Nächstes was?<br />Gemeinsam, ohne Chaos.</>
          )}
        </p>
      </div>

      <form
        onSubmit={submit}
        className={`flex flex-col gap-3 ${shake ? "animate-shake" : ""}`}
      >
        <div className="relative">
          <div className="absolute left-3 top-3.5 text-stone-400 pointer-events-none">
            <Icon.lock />
          </div>
          <Input
            type={show ? "text" : "password"}
            placeholder={firstTime ? "Neues Gruppen-Passwort" : "Gruppen-Passwort"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="pl-11 pr-20"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-2 px-2.5 py-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400"
          >
            {show ? "Verbergen" : "Zeigen"}
          </button>
        </div>
        <Button type="submit" size="lg" disabled={busy || !loaded || !pw}>
          {!loaded ? "Lädt…" : firstTime ? "Passwort setzen" : "Reinkommen"}
          <Icon.chev />
        </Button>
      </form>

      <p className="text-center text-xs mt-6 leading-[1.5] text-stone-400 dark:text-stone-500">
        Vertrauensbasis, kein Account.<br />
        Das Passwort liegt im Familien-Chat 💛
      </p>
    </div>
  );
}
