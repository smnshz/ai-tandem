import { KEYS, load, save } from './storage';
import type { LookupResult } from './types';

/**
 * Nachschlagen kostet einen API-Call, also merken wir uns die Ergebnisse.
 * Der Cache ist bewusst kontextfrei (Schlüssel = Sprache + Auswahl);
 * mit "Neu laden" im Popup lässt sich ein frischer Lookup erzwingen.
 */
type CacheMap = Record<string, LookupResult>;

const MAX_ENTRIES = 500;

let cache: CacheMap | null = null;

function all(): CacheMap {
  if (!cache) cache = load<CacheMap>(KEYS.lookupCache, {});
  return cache;
}

function keyFor(lang: string, selection: string): string {
  return `${lang}::${selection}`;
}

export function getCached(lang: string, selection: string): LookupResult | undefined {
  return all()[keyFor(lang, selection)];
}

export function putCached(lang: string, selection: string, result: LookupResult): void {
  const map = all();
  map[keyFor(lang, selection)] = result;

  const keys = Object.keys(map);
  if (keys.length > MAX_ENTRIES) {
    for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete map[k];
  }
  save(KEYS.lookupCache, map);
}

export function clearCache(): void {
  cache = {};
  save(KEYS.lookupCache, cache);
}
