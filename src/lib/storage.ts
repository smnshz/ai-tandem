/**
 * Persistenz für den POC: alles liegt im localStorage des Browsers.
 * Im privaten Modus (oder wenn der Browser Storage blockt) fällt die App
 * still auf einen In-Memory-Speicher zurück – die Daten sind dann nach dem
 * Schließen des Tabs weg. Das ist für den POC bewusst so.
 *
 * Später: `load`/`save` gegen ein Backend austauschen, der Rest der App
 * kennt den Speicherort nicht.
 */

const PREFIX = 'ai-tandem.v1.';

const memory = new Map<string, string>();

let available: boolean | null = null;

function storageAvailable(): boolean {
  if (available !== null) return available;
  try {
    const probe = PREFIX + '__probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function isPersistent(): boolean {
  return storageAvailable();
}

export function load<T>(key: string, fallback: T): T {
  const full = PREFIX + key;
  try {
    const raw = storageAvailable() ? window.localStorage.getItem(full) : memory.get(full) ?? null;
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  const full = PREFIX + key;
  const raw = JSON.stringify(value);
  try {
    if (storageAvailable()) {
      window.localStorage.setItem(full, raw);
    } else {
      memory.set(full, raw);
    }
  } catch {
    // Quota voll o.ä. – im POC ignorieren wir das bewusst.
    memory.set(full, raw);
  }
}

export function remove(key: string): void {
  const full = PREFIX + key;
  try {
    window.localStorage.removeItem(full);
  } catch {
    /* ignorieren */
  }
  memory.delete(full);
}

export const KEYS = {
  areas: 'areas',
  chats: 'chats',
  settings: 'settings',
  lookupCache: 'lookupCache',
  activeArea: 'activeArea',
  activeChat: 'activeChat',
} as const;
