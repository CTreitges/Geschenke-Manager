# Deploy v1.8.0 (Abstimmungen, Push, Tutorial)

Produktion: Projekt `geschenke-manager-ec19e`. Alle Befehle aus dem Repo-Root, immer mit
`--project geschenke-manager-ec19e`.

> **Nie `firebase deploy` ohne `--only`.** Die Extension `firestore-send-email` steht nur in
> `.firebaserc`, nicht in `firebase.json` – ein Voll-Deploy will sie löschen.
> **Jede Lösch-Frage der CLI mit „Nein“ beantworten** (Indizes, Functions, Extension).

## 1. Vorab-Checks

1. Stand: `git status` sauber, `git log -1` = der freigegebene Commit.
2. Tests/Build grün:
   `npx tsc -b && npm test && npm run build` ·
   `npm --prefix functions run build && npm --prefix functions test`
3. `.env.local` enthält die echten `VITE_FIREBASE_*`-Werte **inkl. `VITE_FIREBASE_VAPID_KEY`**
   (sonst schlägt „Mitteilungen einrichten“ fehl). `npm run build` danach erneut.
4. `firebase --version` (≥ 15) und `node -v` (22.x).
5. `firebase functions:list --project geschenke-manager-ec19e`: deployt sind höchstens die
   14 Exporte aus `functions/src/index.ts` (neu: `sendTestPush`, `onPollWritten`, `sweepPolls`).
6. Indizes vergleichen: `firebase firestore:indexes --project geschenke-manager-ec19e` gegen
   `firestore.indexes.json` (der `_archive`-Index kann aus der Konsole schon existieren).
7. **Alte aktive Abstimmungen ohne Frist zählen** (PUSH-05): Konsole → Firestore →
   Abfrage, Sammlungsgruppe `polls`, `status == "active"`. Jeder Treffer ohne `endsAt` oder mit
   `endsAt <= startedAt` (auch unter Top-Level `/polls`) wird nie per Timeout geschlossen und
   kostet `sweepPolls` ≈ 576 Reads/Tag. Vorher in der App beenden bzw. auf `closed` setzen.
   Dabei auch Docs mit `status == "none"` notieren: die neuen Rules lehnen Updates darauf ab
   (PUSH-06) – beenden/löschen.
8. Cloud-Scheduler-Jobs auf dem Billing-Account zählen
   (`gcloud scheduler jobs list --location=europe-west1`, ggf. je Projekt): `sweepPolls` ist der
   3. Job dieses Projekts; ab dem 4. Job des Accounts ≈ 0,10 USD/Job/Monat.

## 2. Reihenfolge

```bash
# 1) Indizes – danach warten, bis alles aktiv ist
firebase deploy --only firestore:indexes --project geschenke-manager-ec19e
```
Warten, bis in der Konsole (Firestore → Indexe → Einzelfeld) die Ausnahme `polls.status`
(Sammlungsgruppe) und der `_archive`-Index **„Aktiviert“/READY** sind – sonst wirft `sweepPolls`
alle 5 Min `FAILED_PRECONDITION`. Optional:
`gcloud firestore indexes fields describe status --collection-group=polls`.

```bash
# 2) Rules – MUSS vor Hosting: der neue Client schreibt notifyPolls
firebase deploy --only firestore:rules --project geschenke-manager-ec19e

# 3) Hosting (neuer Push-Worker, kompatibel mit dem alten Backend)
npm run build
firebase deploy --only hosting --project geschenke-manager-ec19e
```
Bis Schritt 5 liefert „Test-Push senden“ `not-found` (Function fehlt noch) – erwartet.

**4) Einige Tage warten** (PUSH-03): Bestandsgeräte holen den neuen Push-Worker erst beim
nächsten App-Start. Der alte Worker hat nach einem Idle-Stopp keinen Push-Handler – mehr
Pushes (Start + Erinnerung, Urgency high) würden dort Zwangsmeldungen bzw. auf iOS den
Abo-Entzug auslösen. Wer die App geöffnet hat, ist auf dem neuen Stand.

```bash
# 5) Functions mit Node 22 – spätestens vor dem 30.10.2026 (Abschaltung Node 20)
firebase deploy --only functions --project geschenke-manager-ec19e
```
Aktualisiert alle 14 Functions auf Node 22, legt den Scheduler-Job `sweepPolls` und den
Trigger `onPollWritten` an. Lösch-Prompt → **Nein**.

## 3. Smoke-Test nach Schritt 5

- „Test-Push senden“ auf Android-Chrome und iPhone-Home-Screen-App → Meldung kommt.
- Abstimmung starten → Start-Push nur an Wahlberechtigte (nicht Starter, nie beschenkte Person).
- `firebase functions:log --only sweepPolls,onPollWritten --project geschenke-manager-ec19e`
  ohne Fehler; unter `groups/{gid}/_push` entstehen Marker.
- Nach ein paar Tagen: Anzahl Tokens in `pushTokens` bzw. `removed`-Zahlen beobachten
  (Token-Schwund heilt beim nächsten App-Start).

### Geräte-Testmatrix

| Gerät | Prüfen |
|---|---|
| Android Chrome, installierte App | Test-Push kommt; Abstimmungs-Push kommt; Tipp öffnet die App |
| Android Chrome, Browser-Tab | wie oben |
| iPhone, Home-Screen-App | Einrichten klappt nur dort (im Safari-Tab Hinweis „erst installieren“); Test-Push kommt |
| Desktop Chrome | DevTools → Application → Service Workers → Worker `/firebase-cloud-messaging-push-scope` **stoppen** → Test-Push kommt trotzdem |
| Desktop Chrome, App offen | Meldung erscheint (leise); Klick fokussiert das offene Fenster, **kein zweites Fenster** |
| beliebig | Tipp auf Abstimmungs-Push (`?vote=1`) öffnet direkt das Abstimmungs-Sheet |
| Gerät der beschenkten Person | bekommt **keinen** Abstimmungs-/Stack-Push fürs eigene Geschenk, nur „🎂 In 30 Tagen hast du Geburtstag“ |
| Gerät in 2 Gruppen | „Gruppe auf diesem Gerät verlassen“ → andere Gruppe bekommt weiter Push |
| Google abmelden | danach ohne Neuladen „Einrichten“ → klappt (keine Berechtigungs-Fehlermeldung) |

## 4. Rollback

- **Hosting:** Konsole → Hosting → Release-Verlauf → vorige Version → „Rollback“.
  Der neue Push-Worker bleibt auf Geräten, die ihn schon haben (kompatibel mit altem Backend).
- **Rules:** Konsole → Firestore → Regeln → Verlauf → vorige Version veröffentlichen
  (erst nach Hosting-Rollback, sonst lehnt sie `notifyPolls` des neuen Clients ab).
- **Functions:** vorigen Commit in eigenem Worktree auschecken
  (`git worktree add ../gm-rollback <commit>`), dort `npm --prefix functions ci`, in
  `functions/package.json` `engines.node` auf **22** lassen (Node 20 ist ab 30.10.2026 nicht mehr
  deploybar), dann `firebase deploy --only functions --project geschenke-manager-ec19e`.
  Fragt die CLI nach dem Löschen von Functions: nur „Ja“, wenn ausschließlich
  `sendTestPush`/`onPollWritten`/`sweepPolls` gelistet sind, sonst „Nein“.
- **Indizes** nicht zurückrollen (schaden nicht).
