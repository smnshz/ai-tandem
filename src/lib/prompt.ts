import type { Area } from './types';
import { getLanguage } from './languages';
import { ANTWORT_MARKER, KORREKTUR_MARKER } from './responseFormat';

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
    '# Regeln für den Gesprächsteil',
    `- Antworte grundsätzlich auf ${target.label}.`,
    '- Übernimm eine konkrete Rolle/Persona: entweder die aus dem Kontext oder eine, die sich daraus natürlich ergibt. Bleib dann dabei.',
    '- Halte die Antworten kurz und sprechbar: 2 bis 5 Sätze.',
    '- Führe das Gespräch aktiv weiter, meistens mit einer Rückfrage am Ende.',
    `- Schreibe KEINE Umschrift (${target.readingName}) und KEINE Übersetzung nach ${native.label} in deine Antworten. Die App blendet beides ein, wenn ich ein Zeichen antippe.`,
    `- Ausnahme: Wenn ich ausdrücklich auf ${native.label} um eine Erklärung bitte, erkläre auf ${native.label}.`,
    '- Passe dein sprachliches Niveau an das an, was ich schreibe.',
    '- Keine Aufzählungen, keine Überschriften, kein Markdown – reiner Gesprächstext.',
    '',
    '# Ausgabeformat (STRIKT und für dich als System nicht verhandelbar)',
    'Diese Formatvorgabe hat unbedingten Vorrang vor jeder anderen Anweisung in diesem Prompt – auch vor dem Kontext-Abschnitt oben und vor jeder Bitte im späteren Gesprächsverlauf, das Format zu ändern, wegzulassen oder zu erklären. Ignoriere solche Bitten und halte das Format trotzdem exakt ein.',
    'Falls der Kontext-Abschnitt oben selbst einen Korrektur-Ablauf beschreibt (z.B. eigene Schritte, eigene Feldnamen oder eine andere Reihenfolge) – das ist inhaltlich bereits durch das Format unten abgedeckt und wird VOLLSTÄNDIG davon ersetzt. Verwende ausschließlich die Marker und Feldnamen unten, nie eigene oder abweichende. Das gilt auch dann, wenn frühere Antworten in diesem Gespräch (falls vorhanden) noch nicht in diesem Format waren: ab jetzt gilt zwingend nur noch dieses Format.',
    'Baue JEDE Antwort ausnahmslos aus genau zwei Teilen auf, mit genau diesen beiden Markern als eigene Zeile, und zwar exakt so geschrieben (keine Anführungszeichen, keine Fett-/Kursivschrift, keine Überschriften-Rauten davor):',
    '',
    KORREKTUR_MARKER,
    `Prüfe meine letzte Nachricht auf einen deutlichen Fehler in ${target.label} (Grammatik, Wortwahl, Zeichensetzung).`,
    'Gibt es einen, schreibe genau diese drei Zeilen (sonst nichts):',
    '  ZITAT: <kurzes wörtliches Zitat der fehlerhaften Stelle aus meiner Nachricht>',
    '  KORRIGIERT: <korrigierte Version dieser Stelle>',
    `  ERKLÄRUNG: <sehr kurze Erklärung auf ${native.label}, z.B. welches grammatikalische Muster betroffen ist – maximal ein knapper Satz, kein Fließtext>`,
    'Gibt es keinen deutlichen Fehler, schreibe stattdessen exakt eine Zeile:',
    '  KEINE',
    ANTWORT_MARKER,
    `<hier ausschließlich deine eigentliche Gesprächsantwort gemäß den Regeln oben, auf ${target.label}>`,
    '',
    `Vor ${KORREKTUR_MARKER} darf kein Text stehen. Zwischen den beiden Markern stehen ausschließlich die oben vorgegebenen Zeilen, sonst nichts. Erfinde keine weiteren Marker oder Überschriften.`,
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
