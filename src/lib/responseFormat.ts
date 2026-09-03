/**
 * Strenges Zwei-Teile-Format, das jede Assistenten-Antwort laut System-Prompt
 * einhalten muss (siehe buildSystemPrompt in prompt.ts): erst eine Korrektur
 * meiner letzten Nachricht, dann – hinter dem ##ANTWORT##-Marker – die
 * eigentliche Gesprächsantwort. Dieses Modul parst genau dieses Format.
 */

export const KORREKTUR_MARKER = '##KORREKTUR##';
export const ANTWORT_MARKER = '##ANTWORT##';

export interface Correction {
  quote: string;
  corrected: string;
  explanation: string;
}

export interface ParsedReply {
  /** null = (noch) nicht bekannt, 'none' = kein Fehler, sonst die Korrektur. */
  correction: Correction | 'none' | null;
  /** Der eigentliche Gesprächstext – leer, solange ##ANTWORT## noch nicht angekommen ist. */
  reply: string;
  /** true, sobald der ##ANTWORT##-Marker im Text aufgetaucht ist. */
  replyStarted: boolean;
}

function matchField(block: string, label: string): string | null {
  const match = new RegExp(`^\\s*${label}:\\s*(.*)$`, 'im').exec(block);
  const value = match?.[1]?.trim().replace(/^[„"]|[“"]$/g, '');
  return value || null;
}

/** Parst den (ggf. noch streamenden) Rohtext einer Assistenten-Nachricht. */
export function parseStructuredReply(raw: string): ParsedReply {
  const korrekturIdx = raw.indexOf(KORREKTUR_MARKER);
  const antwortIdx = raw.indexOf(ANTWORT_MARKER);

  if (antwortIdx < 0) {
    return { correction: null, reply: '', replyStarted: false };
  }

  const correctionBlock = raw.slice(korrekturIdx >= 0 ? korrekturIdx + KORREKTUR_MARKER.length : 0, antwortIdx);
  const reply = raw.slice(antwortIdx + ANTWORT_MARKER.length).trim();

  let correction: ParsedReply['correction'] = 'none';
  if (!/^\s*KEINE\s*$/im.test(correctionBlock)) {
    const quote = matchField(correctionBlock, 'ZITAT');
    const corrected = matchField(correctionBlock, 'KORRIGIERT');
    const explanation = matchField(correctionBlock, 'ERKLÄRUNG');
    if (quote || corrected || explanation) {
      correction = { quote: quote ?? '', corrected: corrected ?? '', explanation: explanation ?? '' };
    }
  }

  return { correction, reply, replyStarted: true };
}

/**
 * Liefert nur den Gesprächstext einer (ggf. legacy, marker-losen) Nachricht –
 * für Vorlesen, Übersetzen und Nachschlagen, die nie die Korrekturzeilen sehen sollen.
 */
export function replyTextOf(content: string): string {
  const parsed = parseStructuredReply(content);
  return parsed.replyStarted ? parsed.reply : content;
}
