# Geschenke-Manager

Trust-basierte Webapp für die Verwaltung von Geburtstagsgeschenken im Freundeskreis.
Mobile-first, Deutsch, kein klassischer Login — nur ein gemeinsames Passwort.

## Features (geplant)

- 🎂 **Geburtstags-Übersicht** — wer hat als nächstes Geburtstag
- 📚 **Geschenk-Stack** — automatisch ab 30 Tagen vor Geburtstag, manuell erweiterbar, drag & drop sortierbar
- 🎁 **Wunschlisten** pro Person
- 👥 **Teilnehmer-Verwaltung** — wer macht bei welchem Geschenk mit, mit Live-Budget-Berechnung
- 💡 **Vorschlagsliste + Abstimmung** pro Geschenk (1 Stimme p.P., transparent — wer hat was gewählt)
- 🔒 **Privacy by tap** — Details erst nach Klick sichtbar
- 📧 **Mail-Benachrichtigungen** (Phase 2) — z.B. „6 Wochen vor deinem Geburtstag → Wunschliste anlegen"

## Tech-Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend / DB:** Firebase Firestore
- **Hosting:** Firebase Hosting (kostenlos im Spark-Plan)
- **Cron + Mails (Phase 2):** Firebase Cloud Functions (Blaze-Plan mit Free-Tier)
- **Drag & Drop:** dnd-kit
- **Routing:** React Router

## Setup (TODO)

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install firebase react-router-dom @dnd-kit/core @dnd-kit/sortable
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

## Status

🚧 **Planung läuft** — siehe [PLAN.md](./PLAN.md)
