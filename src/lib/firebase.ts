import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// initializeFirestore (instead of getFirestore) lets us flip on long-polling
// auto-detect, which avoids "WebChannelConnection RPC Listen stream transport
// errored" failures behind firewalls / corporate proxies / some ad blockers.
// Force long-polling fallback: WebChannel transport fails in some corporate
// networks, ad-blockers, and headless test environments. Long-polling is more
// reliable across environments at a small bandwidth cost.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
