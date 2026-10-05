import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true once running in the browser. */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
