/**
 * Strenges Zwei-Teile-Format, das jede Assistenten-Antwort laut System-Prompt
 * einhalten muss (siehe buildSystemPrompt in prompt.ts): erst eine Korrektur
 * meiner letzten Nachricht, dann – hinter dem ##ANTWORT##-Marker – die
 * eigentliche Gesprächsantwort. Dieses Modul parst genau dieses Format.
 *
 * Das Modell hält Formatvorgaben nicht immer aufs Zeichen genau ein (z.B.
 * wenn der Nutzer-Kontext einen eigenen, abweichend formulierten
 * Korrektur-Ablauf beschreibt). Das Parsen ist deshalb bewusst tolerant:
 * lieber die Korrektur roh anzeigen als sie bei kleinen Abweichungen
 * stillschweigend zu verschlucken.
 */

export const KORREKTUR_MARKER = '##KORREKTUR##';
export const ANTWORT_MARKER = '##ANTWORT##';

export type Correction =
  | { kind: 'fields'; quote: string; corrected: string; explanation: string }
  | { kind: 'raw'; text: string };

export interface ParsedReply {
  /** null = (noch) nicht bekannt, 'none' = kein Fehler, sonst die Korrektur. */
  correction: Correction | 'none' | null;
  /** Der eigentliche Gesprächstext – leer, solange ##ANTWORT## noch nicht angekommen ist. */
  reply: string;
  /** true, sobald der ##ANTWORT##-Marker im Text aufgetaucht ist. */
  replyStarted: boolean;
}

// Marker robust erkennen, auch wenn das Modell sie in Markdown einpackt
// (**##ANTWORT##**, ### Antwort, `##Antwort##` …) statt sie wörtlich zu übernehmen.
function findMarker(raw: string, name: string): { index: number; length: number } | null {
  // Erlaubt sowohl "##NAME##" als auch Varianten wie "**##NAME##**" oder "### Name".
  const re = new RegExp(`^[ \\t]*[*_\`>-]*[ \\t]*#{0,3}[ \\t]*${name}[ \\t]*#{0,3}[ \\t]*[*_\`>-]*[ \\t]*$`, 'im');
  const match = re.exec(raw);
  return match ? { index: match.index, length: match[0].length } : null;
}

// Feldlabel tolerant matchen: führende Markdown-/Aufzählungszeichen und
// Groß-/Kleinschreibung sind egal, solange "LABEL: Wert" erkennbar bleibt.
function matchField(block: string, label: string): string | null {
  const re = new RegExp(`^[ \\t*_>-]*${label}[ \\t]*:[ \\t]*(.*)$`, 'im');
  const match = re.exec(block);
  const value = match?.[1]?.trim().replace(/^[„"“]+|[„"“]+$/g, '').replace(/\*+$/g, '').trim();
  return value || null;
}

/** Parst den (ggf. noch streamenden) Rohtext einer Assistenten-Nachricht. */
export function parseStructuredReply(raw: string): ParsedReply {
  const antwortMarker = findMarker(raw, 'ANTWORT');
  if (!antwortMarker) {
    return { correction: null, reply: '', replyStarted: false };
  }

  const beforeAntwort = raw.slice(0, antwortMarker.index);
  const korrekturMarker = findMarker(beforeAntwort, 'KORREKTUR');
  const correctionBlock = beforeAntwort.slice(korrekturMarker ? korrekturMarker.index + korrekturMarker.length : 0);
  const reply = raw.slice(antwortMarker.index + antwortMarker.length).trim();

  let correction: ParsedReply['correction'] = 'none';
  const trimmedBlock = correctionBlock.trim();
  if (trimmedBlock && !/^[*_>-]*\s*KEINE\b/im.test(trimmedBlock)) {
    const quote = matchField(correctionBlock, 'ZITAT');
    const corrected = matchField(correctionBlock, 'KORRIGIERT(?:E|ES|ER)?');
    const explanation = matchField(correctionBlock, 'ERKL[ÄA]RUNG');
    if (quote || corrected || explanation) {
      correction = { kind: 'fields', quote: quote ?? '', corrected: corrected ?? '', explanation: explanation ?? '' };
    } else {
      // Modell ist inhaltlich der Korrektur-Vorgabe gefolgt, aber nicht den
      // exakten Feldnamen – lieber roh zeigen als die Korrektur verlieren.
      correction = { kind: 'raw', text: trimmedBlock };
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
