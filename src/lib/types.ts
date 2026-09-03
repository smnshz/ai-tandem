export type Role = 'user' | 'assistant';

export interface MessageAudio {
  mimeType: string;
  /**
   * Base64-kodierte Audiodaten. Wird bewusst NICHT dauerhaft gespeichert
   * (siehe state.ts) – nach einem Neuladen der Seite ist die Aufnahme selbst
   * weg, nur mimeType/durationMs bleiben als Hinweis erhalten.
   */
  data?: string;
  durationMs: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** Gesetzt, wenn die Antwort abgebrochen wurde oder ein Fehler auftrat. */
  error?: string;
  /**
   * Direkt aufgenommene Sprachnachricht (nur beim Nutzer). Geht ohne lokale
   * Transkription als Audio an die KI – die Aussprache-Fehleranfälligkeit
   * einer Zwischen-Transkription entfällt so.
   */
  audio?: MessageAudio;
}

export interface Chat {
  id: string;
  areaId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

/** Ein "Bereich" bündelt Sprache + Rollen-Prompt, z.B. "Chinesisch". */
export interface Area {
  id: string;
  name: string;
  /** Freitext des Nutzers – landet im System-Prompt. */
  systemPrompt: string;
  /** BCP-47 Code der Zielsprache, z.B. "zh-TW". */
  targetLang: string;
  /** BCP-47 Code der eigenen Sprache, z.B. "de". */
  nativeLang: string;
  createdAt: number;
}

export type ProviderId = 'gemini' | 'anthropic';

export interface ProviderConfig {
  apiKey: string;
  /** Modell für die Konversation. */
  chatModel: string;
  /** Modell für Nachschlagen, das das Wörterbuch nicht abdeckt. */
  lookupModel: string;
}

export interface Settings {
  provider: ProviderId;
  gemini: ProviderConfig;
  anthropic: ProviderConfig;
}

/** Ein Wort/Zeichen innerhalb der markierten Auswahl. */
export interface LookupSegment {
  text: string;
  reading: string;
  meaning: string;
  /** true, wenn das Wörterbuch dazu nichts hatte. */
  unknown?: boolean;
}

export interface LookupResult {
  /** Die nachgeschlagene Auswahl. */
  query: string;
  segments: LookupSegment[];
  /** Übersetzung der gesamten Auswahl – nur die KI liefert die. */
  translation?: string;
  /** Optionaler kurzer Hinweis (Grammatik, Ton, Register). */
  note?: string;
  /** Woher das Ergebnis kommt. */
  source: 'dict' | 'ai';
  /** true, wenn im Wörterbuch etwas gefehlt hat. */
  incomplete?: boolean;
}
