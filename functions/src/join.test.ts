import { describe, expect, it } from "vitest";
import { memoryFirestore } from "../test/memoryFirestore";
import { runJoinGroup } from "./join";
import {
  JOIN_MAX_ATTEMPTS_PER_IP,
  JOIN_MAX_ATTEMPTS_PER_UID,
  JOIN_WINDOW_MS,
  RATE_LIMIT_COLLECTION,
  clientIp,
  ipBucket,
  type LimitScope,
} from "./rateLimit";

// Vorbestand-Hash aus password.test.ts (alter pbkdf2Sync-Code).
const SALT = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const PASSWORD = "Geburtstag-2024!";
const HASH = "bfee48192a56b61a5847648795768402dc2e7ee086a6a8b34a9c4bfa22e78356";

function setup() {
  const store = memoryFirestore({
    "groups/g1": { defaultBudget: 10 },
    "groups/g1/_meta/auth": { salt: SALT, hash: HASH, version: 1 },
  });
  let t = 1_000_000;
  const logs: { uid: string; scope: LimitScope }[] = [];
  const deps = { now: () => t, logRateLimited: (info: { uid: string; scope: LimitScope }) => logs.push(info) };
  const join = (uid: string, password: string, ip?: string, groupId = "g1") =>
    runJoinGroup(store.db, { uid, ip }, groupId, password, deps);
  return { ...store, join, logs, advance: (ms: number) => (t += ms) };
}

async function failTimes(join: (uid: string, pw: string, ip?: string) => Promise<unknown>, uid: string, n: number, ip?: string) {
  for (let i = 0; i < n; i++) {
    await expect(join(uid, `falsch-${i}`, ip)).rejects.toMatchObject({ code: "permission-denied" });
  }
}

describe("clientIp", () => {
  it("nimmt den rechten X-Forwarded-For-Eintrag (vom Google Front End), nicht den vom Client", () => {
    expect(clientIp({ headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" }, ip: "6.6.6.6" })).toBe("203.0.113.9");
    expect(clientIp({ headers: { "x-forwarded-for": "203.0.113.9" } })).toBe("203.0.113.9");
  });

  it("fällt ohne Header auf rawRequest.ip zurück, sonst undefined", () => {
    expect(clientIp({ headers: {}, ip: "127.0.0.1" })).toBe("127.0.0.1");
    expect(clientIp(undefined)).toBeUndefined();
  });
});

describe("ipBucket", () => {
  it("kürzt IPv6 auf das /64-Präfix, auch in Kurzschreibweise", () => {
    expect(ipBucket("2001:db8:0:1:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:0:1::/64");
    expect(ipBucket("2001:DB8:0:1::5")).toBe("2001:db8:0:1::/64");
    expect(ipBucket("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipBucket("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  it("lässt IPv4 unverändert und behandelt IPv4-mapped IPv6 als IPv4", () => {
    expect(ipBucket("203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("::ffff:cb00:7109")).toBe("203.0.113.9");
  });
});

describe("IPv6-Zähler je /64", () => {
  async function exhaustIp(join: (uid: string, pw: string, ip?: string) => Promise<unknown>, ips: string[], tag = "a") {
    // Fehlversuche reihum aus den Adressen, je UID unter der UID-Grenze.
    for (let i = 0; i < JOIN_MAX_ATTEMPTS_PER_IP; i++) {
      const uid = `${tag}${Math.floor(i / (JOIN_MAX_ATTEMPTS_PER_UID - 1))}`;
      await expect(join(uid, `falsch-${i}`, ips[i % ips.length])).rejects.toMatchObject({ code: "permission-denied" });
    }
  }

  it("zwei Adressen im selben /64 teilen einen Zähler", async () => {
    const { join } = setup();
    await exhaustIp(join, ["2001:db8:0:1::a", "2001:db8:0:1:ffff:1:2:3"]);
    await expect(join("neu", PASSWORD, "2001:db8:0:1:9::9")).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("verschiedene /64 teilen keinen Zähler; IPv4-mapped zählt wie IPv4", async () => {
    const { join } = setup();
    await exhaustIp(join, ["2001:db8:0:1::a"]);
    await expect(join("neu1", PASSWORD, "2001:db8:0:2::a")).resolves.toEqual({ ok: true });
    await exhaustIp(join, ["::ffff:198.51.100.7"], "b");
    await expect(join("neu2", PASSWORD, "198.51.100.7")).rejects.toMatchObject({ code: "resource-exhausted" });
  });
});

describe("joinGroup Rate-Limit je Aufrufer", () => {
  it("lehnt nach N Fehlversuchen mit resource-exhausted ab – auch mit richtigem Passwort", async () => {
    const { join, docs } = setup();
    await failTimes(join, "attacker", JOIN_MAX_ATTEMPTS_PER_UID);
    await expect(join("attacker", PASSWORD)).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(docs.has("groups/g1/members/attacker")).toBe(false);
  });

  it("lässt nach Ablauf des Fensters wieder zu", async () => {
    const { join, docs, advance } = setup();
    await failTimes(join, "u1", JOIN_MAX_ATTEMPTS_PER_UID);
    advance(JOIN_WINDOW_MS - 1);
    await expect(join("u1", PASSWORD)).rejects.toMatchObject({ code: "resource-exhausted" });
    advance(1);
    await expect(join("u1", PASSWORD)).resolves.toEqual({ ok: true });
    expect(docs.has("groups/g1/members/u1")).toBe(true);
  });

  it("sperrt andere Nutzer derselben Gruppe nicht (Zähler je Aufrufer, nicht je Gruppe)", async () => {
    const { join, docs } = setup();
    await failTimes(join, "attacker", JOIN_MAX_ATTEMPTS_PER_UID, "203.0.113.9");
    await expect(join("attacker", PASSWORD, "203.0.113.9")).rejects.toMatchObject({ code: "resource-exhausted" });
    await expect(join("friend", PASSWORD, "198.51.100.7")).resolves.toEqual({ ok: true });
    expect(docs.has("groups/g1/members/friend")).toBe(true);
  });

  it("zählt unbekannte Gruppen mit (keine Enumeration von Gruppen-IDs)", async () => {
    const { join } = setup();
    for (let i = 0; i < JOIN_MAX_ATTEMPTS_PER_UID; i++) {
      await expect(join("u1", PASSWORD, undefined, `gibtsnicht${i}`)).rejects.toMatchObject({ code: "not-found" });
    }
    await expect(join("u1", PASSWORD)).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("ein erfolgreicher Beitritt verbraucht keinen Versuch", async () => {
    const { join } = setup();
    for (let i = 0; i < JOIN_MAX_ATTEMPTS_PER_UID + 2; i++) {
      await expect(join("u1", PASSWORD, "203.0.113.9")).resolves.toEqual({ ok: true });
    }
  });

  it("Beitritt zur eigenen Gruppe setzt die Fehlversuche gegen eine fremde nicht zurück", async () => {
    const { join, docs } = setup();
    docs.set("groups/own", { defaultBudget: 10 });
    docs.set("groups/own/_meta/auth", { salt: SALT, hash: HASH, version: 1 });
    await failTimes(join, "attacker", JOIN_MAX_ATTEMPTS_PER_UID - 1);
    await expect(join("attacker", PASSWORD, undefined, "own")).resolves.toEqual({ ok: true });
    await failTimes(join, "attacker", 1);
    await expect(join("attacker", PASSWORD)).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("sperrt viele frische UIDs von einer IP nach der IP-Grenze", async () => {
    const { join } = setup();
    const ip = "203.0.113.9";
    let uid = 0;
    for (let done = 0; done < JOIN_MAX_ATTEMPTS_PER_IP; done += JOIN_MAX_ATTEMPTS_PER_UID - 1) {
      await failTimes(join, `anon${++uid}`, Math.min(JOIN_MAX_ATTEMPTS_PER_UID - 1, JOIN_MAX_ATTEMPTS_PER_IP - done), ip);
    }
    await expect(join("anon-neu", PASSWORD, ip)).rejects.toMatchObject({ code: "resource-exhausted" });
    await expect(join("anon-neu", PASSWORD, "198.51.100.7")).resolves.toEqual({ ok: true });
  });

  it("loggt jede Ablehnung genau einmal, ohne Passwort, Gruppen-ID oder IP", async () => {
    const { join, logs } = setup();
    await failTimes(join, "u1", JOIN_MAX_ATTEMPTS_PER_UID, "203.0.113.9");
    expect(logs).toHaveLength(0);
    await expect(join("u1", PASSWORD, "203.0.113.9")).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(logs).toEqual([{ uid: "u1", scope: "uid" }]);
    await expect(join("u1", PASSWORD, "203.0.113.9")).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(logs).toHaveLength(2);
    const text = JSON.stringify(logs);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain("g1");
    expect(text).not.toContain("203.0.113.9");
  });

  it("legt die Zähler nur in der gesperrten Sammlung ab", async () => {
    const { join, docs } = setup();
    await failTimes(join, "u1", 1, "203.0.113.9");
    const counterDocs = [...docs.keys()].filter((k) => !k.startsWith("groups/"));
    expect(counterDocs.length).toBe(2);
    expect(counterDocs.every((k) => k.startsWith(`${RATE_LIMIT_COLLECTION}/`))).toBe(true);
  });
});
