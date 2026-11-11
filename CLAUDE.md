# Geschenke-Manager — Claude-Kontext

> Globale Regeln: `~/.claude/CLAUDE.md` + `~/.claude/rules/`. Hier nur Projekt-Spezifisches. Stand 2026-11-10 (project-init).

## Zweck
Trust-basierte Webapp (PWA, mobile-first, Deutsch) für Geburtstagsgeschenke im Freundeskreis: Geschenk-Stack, Wunschlisten, Teilnehmer mit Budget, Abstimmungen; kein Login, nur ein gemeinsames Passwort.

## Stack
- Vite + React 18 + TypeScript + Tailwind + shadcn/ui; dnd-kit, React Router; Einstieg `src/main.tsx`, `src/App.tsx`.
- Firebase: Firestore (`firestore.rules`, `firestore.indexes.json`), Hosting, Cloud Functions in `functions/` (Node 22, Mails, Push, Sweeps).
- Datenmodell und Entscheidungen: `PLAN.md` (README ist noch Planungsstand).

## Befehle
| Zweck | Befehl |
|---|---|
| Tests | `npm test` (vitest) · Functions: `npm --prefix functions run build && npm --prefix functions test` |
| Rules-Tests | `npm run test:rules` (Firestore-Emulator, `--project demo-geschenke`) |
| E2E | `npm run e2e` (Emulatoren auth, firestore, functions; Playwright `e2e/playwright.config.ts`) |
| Lint | `npm run lint` |
| Build | `npx tsc -b && npm run build` |
| Start (Dev) | `npm run dev` |
| Design-Check | `npm run check:design` |

## Repo-Etikette
- Default-Branch `main`; Tests neben dem Code (`src/**/*.test.ts`), Functions-Tests ebenso neben dem Code (`functions/src/**/*.test.ts`, Helfer in `functions/test/`), E2E `e2e/tests/`.
- Emulator-Läufe nur mit `demo-geschenke`; die `pre*`/`post*`-Scripts räumen Emulator-Reste (`e2e/emu-cleanup.mjs`).

## Projekt-Gotchas
- Produktion `geschenke-manager-ec19e`; Deploy nur nach Christofs OK und nach `DEPLOY.md`, Befehle immer mit `--project geschenke-manager-ec19e`.
- **Nie `firebase deploy` ohne `--only`.** Die Extension `firestore-send-email` steht nur in `.firebaserc`, nicht in `firebase.json` – ein Voll-Deploy will sie löschen.
- **Jede Lösch-Frage der CLI mit „Nein“ beantworten** (Indizes, Functions, Extension).
- Echte `VITE_FIREBASE_*`-Werte nur in `.env.local`, `MAIL_FROM` nur in `functions/.env` (beide gitignored); Vorlage `.env.local.example`.

## Doku
- `PLAN.md`, `DEPLOY.md`, `CLAUDE_DESIGN_PROMPT.md` (Design), `.design/`
