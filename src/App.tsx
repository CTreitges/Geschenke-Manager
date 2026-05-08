import { Routes, Route, Navigate } from "react-router-dom";

function Home() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100">
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight">🎁 Geschenke-Manager</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          Scaffold läuft. Phase 1 (MVP) folgt — siehe <code>PLAN.md</code>.
        </p>
        <div className="mt-8 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-6 shadow-sm">
          <p className="text-sm text-stone-500">
            Nächste Schritte: Firebase-Config in <code>.env.local</code>, Routes hinzufügen,
            Komponenten aus Claude Design integrieren.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
