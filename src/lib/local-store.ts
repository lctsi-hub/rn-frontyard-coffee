// Tiny state store persisted to localStorage, read with useSyncExternalStore.
// The server (and the first hydration pass) always sees `initial`; the saved
// value loads in the browser right after, so there are no hydration mismatches.
import { useSyncExternalStore } from "react";

type Options<T> = {
  key: string;
  initial: T;
  /** "session" forgets the value when the browser tab is closed. */
  storage?: "local" | "session";
  /** Turn stored JSON back into a value, or return null if it isn't valid. */
  parse: (stored: unknown) => T | null;
  /** Saved values older than this are ignored. */
  maxAgeMs?: number;
};

export function createLocalStore<T>({ key, initial, storage = "local", parse, maxAgeMs }: Options<T>) {
  let state = initial;
  let loaded = false;
  const listeners = new Set<() => void>();
  const backend = () => (storage === "session" ? window.sessionStorage : window.localStorage);

  function read(): T {
    try {
      const raw = backend().getItem(key);
      if (!raw) return initial;
      const saved = JSON.parse(raw) as { value?: unknown; savedAt?: unknown };
      if (maxAgeMs && (typeof saved.savedAt !== "number" || Date.now() - saved.savedAt > maxAgeMs)) return initial;
      return parse(saved.value) ?? initial;
    } catch {
      return initial;
    }
  }

  function ensureLoaded() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    state = read();
  }

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== key) return;
    state = read();
    notify();
  }

  function subscribe(listener: () => void) {
    ensureLoaded();
    listeners.add(listener);
    if (listeners.size === 1) window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) window.removeEventListener("storage", onStorage);
    };
  }

  function get() {
    ensureLoaded();
    return state;
  }

  function set(next: T) {
    state = next;
    try {
      backend().setItem(key, JSON.stringify({ value: next, savedAt: Date.now() }));
    } catch {
      // Private mode / storage full: keep working in memory for this visit.
    }
    notify();
  }

  function useValue() {
    return useSyncExternalStore(subscribe, get, () => initial);
  }

  return { get, set, useValue };
}
