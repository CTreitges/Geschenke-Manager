# Claude Design Prompt — Geschenke-Manager

Diesen Prompt 1:1 in Claude Design einfügen für die UI-Generierung.

---

```
Build a mobile-first Progressive Web App in GERMAN called "Geschenke-Manager"
for managing birthday gifts within a friend group. No accounts — trust-based,
gated by a single shared password. Tech: React + TypeScript + Tailwind + shadcn/ui.

GLOBAL DESIGN
- Warm, friendly palette: soft amber/coral primary (#F59E0B → #F97316 gradient),
  muted neutral background (#FAFAF9 light / #1C1917 dark), generous whitespace.
- Mobile-first, max-w-2xl centered on desktop. Min tap target 44px.
- Cards: rounded-2xl, soft shadow, subtle border in dark mode.
- All copy in German. Friendly, casual tone ("Wunschliste", "Du", "Geschenk erhalten").
- Dark mode toggle in settings.
- Use shadcn/ui primitives (Button, Card, Dialog, Tabs, Input, Switch, Sonner toasts).

PAGES

1. /login — Passwort-Gate
   - Centered card, single password input, "Reinkommen"-button. Friendly hero icon.
   - On success store hashed-flag in localStorage, redirect /.

2. / — Home
   - HERO CARD (top): "🎂 Als Nächstes hat Geburtstag …"
     Large name, days-until counter ("in 12 Tagen"), birthday date below.
     Soft amber gradient background. Tap → /person/:id.
     If days <= 3, subtle confetti animation in background.
   - SECTION HEADER: "Aktueller Stack" with badge showing count.
   - STACK LIST: vertical cards, each with:
       • Drag-handle icon left (only here)
       • Person name + birthday date (e.g. "Kevin · 15. Mai")
       • Subtle "vor 3 Tagen in Stack" or "in 12 Tagen Geburtstag"
       • Right: count chip "3 Personen" + budget chip "30 €"
       • Tap → expand inline OR navigate to /gift/:id
   - Sort: oldest entry top, newest bottom. Reorderable via drag (dnd-kit).
   - FAB (floating action button): "+" → Dialog "Geschenk manuell zum Stack hinzufügen"
     (Person-Picker + optional Jahr-Override).

3. /person/:id
   - Header: name, birthday, edit pencil. Back arrow.
   - Tabs: "Wunschliste" | "Geschenke" | "Profil"
   - Wunschliste tab:
       Inline-add input at top ("Was wünschst du dir?"), URL + Preis optional.
       List of items with swipe-to-delete on mobile, edit on tap.
   - Geschenke tab:
       Grouped by year. Each item: status badge (offen/erhalten), tap → /gift/:id.
       "+ Neues Geschenk anlegen" button.
   - Profil tab: name, birthday, email, delete person (confirm dialog).

4. /gift/:id
   - Header: "🎁 Geschenk für Kevin · 2026" + status badge.
   - SECTION "Teilnehmer":
       Chips of all persons. Tap to toggle join (own identity must be picked first
       — see Identity-Picker below). Live budget below: "3 × 10 € = 30 €",
       budget-per-person inline editable.
   - SECTION "Vorschläge":
       List of suggestion cards (title, optional URL link, optional price,
       "von Tim" subtle). Add via input bottom: "Idee teilen…".
   - SECTION "Abstimmung":
       If poll status = none: button "Abstimmung starten" (primary).
       If active: each suggestion gets a radio-style vote button. After voting:
       show ALL voters' names below each suggestion ("Tim, Sara haben gewählt").
       Each person has 1 vote. "Abstimmung beenden"-button. Winner highlighted.
   - BOTTOM CTA: "✓ Geschenk erhalten" — confirm dialog, then closes & removes from stack.

5. /people
   - Grid of person cards (name, birthday, days-until in muted text).
   - Sort dropdown: "Nächster Geburtstag" / "Alphabetisch".
   - "+ Person hinzufügen" FAB → Dialog (Name, Geburtstag, Mail optional).

6. /settings
   - "Wer bin ich?" — current identity picker (changes whose votes/wishlist edits
     are attributed). Persisted in localStorage.
   - Default-Budget für neue Geschenke.
   - Dark Mode Toggle.
   - Mail-Benachrichtigungen (Phase 2 placeholder, "bald verfügbar").
   - Passwort ändern (only if currently authenticated).

CRITICAL UX

- IDENTITY-PICKER: persistent across the app. If no identity set, force pick
  on first action that needs it (vote, add suggestion, toggle participant).
  Tiny avatar/initials chip in top-right of every page showing "Ich: Kevin",
  tap to change.
- PRIVACY BY TAP: stack/people cards show ONLY name + date by default.
  Wishlist, suggestions, votes only visible after entering detail view.
- OPTIMISTIC UPDATES with sonner toasts ("Vorschlag hinzugefügt", "Stimme gespeichert").
- EMPTY STATES with friendly German illustrations:
  ("Noch keine Wünsche — leg los!", "Stack ist leer — alle Geschenke gemacht 🎉")
- DRAG-HANDLES only on / stack list, nowhere else.
- Confirmation dialogs for destructive actions (Person löschen, Geschenk erhalten).

COMPONENTS
- BirthdayHeroCard, StackCard (drag-handle, expandable, status chips)
- PersonCard, WishlistItem (inline-edit, swipe-delete)
- GiftHeader, ParticipantChip (tappable, live-budget reactive)
- SuggestionCard, VoteButton (with voter-list display)
- IdentityPickerDialog, PasswordGate
- AddPersonDialog, AddGiftToStackDialog, ConfirmReceivedDialog

DELIVERABLES
- All pages as separate route files
- Single Theme/Tokens file
- Type-safe component props
- Mocked data — Firestore wiring will be added later
```

---

## Verwendung

1. Diesen Block in Claude Design einfügen
2. Generierten Code als Vite + React-Projekt herunterladen
3. In dieses Repo kopieren
4. Firebase-Wiring + State-Management ergänzen (siehe `PLAN.md` Phase 1)
