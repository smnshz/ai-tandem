import type { Area, Message, ProviderConfig, LookupResult } from '../types';

export interface ChatRequest {
  config: ProviderConfig;
  area: Area;
  /** Historie inkl. der neuen Nutzer-Nachricht. */
  messages: Message[];
  system: string;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
}

export interface LookupRequest {
  config: ProviderConfig;
  area: Area;
  /** Der markierte Text. */
  selection: string;
  /** Der Satz, in dem die Auswahl steht. */
  context: string;
  /** Anweisungen für Umschrift und Erklärungssprache. */
  system: string;
  signal?: AbortSignal;
}

export interface ModelOption {
  id: string;
  label: string;
}

export interface Provider {
  id: string;
  label: string;
  /** Wo man einen Key bekommt. */
  keyUrl: string;
  keyHint: string;
  defaultChatModel: string;
  defaultLookupModel: string;
  /** Vorschläge, wenn die Modell-Liste nicht geladen wurde. */
  models: ModelOption[];
  /** Kann dieser Anbieter Audio direkt verstehen (ohne Transkription)? */
  supportsAudioInput: boolean;
  streamChat(request: ChatRequest): Promise<string>;
  lookup(request: LookupRequest): Promise<LookupResult>;
  /** Fragt die tatsächlich verfügbaren Modelle beim Anbieter ab. */
  listModels(apiKey: string): Promise<ModelOption[]>;
  describeError(error: unknown): string;
}

/** Fehler mit einer Meldung, die direkt in der UI angezeigt werden kann. */
export class ProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'APIUserAbortError');
}

/** Schema, das beide Anbieter für das Nachschlagen benutzen. */
export interface RawLookup {
  segments: { text: string; reading: string; meaning: string }[];
  translation: string;
  note?: string;
}

export function toLookupResult(selection: string, raw: RawLookup): LookupResult {
  return {
    query: selection,
    segments: raw.segments.map((segment) => ({
      text: segment.text,
      reading: segment.reading,
      meaning: segment.meaning,
    })),
    translation: raw.translation,
    note: raw.note?.trim() ? raw.note.trim() : undefined,
    source: 'ai',
  };
}

/** Notausgang, falls ein Modell die JSON-Ausgabe in Text verpackt. */
export function parseLoosely(text: string): RawLookup | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as RawLookup;
    if (!Array.isArray(parsed.segments)) return null;
    return parsed;
  } catch {
    return null;
  }
}
