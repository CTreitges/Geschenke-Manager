import { useSyncExternalStore } from "react";
import { useGroupId, useIdentity } from "./auth";
import { liveIdentity } from "./identity";
import { subscribe, getSnapshot } from "./storage";
import type { ID } from "./types";

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Sind die Personen der gerade gewählten Gruppe geladen? (Nicht die der vorigen.) */
export function usePersonsReady(): boolean {
  const { personsHydrated, activeGroupId } = useStore();
  const groupId = useGroupId();
  return personsHydrated && !!groupId && activeGroupId === groupId;
}

/**
 * „Wer bist du?“ – nur gültig, wenn die Person noch existiert. Überall dort
 * nutzen, wo Spoiler-Schutz oder Rechte davon abhängen. Das Aufräumen einer
 * veralteten Identität (lokal + Cloud) macht der IdentityProvider.
 */
export function useMyId(): ID | null {
  const raw = useIdentity();
  const { persons } = useStore();
  const ready = usePersonsReady();
  return liveIdentity(raw, { persons, ready });
}
