# Geschenke-Manager — Umsetzungsplan

## Bestätigte Anforderungen

| # | Entscheidung |
|---|--------------|
| 1 | **Tech-Stack:** Firebase (Firestore + Hosting), Vite + React + TypeScript |
| 2 | **Auth:** Einfaches geteiltes Passwort (kein User-System) |
| 3 | **Mail:** Phase 2 — erstmal ohne |
| 4 | **Stack-Eintritt:** automatisch 30 Tage vor Geburtstag |
| 5 | **Vergangene Geschenke nachtragen:** in Stack-Reihenfolge |
| 6 | **Mehrere Geschenke** pro Person & Geburtstag möglich |
| 7 | **Abstimmung:** 1 Stimme pro Person, sofort sichtbar, „Wer bin ich"-Picker, transparent |
| 8 | **Sprache:** Deutsch only |

## Datenmodell (Firestore)

```
/persons/{personId}
  name: string
  birthday: string  (ISO yyyy-MM-dd, Jahr egal)
  email?: string
  createdAt: Timestamp

/gifts/{giftId}
  personId: string
  year: number              (z.B. 2026)
  status: "open" | "received"
  budgetPerPerson: number   (Default 10)
  manuallyAdded: boolean
  stackOrder: number        (für manuelles Sortieren)
  enteredStackAt: Timestamp
  receivedAt?: Timestamp

/gifts/{giftId}/participants/{personId}
  joinedAt: Timestamp

/gifts/{giftId}/suggestions/{suggestionId}
  title: string
  url?: string
  price?: number
  suggestedBy: string       (personId)
  createdAt: Timestamp

/gifts/{giftId}/poll
  status: "active" | "closed" | "none"
  startedAt?: Timestamp
  closedAt?: Timestamp

/gifts/{giftId}/votes/{personId}
  suggestionId: string
  votedAt: Timestamp

/settings/global
  sharedPasswordHash: string  (SHA-256 client-side)
  defaultBudget: number
```

## Sicherheit

- **Firestore Security Rules:** Schreib-Operationen nur mit gültigem Custom-Claim oder durchgereichtem Passwort-Hash-Header. Anonymous Auth + Custom-Token-Endpoint via Cloud Function.
- **Vereinfachung Phase 1:** Open Rules + Passwort-Gate im Frontend (Trust-Prinzip respektiert, aber URL-Schutz). Kein produktionssicherer Schutz vor mutwilligem Zugriff — bewusste Entscheidung für Freundeskreis.

## Phasen-Plan

### Phase 1 — MVP (Kern)
**Ziel:** Lokal lauffähig, Firebase angebunden, Kern-Flows funktionieren.

1. Vite + React + TS + Tailwind Setup
2. shadcn/ui-Komponenten installieren (Button, Card, Dialog, Input, Tabs, Toast)
3. Firebase-Projekt anlegen (Firestore + Hosting), `.env.local` mit Config
4. Passwort-Gate (LocalStorage-Flag, SHA-256-Hash gegen `settings/global`)
5. Routes: `/`, `/person/:id`, `/gift/:id`, `/people`, `/settings`
6. Person-CRUD (Liste, anlegen, editieren)
7. Stack-Berechnung (Cloud-side oder client-side: alle offenen Gifts + alle Persons mit Birthday in 30d)
8. Auto-Gift-Creation: bei Person-Anlage und beim Laden ohne offenes Gift im Fenster → neues Gift anlegen
9. Stack-UI mit dnd-kit (Reorder updated `stackOrder`)
10. Wunschliste pro Person
11. Teilnehmer-Toggle + Live-Budget
12. Vorschläge anlegen
13. Abstimmung (Identity-Picker → Vote → sofort sichtbar)
14. „Geschenk erhalten" → status=received, raus aus Stack

### Phase 2 — Mails
1. Firebase Blaze-Plan upgrade
2. Cloud Function `dailyDigest` (Cron 08:00):
   - Personen mit Geburtstag in 42 Tagen → Mail „Wunschliste anlegen"
   - Personen mit Geburtstag in 7 Tagen → Reminder an alle Teilnehmer
3. Cloud Function on-write: neuer Vorschlag, Abstimmung gestartet, Geschenk erhalten → Event-Mail
4. Settings-UI: Mail-Liste + Event-Toggle pro Mail
5. Resend oder Firebase-Extension „Trigger Email" mit SMTP

### Phase 3 — Polishing
- Confetti-Animation bei `daysUntil ≤ 3`
- Dark Mode Toggle
- Suchfunktion in /people
- Geschenk-Archiv (status=received) mit Filter
- PWA-Manifest (Add-to-Homescreen)
- Lighthouse Pass

## Git/GitHub Setup

- ✅ Lokales Repo initialisiert in `C:\Users\Chris\Geschenke-Manager`
- ⏳ Remote auf GitHub anlegen (entscheiden: public/private)
- ⏳ Vercel oder Firebase Hosting auto-deploy via GitHub Action

## Nächste Schritte

1. **GitHub-Remote anlegen** (siehe unten)
2. `npm create vite@latest . -- --template react-ts` ausführen
3. Firebase-Projekt anlegen + Config in `.env.local`
4. `/ultraplan` aus diesem Verzeichnis erneut starten für detaillierten Step-by-Step-Plan
