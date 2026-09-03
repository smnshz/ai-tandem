import type { Area, LookupResult, LookupSegment } from './types';

/**
 * Offline-Wörterbuch (HanDeDict, CC-BY-SA 3.0), gebaut von scripts/build-dict.mjs.
 * Deckt Chinesisch → Deutsch ab. Ist die Datei nicht da (Build ohne
 * `npm run dict`), verhält sich die App so, als gäbe es kein Wörterbuch,
 * und fragt für jedes Nachschlagen die KI.
 */
export interface DictEntry {
  word: string;
  reading: string;
  senses: string[];
}

export interface DictMeta {
  name: string;
  entries: number;
  dataStamp: string;
  license: string;
  source: string;
}

const FILE = 'dict/zh-de.tsv';
const META_FILE = 'dict/meta.json';
/** Längstes Wort im Wörterbuch – Obergrenze für die Zerlegung. */
const MAX_WORD = 4;

let index: Map<string, DictEntry> | null = null;
let meta: DictMeta | null = null;
let loading: Promise<Map<string, DictEntry> | null> | null = null;

export function supportsOffline(area: Area): boolean {
  return area.targetLang.startsWith('zh') && area.nativeLang === 'de';
}

export function dictionaryMeta(): DictMeta | null {
  return meta;
}

export function isLoaded(): boolean {
  return index !== null;
}

async function load(): Promise<Map<string, DictEntry> | null> {
  const base = import.meta.env.BASE_URL;
  const response = await fetch(base + FILE);
  if (!response.ok) return null;
  const text = await response.text();

  const map = new Map<string, DictEntry>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [traditional, simplified, reading, senses] = line.split('\t');
    if (!traditional || !reading || !senses) continue;
    const entry: DictEntry = { word: traditional, reading, senses: senses.split('|') };
    map.set(traditional, entry);
    // Vereinfachte Schreibweise zeigt auf denselben Eintrag, ohne ihn zu überschreiben.
    if (simplified && !map.has(simplified)) map.set(simplified, entry);
  }

  fetch(base + META_FILE)
    .then((res) => (res.ok ? res.json() : null))
    .then((data: DictMeta | null) => {
      meta = data;
    })
    .catch(() => undefined);

  return map;
}

/** Lädt das Wörterbuch einmalig; parallele Aufrufe teilen sich den Ladevorgang. */
export function ensureDictionary(): Promise<Map<string, DictEntry> | null> {
  if (index) return Promise.resolve(index);
  if (!loading) {
    loading = load()
      .then((map) => {
        index = map;
        return map;
      })
      .catch(() => null)
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

const CJK = /[㐀-䶿一-鿿豈-﫿]/u;

/**
 * Zerlegt die Auswahl mit "längster Treffer zuerst" in Wörter.
 * Zeichen ohne Eintrag kommen als `unknown` markiert zurück, damit die UI
 * anbieten kann, den Rest von der KI erklären zu lassen.
 */
export async function lookupOffline(selection: string): Promise<LookupResult | null> {
  const dict = await ensureDictionary();
  if (!dict) return null;

  const chars = Array.from(selection);
  const segments: LookupSegment[] = [];
  let incomplete = false;
  let position = 0;

  while (position < chars.length) {
    const char = chars[position];
    if (!CJK.test(char)) {
      // Satzzeichen und Leerraum überspringen wir stillschweigend.
      position++;
      continue;
    }

    let matched: DictEntry | null = null;
    let matchedLength = 0;
    for (let length = Math.min(MAX_WORD, chars.length - position); length >= 1; length--) {
      const candidate = chars.slice(position, position + length).join('');
      const entry = dict.get(candidate);
      if (entry) {
        matched = entry;
        matchedLength = length;
        break;
      }
    }

    if (matched) {
      segments.push({
        text: chars.slice(position, position + matchedLength).join(''),
        reading: matched.reading,
        meaning: matched.senses.join('; '),
      });
      position += matchedLength;
    } else {
      segments.push({ text: char, reading: '', meaning: 'nicht im Wörterbuch', unknown: true });
      incomplete = true;
      position++;
    }
  }

  if (!segments.length) return null;
  return { query: selection, segments, source: 'dict', incomplete };
}
