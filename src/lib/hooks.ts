import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot } from "./storage";

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
