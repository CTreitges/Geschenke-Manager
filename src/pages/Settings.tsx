import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Card, Chip, Icon, Input, PageHeader, Toggle } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { updateSettings } from "@/lib/storage";
import { pickColor } from "@/lib/colors";
import { sha256, setAuthed, setIdentity, useIdentity } from "@/lib/auth";
import { toast } from "sonner";

export default function Settings() {
  const { persons, settings } = useStore();
  const nav = useNavigate();
  const identity = useIdentity() ?? "";
  const [budget, setBudget] = useState(settings.defaultBudget);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    setBudget(settings.defaultBudget);
  }, [settings.defaultBudget]);

  function pickIdentity(id: string) {
    setIdentity(id || null);
    const p = persons.find((x) => x.id === id);
    if (p) toast.success(`Du bist jetzt ${p.name}`);
  }

  function toggleDark() {
    const next = !settings.darkMode;
    updateSettings({ darkMode: next });
    if (next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  async function changePassword() {
    if (!oldPw || !newPw) return;
    const oldHash = await sha256(oldPw);
    if (oldHash !== settings.passwordHash) {
      toast.error("Aktuelles Passwort falsch");
      return;
    }
    const newHash = await sha256(newPw);
    await updateSettings({ passwordHash: newHash });
    setOldPw("");
    setNewPw("");
    toast.success("Passwort geändert");
  }

  function logout() {
    setAuthed(false);
    nav("/login");
  }

  return (
    <>
      <PageHeader title="Einstellungen" />

      <div className="px-4 pb-24">
        <Group title="Wer bin ich?">
          <div className="p-3.5">
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-2 leading-snug">
              Beeinflusst, wem deine Stimmen, Vorschläge und Wünsche zugeordnet werden.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {persons.length === 0 && (
                <p className="text-sm text-stone-400">Lege erst eine Person an.</p>
              )}
              {persons.map((p) => {
                const active = identity === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => pickIdentity(p.id)}
                    className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[13px] font-semibold border transition-colors"
                    style={
                      active
                        ? {
                            background: `linear-gradient(135deg, ${p.color || pickColor(p.id)}, ${(p.color || pickColor(p.id))}dd)`,
                            color: "#fff",
                            border: "1px solid transparent",
                          }
                        : { background: "transparent" }
                    }
                  >
                    <Avatar person={p} size={22} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </Group>

        <Group title="Geschenke">
          <Row label="Default-Budget pro Person" hint="Für neue Geschenke">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                onBlur={() => {
                  updateSettings({ defaultBudget: budget });
                  toast.success("Gespeichert");
                }}
                className="w-16 px-2 py-1.5 text-right rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-semibold outline-none"
              />
              <span className="text-stone-500 dark:text-stone-400">€</span>
            </div>
          </Row>
        </Group>

        <Group title="Aussehen">
          <Row label="Dark Mode" icon={<Icon.moon />}>
            <Toggle on={settings.darkMode} onChange={toggleDark} />
          </Row>
        </Group>

        <Group title="Hilfe">
          <Row label="So funktioniert's" hint="Step-by-Step Tutorial" icon={<Icon.gift />} onClick={() => nav("/tutorial")}>
            <Icon.chev className="text-stone-400" />
          </Row>
        </Group>

        <Group title="Mitteilungen">
          <Row label="Mail-Benachrichtigungen" hint="Erinnerungen vor Geburtstagen" icon={<Icon.mail />}>
            <Chip variant="neutral">bald verfügbar</Chip>
          </Row>
        </Group>

        <Group title="Sicherheit">
          <Row label="Passwort ändern" icon={<Icon.lock />}>
            <Icon.chev className="text-stone-400" />
          </Row>
          <div className="px-3.5 pb-3.5 -mt-2 flex flex-col gap-2">
            <Input
              type="password"
              placeholder="Aktuelles Passwort"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Neues Passwort"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <button
              onClick={changePassword}
              disabled={!oldPw || !newPw}
              className="text-sm font-semibold text-violet-700 dark:text-violet-400 disabled:opacity-50"
            >
              Passwort ändern
            </button>
          </div>
          <Row label="Abmelden" icon={<Icon.x />} onClick={logout} danger />
        </Group>

        <div className="text-center py-5 pb-1.5 text-[11px] text-stone-400">
          Geschenke-Manager · v0.4 · trust-based
        </div>
      </div>
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold tracking-[0.05em] uppercase text-stone-400 px-3.5 pt-1.5 pb-1.5">
        {title}
      </div>
      <Card className="p-0 overflow-hidden">{children}</Card>
    </div>
  );
}

function Row({
  label,
  hint,
  icon,
  children,
  onClick,
  danger,
}: {
  label: string;
  hint?: string;
  icon?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`px-3.5 py-3 flex items-center gap-3 border-t border-[#F5F1ED] dark:border-stone-700 first:border-t-0 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {icon && (
        <div
          className={`w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 ${
            danger
              ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
              : "bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-200"
          }`}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-semibold ${
            danger ? "text-red-700 dark:text-red-300" : "text-stone-900 dark:text-stone-50"
          }`}
        >
          {label}
        </div>
        {hint && <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
