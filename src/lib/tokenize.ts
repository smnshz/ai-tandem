import type { LanguageDef } from './languages';

export interface Token {
  text: string;
  /** Startindex im Originaltext. */
  start: number;
  /** true = antippbar (Zeichen/Wort der Zielsprache), false = Leerzeichen/Satzzeichen. */
  selectable: boolean;
}

// CJK-Ideogramme, Kana und Hangul – alles, was einzeln antippbar sein soll.
const CJK = /[㐀-䶿一-鿿豈-﫿぀-ゟ゠-ヿ가-힯]/u;

/**
 * Zerlegt einen Text in antippbare Einheiten.
 * - tokenMode 'char': jedes CJK-Zeichen ist eine eigene Einheit.
 * - tokenMode 'word': durch Leerzeichen/Satzzeichen getrennte Wörter.
 * Alles andere (Leerzeichen, Satzzeichen, Emojis) bleibt nicht-antippbar.
 */
export function tokenize(text: string, lang: LanguageDef): Token[] {
  const tokens: Token[] = [];
  const chars = Array.from(text);
  let index = 0;
  let buffer = '';
  let bufferStart = 0;

  const flush = (selectable: boolean) => {
    if (buffer) tokens.push({ text: buffer, start: bufferStart, selectable });
    buffer = '';
  };

  for (const ch of chars) {
    const isCjk = CJK.test(ch);
    const isWordChar = /[\p{L}\p{N}'’-]/u.test(ch);

    if (lang.tokenMode === 'char' && isCjk) {
      flush(false);
      tokens.push({ text: ch, start: index, selectable: true });
    } else if (lang.tokenMode === 'word' && isWordChar) {
      if (!buffer) bufferStart = index;
      buffer += ch;
    } else if (lang.tokenMode === 'char' && isWordChar) {
      // Lateinische Wörter innerhalb eines CJK-Textes bleiben zusammen.
      if (!buffer) bufferStart = index;
      buffer += ch;
    } else {
      if (buffer) {
        const wasWord = /[\p{L}\p{N}]/u.test(buffer);
        flush(wasWord);
      }
      bufferStart = index + ch.length;
      tokens.push({ text: ch, start: index, selectable: false });
    }
    index += ch.length;
  }
  if (buffer) flush(/[\p{L}\p{N}]/u.test(buffer));
  return tokens;
}

/** Enthält der Text überhaupt etwas, das man nachschlagen könnte? */
export function hasSelectableContent(text: string, lang: LanguageDef): boolean {
  return tokenize(text, lang).some((t) => t.selectable);
}
