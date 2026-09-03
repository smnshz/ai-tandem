export interface LanguageDef {
  code: string;
  label: string;
  /** Wie die Aussprache-Hilfe heißt, z.B. "Pinyin". */
  readingName: string;
  /**
   * 'char' = jedes Schriftzeichen ist eine antippbare Einheit (CJK),
   * 'word' = durch Leerzeichen getrennte Wörter sind antippbar.
   */
  tokenMode: 'char' | 'word';
  /** Stimme/Locale für die Sprachausgabe (Web Speech API). */
  speechLang: string;
}

export const LANGUAGES: LanguageDef[] = [
  { code: 'zh-TW', label: 'Chinesisch (traditionell)', readingName: 'Pinyin', tokenMode: 'char', speechLang: 'zh-TW' },
  { code: 'zh-CN', label: 'Chinesisch (vereinfacht)', readingName: 'Pinyin', tokenMode: 'char', speechLang: 'zh-CN' },
  { code: 'ja', label: 'Japanisch', readingName: 'Romaji', tokenMode: 'char', speechLang: 'ja-JP' },
  { code: 'ko', label: 'Koreanisch', readingName: 'Umschrift', tokenMode: 'char', speechLang: 'ko-KR' },
  { code: 'de', label: 'Deutsch', readingName: 'Aussprache', tokenMode: 'word', speechLang: 'de-DE' },
  { code: 'en', label: 'Englisch', readingName: 'Aussprache', tokenMode: 'word', speechLang: 'en-US' },
  { code: 'es', label: 'Spanisch', readingName: 'Aussprache', tokenMode: 'word', speechLang: 'es-ES' },
  { code: 'fr', label: 'Französisch', readingName: 'Aussprache', tokenMode: 'word', speechLang: 'fr-FR' },
  { code: 'it', label: 'Italienisch', readingName: 'Aussprache', tokenMode: 'word', speechLang: 'it-IT' },
  { code: 'pt', label: 'Portugiesisch', readingName: 'Aussprache', tokenMode: 'word', speechLang: 'pt-PT' },
  { code: 'ru', label: 'Russisch', readingName: 'Transliteration', tokenMode: 'word', speechLang: 'ru-RU' },
  { code: 'ar', label: 'Arabisch', readingName: 'Transliteration', tokenMode: 'word', speechLang: 'ar-SA' },
];

const FALLBACK: LanguageDef = {
  code: 'unknown',
  label: 'Unbekannt',
  readingName: 'Aussprache',
  tokenMode: 'word',
  speechLang: 'en-US',
};

export function getLanguage(code: string): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? { ...FALLBACK, code, label: code };
}
