export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** Gesetzt, wenn die Antwort abgebrochen wurde oder ein Fehler auftrat. */
  error?: string;
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

export interface Settings {
  apiKey: string;
  /** Modell für die Konversation. */
  chatModel: string;
  /** Modell für Zeichen-Lookups (kann günstiger/schneller sein). */
  lookupModel: string;
}

/** Ein Wort/Zeichen innerhalb der markierten Auswahl. */
export interface LookupSegment {
  text: string;
  reading: string;
  meaning: string;
}

export interface LookupResult {
  /** Die nachgeschlagene Auswahl. */
  query: string;
  segments: LookupSegment[];
  /** Übersetzung der gesamten Auswahl in die eigene Sprache. */
  translation: string;
  /** Optionaler kurzer Hinweis (Grammatik, Ton, Register). */
  note?: string;
}
