import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Icon, Input } from "@/components/ui";
import { sha256, setAuthed, setGroupId } from "@/lib/auth";
import { fetchGroupHash } from "@/lib/storage";
import { toast } from "sonner";

export default function Login() {
  const [groupIdInput, setGroupIdInput] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    document.title = "Geschenke-Manager — Login";
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = groupIdInput.trim();
    if (!id || !pw) return;
    setBusy(true);
    try {
      const stored = await fetchGroupHash(id);
      if (!stored) {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        toast.error("Gruppe nicht gefunden");
        return;
      }
      const hash = await sha256(pw);
      if (hash !== stored) {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        toast.error("Falsches Passwort");
        return;
      }
      setGroupId(id);
      setAuthed(true);
      toast.success("Reingekommen 🎉");
      nav("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-center px-6"
      style={{
        background:
          "radial-gradient(120% 60% at 50% 0%, #EDE9FE 0%, var(--gm-bg) 55%)",
      }}
    >
      <div className="text-center mb-7">
        <div
          className="w-[78px] h-[78px] mx-auto mb-4 rounded-3xl flex items-center justify-center text-[38px]"
          style={{
            background: "linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)",
            boxShadow:
              "0 12px 28px -8px rgba(124,58,237,0.5), inset 0 0 0 1px rgba(255,255,255,0.2)",
          }}
        >
          🎁
        </div>
        <h1 className="m-0 text-[26px] font-extrabold tracking-tight text-stone-900 dark:text-stone-50">
          Geschenke-Manager
        </h1>
        <p className="mt-1.5 text-sm leading-[1.5] text-stone-500 dark:text-stone-400">
          Wer bekommt als Nächstes was?<br />Gemeinsam, ohne Chaos.
        </p>
      </div>

      <form
        onSubmit={submit}
        className={`flex flex-col gap-3 ${shake ? "animate-shake" : ""}`}
      >
        <div className="relative">
          <div className="absolute left-3 top-3.5 text-stone-400 pointer-events-none">
            <Icon.users />
          </div>
          <Input
            type="text"
            placeholder="Gruppen-ID"
            value={groupIdInput}
            onChange={(e) => setGroupIdInput(e.target.value)}
            className="pl-11"
            autoFocus
            autoComplete="username"
            spellCheck={false}
          />
        </div>
        <div className="relative">
          <div className="absolute left-3 top-3.5 text-stone-400 pointer-events-none">
            <Icon.lock />
          </div>
          <Input
            type={show ? "text" : "password"}
            placeholder="Passwort"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="pl-11 pr-20"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-2 px-2.5 py-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400"
          >
            {show ? "Verbergen" : "Zeigen"}
          </button>
        </div>
        <Button type="submit" size="lg" disabled={busy || !groupIdInput.trim() || !pw}>
          {busy ? "Prüfe…" : "Reinkommen"}
          <Icon.chev />
        </Button>
      </form>

      <div className="text-center mt-5">
        <Link
          to="/login/new"
          className="text-sm font-semibold text-violet-700 dark:text-violet-300"
        >
          + Neue Gruppe erstellen
        </Link>
      </div>

      <p className="text-center text-xs mt-6 leading-[1.5] text-stone-400 dark:text-stone-500">
        Vertrauensbasis, kein Account.<br />
        Gruppen-ID und Passwort liegen im Familien-Chat 💛
      </p>
    </div>
  );
}
