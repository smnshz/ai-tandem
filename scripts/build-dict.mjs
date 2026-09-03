/**
 * Baut das mitgelieferte Offline-Wörterbuch aus HanDeDict.
 *
 *   node scripts/build-dict.mjs
 *
 * Quelle: https://github.com/gugray/HanDeDict (CC-BY-SA 3.0, nächtlich aktualisiert)
 * Ergebnis: public/dict/zh-de.tsv + public/dict/meta.json
 *
 * Die Rohdatei ist ~60 MB und enthält Änderungshistorie, Beispielsätze und
 * lange Bedeutungslisten. Wir behalten nur, was für ein Tap-Wörterbuch zählt:
 * Einträge bis MAX_HEADWORD Zeichen, je bis zu MAX_SENSES gekürzte Bedeutungen.
 */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SOURCE_URL = 'https://raw.githubusercontent.com/gugray/HanDeDict/master/handedict.u8';
const CACHE = join(ROOT, 'node_modules', '.cache', 'handedict.u8');
const OUT_DIR = join(ROOT, 'public', 'dict');

const MAX_HEADWORD = 4; // längere Auswahlen zerlegt die App aus kürzeren Einträgen
const MAX_SENSES = 3;
const MAX_SENSE_LENGTH = 80;

const TONE_MARKS = {
  a: ['ā', 'á', 'ǎ', 'à', 'a'],
  e: ['ē', 'é', 'ě', 'è', 'e'],
  i: ['ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['ō', 'ó', 'ǒ', 'ò', 'o'],
  u: ['ū', 'ú', 'ǔ', 'ù', 'u'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};

/** "ni3 hao3" -> "nǐ hǎo" */
function toToneMarks(numbered) {
  return numbered
    .split(/\s+/)
    .map((syllable) => {
      const match = /^([a-zA-ZüÜ:]+)([1-5])$/.exec(syllable);
      if (!match) return syllable;
      const [, letters, toneDigit] = match;
      const tone = Number(toneDigit) - 1;
      const base = letters.replace(/u:/g, 'ü').replace(/v/g, 'ü').toLowerCase();
      if (tone === 4) return base; // neutraler Ton: kein Zeichen

      // Regel: a und e bekommen den Ton, bei "ou" das o, sonst der letzte Vokal.
      let target = -1;
      if (base.includes('a')) target = base.indexOf('a');
      else if (base.includes('e')) target = base.indexOf('e');
      else if (base.includes('ou')) target = base.indexOf('o');
      else {
        for (let i = base.length - 1; i >= 0; i--) {
          if ('aeiouü'.includes(base[i])) {
            target = i;
            break;
          }
        }
      }
      if (target === -1) return base;
      const vowel = base[target];
      const marked = TONE_MARKS[vowel]?.[tone] ?? vowel;
      return base.slice(0, target) + marked + base.slice(target + 1);
    })
    .join(' ');
}

/** Beispielsätze, Redaktionsmarker und Doppelspatien raus. */
function cleanSense(raw) {
  let sense = raw
    .replace(/\s*Bsp\.:.*$/s, '')
    .replace(/\(u\.E\.\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[;,]\s*$/, '')
    .trim();
  if (sense.length > MAX_SENSE_LENGTH) {
    const cut = sense.lastIndexOf(' ', MAX_SENSE_LENGTH);
    sense = sense.slice(0, cut > 40 ? cut : MAX_SENSE_LENGTH).trim() + '…';
  }
  return sense;
}

async function fetchSource() {
  try {
    await stat(CACHE);
    console.log('Nutze zwischengespeicherte Quelldatei:', CACHE);
    return readFile(CACHE, 'utf8');
  } catch {
    /* nicht im Cache – herunterladen */
  }
  console.log('Lade HanDeDict …', SOURCE_URL);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Download fehlgeschlagen: ${response.status} ${response.statusText}`);
  const text = await response.text();
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, text);
  return text;
}

const ENTRY = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/;

async function main() {
  // `--if-missing` macht das Skript build-tauglich: existiert das Wörterbuch
  // schon, passiert nichts; scheitert der Download, läuft der Build trotzdem
  // durch – die App fällt dann eben auf KI-Lookups zurück.
  const ifMissing = process.argv.includes('--if-missing');
  if (ifMissing) {
    try {
      await stat(join(OUT_DIR, 'zh-de.tsv'));
      console.log('Wörterbuch ist schon gebaut – übersprungen.');
      return;
    } catch {
      /* noch nicht da – bauen */
    }
  }

  const raw = await fetchSource();
  const lines = raw.split('\n');

  let dataStamp = '';
  const entries = new Map();
  let skippedLong = 0;

  for (const line of lines) {
    if (line.startsWith('#')) {
      const stamp = /^#\s*Datenstand:\s*(\S+)/.exec(line);
      if (stamp) dataStamp = stamp[1];
      continue;
    }
    const match = ENTRY.exec(line.trim());
    if (!match) continue;

    const [, traditional, simplified, pinyin, body] = match;
    if ([...traditional].length > MAX_HEADWORD) {
      skippedLong++;
      continue;
    }

    const senses = body
      .split('/')
      .map(cleanSense)
      .filter(Boolean)
      .slice(0, MAX_SENSES);
    if (!senses.length) continue;

    // Mehrere Lesarten desselben Wortes: erste gewinnt, weitere Töne anhängen.
    const key = traditional;
    const value = {
      traditional,
      simplified,
      reading: toToneMarks(pinyin),
      senses,
    };
    const existing = entries.get(key);
    if (!existing) {
      entries.set(key, value);
    } else if (existing.reading !== value.reading && existing.senses.length < MAX_SENSES) {
      existing.senses = [...existing.senses, `${value.reading}: ${value.senses[0]}`].slice(0, MAX_SENSES);
    }
  }

  const rows = [...entries.values()].map((entry) =>
    [
      entry.traditional,
      entry.simplified === entry.traditional ? '' : entry.simplified,
      entry.reading,
      entry.senses.join('|'),
    ].join('\t'),
  );

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'zh-de.tsv'), rows.join('\n') + '\n');
  await writeFile(
    join(OUT_DIR, 'meta.json'),
    JSON.stringify(
      {
        name: 'HanDeDict',
        entries: rows.length,
        dataStamp,
        license: 'CC-BY-SA 3.0',
        source: 'https://github.com/gugray/HanDeDict',
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );

  const bytes = rows.reduce((sum, row) => sum + Buffer.byteLength(row) + 1, 0);
  console.log(
    `${rows.length} Einträge geschrieben (${(bytes / 1024 / 1024).toFixed(1)} MB), ` +
      `${skippedLong} lange Einträge übersprungen, Datenstand ${dataStamp || 'unbekannt'}`,
  );
}

main().catch((error) => {
  console.error(error);
  // Ohne Wörterbuch ist die App nutzbar, nur eben nicht offline.
  process.exit(process.argv.includes('--if-missing') ? 0 : 1);
});
