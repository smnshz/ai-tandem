import type { Area } from './types';
import { getLanguage } from './languages';

/**
 * Baut den System-Prompt für ein Tandem-Gespräch: der Freitext des Nutzers
 * (aus dem Bereich) plus die Regeln, die das Tandem-Verhalten ausmachen.
 */
export function buildSystemPrompt(area: Area): string {
  const target = getLanguage(area.targetLang);
  const native = getLanguage(area.nativeLang);
  const userPart = area.systemPrompt.trim();

  return [
    `Du bist mein Sprachtandem-Partner. Ich lerne ${target.label}, meine Muttersprache ist ${native.label}.`,
    '',
    '# Kontext und Rolle (vom Nutzer vorgegeben)',
    userPart || '(Kein besonderer Kontext vorgegeben – wähle selbst eine passende, alltagsnahe Rolle.)',
    '',
    '# Regeln',
    `- Antworte grundsätzlich auf ${target.label}.`,
    '- Übernimm eine konkrete Rolle/Persona: entweder die aus dem Kontext oder eine, die sich daraus natürlich ergibt. Bleib dann dabei.',
    '- Halte die Antworten kurz und sprechbar: 2 bis 5 Sätze.',
    '- Führe das Gespräch aktiv weiter, meistens mit einer Rückfrage am Ende.',
    `- Schreibe KEINE Umschrift (${target.readingName}) und KEINE Übersetzung nach ${native.label} in deine Antworten. Die App blendet beides ein, wenn ich ein Zeichen antippe.`,
    `- Ausnahme: Wenn ich ausdrücklich auf ${native.label} um eine Erklärung bitte, erkläre auf ${native.label}.`,
    '- Passe dein sprachliches Niveau an das an, was ich schreibe.',
    `- Wenn ich einen deutlichen Fehler mache, hänge genau eine kurze Korrekturzeile an, die mit "✏️" beginnt (auf ${native.label}). Sonst keine Meta-Kommentare.`,
    '- Keine Aufzählungen, keine Überschriften, kein Markdown – reiner Gesprächstext.',
  ].join('\n');
}

/** Kurzer Titel für einen neuen Chat aus der ersten Nachricht. */
export function deriveChatTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Neues Gespräch';
  return clean.length > 32 ? clean.slice(0, 32) + '…' : clean;
}

/** System-Prompt fürs Nachschlagen einer Auswahl. */
export function buildLookupPrompt(area: Area): string {
  const target = getLanguage(area.targetLang);
  const native = getLanguage(area.nativeLang);

  return [
    `Du bist ein Wörterbuch für Lernende von ${target.label}. Die Erklärungssprache ist ${native.label}.`,
    `"reading" ist immer die ${target.readingName}-Umschrift (bei Chinesisch: Pinyin mit Tonzeichen, z.B. "nǐ hǎo").`,
    `"meaning" und "translation" sind immer auf ${native.label}.`,
    'Zerlege die Auswahl in die Wörter, wie sie in der Sprache tatsächlich vorkommen (bei Chinesisch also z.B. 朋友 als ein Wort, nicht als zwei Zeichen).',
    'Ist die Auswahl ein einzelnes Zeichen, gib genau ein Segment zurück.',
    'Nutze den Kontext, um die im Satz passende Bedeutung zu wählen. Halte dich kurz.',
  ].join('\n');
}
