import * as admin from "firebase-admin";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";

admin.initializeApp();
const db = admin.firestore();

const REGION = "europe-west1";
const APP_URL = "https://geschenke-manager-ec19e.web.app";
// Must match Brevo verified-sender record EXACTLY (case-sensitive).
const MAIL_FROM = "Geschenke-Manager <christof.treitges@gmail.com>";
const UNSUB_SECRET = defineSecret("UNSUB_SECRET");
const BREVO_SMTP_USER = defineSecret("BREVO_SMTP_USER");
const BREVO_SMTP_PASS = defineSecret("BREVO_SMTP_PASS");
const STACK_WINDOW_DAYS = 30;

interface MailContent {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Direct SMTP delivery via Brevo. The Firebase "Trigger Email" extension
 * had a transport-initialization bug in v0.2.7/v0.2.8 (transport.sendMail
 * was undefined even on a fresh container), so this bypasses it entirely
 * and goes straight through nodemailer with credentials from Secret Mgr.
 */
async function sendMailViaSmtp(mail: MailContent): Promise<void> {
  // Brevo: port 587 with STARTTLS (secure:false → upgrades after EHLO).
  const user = BREVO_SMTP_USER.value();
  console.log(
    `SMTP: connecting smtp-relay.brevo.com:587 as ${user} → ${mail.to}`,
  );
  const transport = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: { user, pass: BREVO_SMTP_PASS.value() },
    logger: true,
    debug: true,
  });
  const info = await transport.sendMail({
    from: MAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  console.log(
    `SMTP success: messageId=${info.messageId} response=${info.response}`,
  );
}
const GROUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/;
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
}

function randomSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

function legacySha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function requireAuth(auth: { uid?: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Anonymous sign-in required");
  }
  return auth.uid;
}

function requireGroupId(value: unknown): string {
  if (typeof value !== "string" || !GROUP_ID_PATTERN.test(value)) {
    throw new HttpsError(
      "invalid-argument",
      "Group id must match ^[A-Za-z0-9][A-Za-z0-9-]{2,29}$",
    );
  }
  return value;
}

function requirePassword(value: unknown, field = "password"): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpsError("invalid-argument", `${field} required`);
  }
  return value;
}

interface AuthMeta {
  salt: string;
  hash: string;
  version: number;
}

async function readAuthMeta(groupId: string): Promise<AuthMeta | null> {
  const snap = await db.doc(`groups/${groupId}/_meta/auth`).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<AuthMeta>;
  if (
    typeof data.salt !== "string" ||
    typeof data.hash !== "string" ||
    typeof data.version !== "number"
  ) {
    return null;
  }
  return data as AuthMeta;
}

/**
 * Look at the legacy `passwordHash` field on the group root doc (old
 * SHA-256-without-salt format) and, if it matches the supplied password,
 * upgrade in place to a salted PBKDF2 entry under `_meta/auth`. The legacy
 * field is then deleted. Returns true on successful upgrade, false otherwise.
 */
async function migrateLegacyHash(
  groupId: string,
  password: string,
): Promise<boolean> {
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists) return false;
  const legacyHash = (groupSnap.data() as Record<string, unknown>)?.passwordHash;
  if (typeof legacyHash !== "string") return false;
  if (legacySha256(password) !== legacyHash) return false;
  const salt = randomSalt();
  const hash = hashPassword(password, salt);
  const batch = db.batch();
  batch.set(db.doc(`groups/${groupId}/_meta/auth`), {
    salt,
    hash,
    version: 1,
  });
  batch.update(db.doc(`groups/${groupId}`), {
    passwordHash: admin.firestore.FieldValue.delete(),
  });
  await batch.commit();
  return true;
}

async function verifyPassword(
  groupId: string,
  password: string,
): Promise<void> {
  let meta = await readAuthMeta(groupId);
  if (!meta) {
    // Maybe the group still uses the old top-level passwordHash field — try
    // to migrate on the fly.
    const migrated = await migrateLegacyHash(groupId, password);
    if (!migrated) {
      throw new HttpsError("permission-denied", "Wrong password");
    }
    meta = await readAuthMeta(groupId);
    if (!meta) {
      throw new HttpsError("internal", "Auth meta lost after migration");
    }
    return;
  }
  if (hashPassword(password, meta.salt) !== meta.hash) {
    throw new HttpsError("permission-denied", "Wrong password");
  }
}

async function requireMember(groupId: string, uid: string): Promise<void> {
  const member = await db.doc(`groups/${groupId}/members/${uid}`).get();
  if (!member.exists) {
    throw new HttpsError("permission-denied", "Not a member");
  }
}

// ─── createGroup ────────────────────────────────────────
export const createGroup = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const groupId = requireGroupId((request.data as { groupId?: unknown })?.groupId);
  const password = requirePassword((request.data as { password?: unknown })?.password);

  const groupRef = db.doc(`groups/${groupId}`);
  const existing = await groupRef.get();
  if (existing.exists) {
    throw new HttpsError("already-exists", "Group already exists");
  }

  const salt = randomSalt();
  const hash = hashPassword(password, salt);

  const batch = db.batch();
  batch.set(groupRef, {
    defaultBudget: 10,
    darkMode: true,
    createdAt: Date.now(),
  });
  batch.set(db.doc(`groups/${groupId}/_meta/auth`), {
    salt,
    hash,
    version: 1,
  });
  batch.set(db.doc(`groups/${groupId}/members/${uid}`), {
    joinedAt: Date.now(),
    uid,
  });
  await batch.commit();

  return { ok: true };
});

// ─── joinGroup ──────────────────────────────────────────
export const joinGroup = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const groupId = requireGroupId((request.data as { groupId?: unknown })?.groupId);
  const password = requirePassword((request.data as { password?: unknown })?.password);

  const groupRef = db.doc(`groups/${groupId}`);
  const groupSnap = await groupRef.get();
  if (!groupSnap.exists) {
    throw new HttpsError("not-found", "Group not found");
  }

  await verifyPassword(groupId, password);

  await db
    .doc(`groups/${groupId}/members/${uid}`)
    .set({ joinedAt: Date.now(), uid }, { merge: true });

  return { ok: true };
});

// ─── listMyGroups ───────────────────────────────────────
// Returns every groupId the caller is a member of. Uses a collectionGroup
// query over members docs where the `uid` field equals the caller's uid.
// Requires a single-field collection-group index on members.uid (defined
// in firestore.indexes.json).
export const listMyGroups = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const snap = await db
    .collectionGroup("members")
    .where("uid", "==", uid)
    .get();
  const groupIds = snap.docs
    .map((d) => d.ref.parent.parent?.id)
    .filter((x): x is string => !!x);
  logger.info("listMyGroups", {
    uid,
    email: request.auth?.token?.email ?? null,
    isAnonymous: request.auth?.token?.firebase?.sign_in_provider === "anonymous",
    signInProvider: request.auth?.token?.firebase?.sign_in_provider ?? null,
    groupIds,
    count: groupIds.length,
  });
  return { groupIds };
});

// ─── changePassword ─────────────────────────────────────
export const changePassword = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const groupId = requireGroupId((request.data as { groupId?: unknown })?.groupId);
  const oldPassword = requirePassword(
    (request.data as { oldPassword?: unknown })?.oldPassword,
    "oldPassword",
  );
  const newPassword = requirePassword(
    (request.data as { newPassword?: unknown })?.newPassword,
    "newPassword",
  );

  await requireMember(groupId, uid);
  await verifyPassword(groupId, oldPassword);

  const newSalt = randomSalt();
  const newHash = hashPassword(newPassword, newSalt);
  await db.doc(`groups/${groupId}/_meta/auth`).set({
    salt: newSalt,
    hash: newHash,
    version: 1,
  });

  return { ok: true };
});

// ─── notifyUpcomingBirthdays ────────────────────────────
//
// Läuft täglich 08:00 Europe/Vienna, sucht in jeder Gruppe nach Personen
// deren Geburtstag heute genau STACK_WINDOW_DAYS Tage entfernt ist (sie
// rutschen also heute frisch in den 30-Tage-Stack), und schickt eine
// Web-Push-Notification an alle Member-Tokens deren Member-Doc
// `notifyStack: true` hat.
function getTodayInVienna(): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA gibt YYYY-MM-DD aus.
  const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
  return { y, m, d };
}

function daysUntilBirthday(birthday: string): number {
  const parts = birthday.split("-");
  const month = parts.length === 3 ? +parts[1] : +parts[0];
  const day = parts.length === 3 ? +parts[2] : +parts[1];
  if (!month || !day) return Number.POSITIVE_INFINITY;
  const { y, m, d } = getTodayInVienna();
  const todayUtc = Date.UTC(y, m - 1, d);
  let candidate = Date.UTC(y, month - 1, day);
  if (candidate < todayUtc) candidate = Date.UTC(y + 1, month - 1, day);
  return Math.round((candidate - todayUtc) / 86400000);
}

interface PersonLike {
  id: string;
  name: string;
  birthday: string;
}

export const notifyUpcomingBirthdays = onSchedule(
  {
    region: REGION,
    schedule: "0 8 * * *",
    timeZone: "Europe/Vienna",
  },
  async () => {
    const messaging = admin.messaging();
    const groupRefs = await db.collection("groups").listDocuments();
    let totalSent = 0;
    let totalGroups = 0;

    for (const groupRef of groupRefs) {
      const groupId = groupRef.id;
      const personsSnap = await db
        .collection(`groups/${groupId}/persons`)
        .get();
      const due: PersonLike[] = [];
      for (const p of personsSnap.docs) {
        const data = p.data() as { name?: string; birthday?: string };
        if (
          typeof data.birthday === "string" &&
          typeof data.name === "string" &&
          daysUntilBirthday(data.birthday) === STACK_WINDOW_DAYS
        ) {
          due.push({ id: p.id, name: data.name, birthday: data.birthday });
        }
      }
      if (due.length === 0) continue;

      const membersSnap = await db
        .collection(`groups/${groupId}/members`)
        .where("notifyStack", "==", true)
        .get();
      const uids = membersSnap.docs.map((d) => d.id);
      if (uids.length === 0) continue;

      const tokenDocs = await Promise.all(
        uids.map((uid) => db.doc(`pushTokens/${uid}`).get()),
      );
      const tokenEntries: { uid: string; token: string }[] = [];
      for (const snap of tokenDocs) {
        if (!snap.exists) continue;
        const data = snap.data() as Record<string, unknown>;
        for (const token of Object.keys(data)) {
          tokenEntries.push({ uid: snap.id, token });
        }
      }
      if (tokenEntries.length === 0) continue;

      const tokens = tokenEntries.map((e) => e.token);
      totalGroups++;
      for (const person of due) {
        const result = await messaging.sendEachForMulticast({
          notification: {
            title: "Geburtstag in 30 Tagen",
            body: `${person.name} rückt in „${groupId}" in den Stack.`,
          },
          data: {
            groupId,
            personId: person.id,
            tag: `gm-stack-${groupId}-${person.id}`,
            url: "/",
          },
          tokens,
        });
        totalSent += result.successCount;

        // Ungültige Tokens (User hat App deinstalliert o.ä.) aufräumen,
        // damit der Pool nicht zumüllt.
        const cleanups: Promise<unknown>[] = [];
        result.responses.forEach((resp, i) => {
          if (resp.success) return;
          const code = resp.error?.code ?? "";
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            const entry = tokenEntries[i];
            cleanups.push(
              db.doc(`pushTokens/${entry.uid}`).update({
                [entry.token]: admin.firestore.FieldValue.delete(),
              }),
            );
          }
        });
        if (cleanups.length > 0) await Promise.all(cleanups);
      }
    }

    logger.info(
      `notifyUpcomingBirthdays: sent ${totalSent} push messages across ${totalGroups} group(s)`,
    );
  },
);

// ─── deleteGroup ────────────────────────────────────────
export const deleteGroup = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const groupId = requireGroupId((request.data as { groupId?: unknown })?.groupId);
  const password = requirePassword((request.data as { password?: unknown })?.password);

  await requireMember(groupId, uid);
  await verifyPassword(groupId, password);

  // Recursive delete handles all subcollections (persons, gifts,
  // suggestions, wishlist, polls, members, _meta) plus the group doc.
  await db.recursiveDelete(db.doc(`groups/${groupId}`));

  return { ok: true };
});

// ─── Birthday-reminder helpers ──────────────────────────

interface ReminderStage {
  days: number;
  key: "60d" | "30d" | "14d";
  conditional: boolean; // true → only send if wishlist is still empty
}

const REMINDER_STAGES: ReminderStage[] = [
  { days: 60, key: "60d", conditional: false },
  { days: 30, key: "30d", conditional: true },
  { days: 14, key: "14d", conditional: true },
];

const REMINDER_TOLERANCE_DAYS = 2;
const MAGIC_TOKEN_TTL_MS = 7 * 86_400_000;
const UNSUB_TOKEN_TTL_MS = 365 * 86_400_000;

function parseBirthday(bd: string): { month: number; day: number } | null {
  const parts = bd.split("-");
  if (parts.length === 3) {
    const m = +parts[1];
    const d = +parts[2];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { month: m, day: d };
    return null;
  }
  if (parts.length === 2) {
    const m = +parts[0];
    const d = +parts[1];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { month: m, day: d };
    return null;
  }
  return null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function nextBirthdayDate(bd: string, ref: Date): Date | null {
  const parsed = parseBirthday(bd);
  if (!parsed) return null;
  const today = startOfDay(ref);
  const candidate = new Date(today.getFullYear(), parsed.month - 1, parsed.day);
  if (candidate.getTime() < today.getTime()) {
    return new Date(today.getFullYear() + 1, parsed.month - 1, parsed.day);
  }
  return candidate;
}

function daysUntil(bd: string, ref: Date): number | null {
  const next = nextBirthdayDate(bd, ref);
  if (!next) return null;
  return Math.round((next.getTime() - startOfDay(ref).getTime()) / 86_400_000);
}

function birthdayYearFor(bd: string, ref: Date): number | null {
  const next = nextBirthdayDate(bd, ref);
  return next ? next.getFullYear() : null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function signUnsubToken(personId: string, groupId: string): string {
  const exp = Date.now() + UNSUB_TOKEN_TTL_MS;
  const payload = `${groupId}|${personId}|${exp}`;
  const sig = crypto
    .createHmac("sha256", UNSUB_SECRET.value())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

function verifyUnsubToken(
  token: string,
): { personId: string; groupId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    const [groupId, personId, expStr, sig] = parts;
    const exp = +expStr;
    if (!exp || Date.now() > exp) return null;
    const expected = crypto
      .createHmac("sha256", UNSUB_SECRET.value())
      .update(`${groupId}|${personId}|${exp}`)
      .digest("hex");
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    return { groupId, personId };
  } catch {
    return null;
  }
}

function buildBirthdayMail(opts: {
  to: string;
  name: string;
  daysLeft: number;
  magicLink: string;
  unsubLink: string;
}): MailContent {
  const { to, name, daysLeft, magicLink, unsubLink } = opts;
  const safeName = escapeHtml(name);
  const safeMagic = escapeHtml(magicLink);
  const safeUnsub = escapeHtml(unsubLink);
  const subject = `🎂 In ${daysLeft} Tagen ist Geburtstag — magst du eine Wunschliste?`;

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAF7F2;color:#1C1917;padding:24px;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #F0EBE6;">
    <h1 style="font-size:22px;margin:0 0 14px;letter-spacing:-0.01em;">Hi ${safeName} 🎉</h1>
    <p style="font-size:16px;line-height:1.55;color:#44403C;margin:0 0 12px;">
      In <b>${daysLeft} Tagen</b> ist dein Geburtstag.
    </p>
    <p style="font-size:15px;line-height:1.55;color:#57534E;margin:0 0 20px;">
      Deine Familie und Freunde planen schon, was sie dir schenken könnten. Verrate doch in einer kleinen Wunschliste, was du dir wünschst — lose Ideen sind völlig okay.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${safeMagic}"
         style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#6366F1,#7C3AED);color:white;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;">
        Wunschliste öffnen
      </a>
    </p>
    <p style="font-size:13px;color:#78716C;text-align:center;line-height:1.5;margin:0;">
      Der Link führt dich ohne Passwort direkt rein — er ist 7 Tage gültig.
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#A8A29E;margin:20px auto 0;line-height:1.6;max-width:560px;">
    Du bekommst diese Mail, weil dich jemand in der Geschenke-Manager-App eingetragen hat.<br>
    <a href="${safeUnsub}" style="color:#A8A29E;">Mail-Erinnerungen abbestellen</a>
  </p>
</body></html>`;

  const text = `Hi ${name},

in ${daysLeft} Tagen ist dein Geburtstag. Magst du eine Wunschliste schreiben? Lose Ideen reichen schon.

Wunschliste öffnen (ohne Passwort, 7 Tage gültig):
${magicLink}

— Geschenke-Manager

Mail-Erinnerungen abbestellen:
${unsubLink}`;

  return { to, subject, html, text };
}

// ─── sendBirthdayReminders (scheduled) ──────────────────
// Runs every day at 09:00 Europe/Berlin. Walks every persons doc across
// every group, looks at days-until-next-birthday, and if it hits one of
// the stage thresholds (60/30/14 ± tolerance) and the per-year marker
// hasn't been set yet, queues a mail to the Trigger-Email extension.
export const sendBirthdayReminders = onSchedule(
  {
    region: REGION,
    schedule: "every day 09:00",
    timeZone: "Europe/Berlin",
    secrets: [UNSUB_SECRET, BREVO_SMTP_USER, BREVO_SMTP_PASS],
  },
  async () => {
    const today = new Date();
    const personsSnap = await db.collectionGroup("persons").get();
    let queued = 0;
    let scanned = 0;

    for (const personDoc of personsSnap.docs) {
      scanned += 1;
      const person = personDoc.data() as {
        name?: string;
        birthday?: string;
        email?: string;
        emailOptIn?: boolean;
        notificationsSent?: Record<string, number>;
      };

      const email = person.email?.trim();
      if (!email) continue;
      if (person.emailOptIn === false) continue;
      if (!person.birthday) continue;

      const groupId = personDoc.ref.parent.parent?.id;
      if (!groupId) continue;

      const daysLeft = daysUntil(person.birthday, today);
      const bdYear = birthdayYearFor(person.birthday, today);
      if (daysLeft == null || bdYear == null) continue;

      for (const stage of REMINDER_STAGES) {
        if (Math.abs(daysLeft - stage.days) > REMINDER_TOLERANCE_DAYS) continue;

        const marker = `reminder-${stage.key}-${bdYear}`;
        if (person.notificationsSent?.[marker]) continue;

        // Conditional stages skip if a wishlist already exists.
        if (stage.conditional) {
          const wlSnap = await db
            .collection(`groups/${groupId}/wishlist`)
            .where("personId", "==", personDoc.id)
            .limit(1)
            .get();
          if (!wlSnap.empty) {
            // Still mark as "sent" so we don't re-check next day.
            await personDoc.ref.update({
              [`notificationsSent.${marker}`]: Date.now(),
            });
            continue;
          }
        }

        // Magic token (single-use, 7d).
        const magicToken = crypto.randomBytes(32).toString("hex");
        const now = Date.now();
        await db.doc(`magic_tokens/${magicToken}`).set({
          groupId,
          personId: personDoc.id,
          scope: "wishlist",
          createdAt: now,
          expiresAt: now + MAGIC_TOKEN_TTL_MS,
        });

        const magicLink = `${APP_URL}/m/${magicToken}`;
        const unsubLink = `${APP_URL}/unsub?t=${signUnsubToken(personDoc.id, groupId)}`;

        try {
          await sendMailViaSmtp(
            buildBirthdayMail({
              to: email,
              name: person.name ?? "",
              daysLeft: stage.days,
              magicLink,
              unsubLink,
            }),
          );
        } catch (err) {
          console.error(
            `Failed to send reminder for ${personDoc.id} in ${groupId}:`,
            err,
          );
          // Don't mark sent — try again on next cron tick.
          continue;
        }

        await personDoc.ref.update({
          [`notificationsSent.${marker}`]: now,
        });

        queued += 1;
        // Send at most one mail per person per run.
        break;
      }
    }

    console.log(
      `birthday-reminders: scanned ${scanned} persons, queued ${queued} mails`,
    );
  },
);

// ─── consumeMagicToken ──────────────────────────────────
// Frontend hits /m/:token → calls this with { token }. We validate, mark
// the token consumed, ensure the caller's anonymous UID is a member of
// the target group, and return { groupId, personId } so the frontend
// can switch into that group and pre-select the person as the identity.
export const consumeMagicToken = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const tokenStr = (request.data as { token?: unknown })?.token;
  if (typeof tokenStr !== "string" || !/^[a-f0-9]{64}$/.test(tokenStr)) {
    throw new HttpsError("invalid-argument", "Invalid token format");
  }

  const tokenRef = db.doc(`magic_tokens/${tokenStr}`);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(tokenRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Token unknown or already cleaned up");
    }
    const data = snap.data() as {
      groupId?: string;
      personId?: string;
      expiresAt?: number;
      consumedAt?: number;
    };
    if (typeof data.groupId !== "string" || typeof data.personId !== "string") {
      throw new HttpsError("internal", "Token payload malformed");
    }
    if (data.consumedAt) {
      throw new HttpsError("failed-precondition", "Token already used");
    }
    if (typeof data.expiresAt === "number" && Date.now() > data.expiresAt) {
      throw new HttpsError("deadline-exceeded", "Token expired");
    }
    tx.update(tokenRef, { consumedAt: Date.now(), consumedBy: uid });
    return { groupId: data.groupId, personId: data.personId };
  });

  // Make caller a member (idempotent — merge:true).
  await db
    .doc(`groups/${result.groupId}/members/${uid}`)
    .set(
      { joinedAt: Date.now(), uid, viaMagicLink: true },
      { merge: true },
    );

  return result;
});

// ─── unsubscribeEmail (HTTP, HMAC-signed token) ─────────
// Public HTTPS endpoint linked from every reminder mail. No auth — the
// token in the URL is itself the credential (HMAC-signed, can't be
// forged without UNSUB_SECRET).
export const unsubscribeEmail = onRequest(
  { region: REGION, secrets: [UNSUB_SECRET], cors: false },
  async (req, res) => {
    const t = typeof req.query.t === "string" ? req.query.t : "";
    const decoded = t ? verifyUnsubToken(t) : null;

    if (!decoded) {
      res.status(400).type("html").send(
        renderHtmlPage(
          "Link ungültig",
          "Dieser Abmelde-Link ist abgelaufen oder ungültig. Falls du weiterhin Erinnerungen bekommen willst, brauchst du nichts tun.",
        ),
      );
      return;
    }

    try {
      await db
        .doc(`groups/${decoded.groupId}/persons/${decoded.personId}`)
        .update({ emailOptIn: false });
    } catch (err) {
      console.warn("unsubscribe: person update failed", err);
      // Person/group may have been deleted — still show success so the
      // user isn't worried.
    }

    res.status(200).type("html").send(
      renderHtmlPage(
        "Abgemeldet",
        "Du bekommst keine Geburtstags-Erinnerungen mehr für diese Person. Falls das ein Versehen war, kannst du die Mail-Adresse in der App jederzeit neu eintragen.",
      ),
    );
  },
);

// ─── sendTestMail (manual mail-pipeline check) ──────────
// User-facing knob in the Person profile. Sends one immediate mail to
// person.email so they can confirm the whole chain works (Trigger Email
// extension, SMTP credentials, sender verification). Caller must be a
// member of the group.
export const sendTestMail = onCall(
  { region: REGION, secrets: [UNSUB_SECRET, BREVO_SMTP_USER, BREVO_SMTP_PASS] },
  async (request) => {
    const uid = requireAuth(request.auth);
    const groupId = requireGroupId(
      (request.data as { groupId?: unknown })?.groupId,
    );
    const personId = (request.data as { personId?: unknown })?.personId;
    if (typeof personId !== "string" || personId.length === 0) {
      throw new HttpsError("invalid-argument", "personId required");
    }

    await requireMember(groupId, uid);

    const personSnap = await db.doc(`groups/${groupId}/persons/${personId}`).get();
    if (!personSnap.exists) {
      throw new HttpsError("not-found", "Person not found");
    }
    const person = personSnap.data() as {
      name?: string;
      email?: string;
    };
    const email = person.email?.trim();
    if (!email) {
      throw new HttpsError(
        "failed-precondition",
        "Person hat keine E-Mail hinterlegt",
      );
    }

    // Issue a real magic token so the test mail's link is a working
    // wishlist-shortcut, not a dead URL.
    const magicToken = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    await db.doc(`magic_tokens/${magicToken}`).set({
      groupId,
      personId,
      scope: "wishlist",
      createdAt: now,
      expiresAt: now + MAGIC_TOKEN_TTL_MS,
    });
    const magicLink = `${APP_URL}/m/${magicToken}`;
    const unsubLink = `${APP_URL}/unsub?t=${signUnsubToken(personId, groupId)}`;

    const safeName = escapeHtml(person.name ?? "");
    const safeMagic = escapeHtml(magicLink);
    const safeUnsub = escapeHtml(unsubLink);

    console.log(`sendTestMail: person=${personId} email=${email}`);
    try {
      await sendMailViaSmtp({
        to: email,
        subject: "🧪 Test-Mail vom Geschenke-Manager",
        html: `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Test-Mail</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAF7F2;color:#1C1917;padding:24px;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #F0EBE6;">
    <h1 style="font-size:22px;margin:0 0 14px;letter-spacing:-0.01em;">Hi ${safeName} 👋</h1>
    <p style="font-size:16px;line-height:1.55;color:#44403C;margin:0 0 12px;">
      Diese Test-Mail bestätigt, dass die Geburtstags-Erinnerungen für deine Adresse funktionieren.
    </p>
    <p style="font-size:15px;line-height:1.55;color:#57534E;margin:0 0 20px;">
      Wenn du das hier liest, läuft alles richtig. Vor deinem Geburtstag bekommst du automatisch eine Erinnerung mit Link zur Wunschliste.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${safeMagic}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#6366F1,#7C3AED);color:white;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;">
        Test-Link öffnen
      </a>
    </p>
    <p style="font-size:13px;color:#78716C;text-align:center;line-height:1.5;margin:0;">
      Der Link funktioniert wie der echte später — direkt rein in die Wunschliste, ohne Passwort. 7 Tage gültig.
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#A8A29E;margin:20px auto 0;line-height:1.6;max-width:560px;">
    Test-Mail manuell ausgelöst aus deiner Geschenke-Manager-App.<br>
    <a href="${safeUnsub}" style="color:#A8A29E;">Mail-Erinnerungen abbestellen</a>
  </p>
</body></html>`,
        text: `Hi ${person.name ?? ""},

das ist eine Test-Mail vom Geschenke-Manager.

Wenn du das hier liest, funktionieren die Geburtstags-Erinnerungen für deine Adresse. Vor deinem Geburtstag bekommst du automatisch einen Reminder.

Test-Link (öffnet Wunschliste, ohne Passwort, 7 Tage gültig):
${magicLink}

Abbestellen: ${unsubLink}`,
      });
    } catch (err) {
      console.error("sendTestMail SMTP error:", err);
      const msg = (err as { message?: string })?.message ?? String(err);
      throw new HttpsError("internal", `SMTP-Fehler: ${msg}`);
    }

    return { ok: true };
  },
);

function renderHtmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:64px auto;padding:32px;text-align:center;background:#FAF7F2;color:#1C1917;}
  h1{font-size:22px;margin:0 0 14px;letter-spacing:-0.01em;}
  p{font-size:15px;color:#57534E;line-height:1.55;}
  a{color:#7C3AED;}
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(body)}</p>
  <p style="margin-top:32px;font-size:13px;">
    <a href="${APP_URL}">Zurück zur App</a>
  </p>
</body></html>`;
}
