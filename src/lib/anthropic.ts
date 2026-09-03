import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Area, Message, Settings, LookupResult } from './types';
import { getLanguage } from './languages';
import { buildSystemPrompt } from './prompt';

/**
 * Der API-Key liegt im Browser (localStorage) und wird direkt von hier aus
 * an die Claude API geschickt. Das ist für einen persönlichen POC in Ordnung,
 * aber NICHT für eine App mit fremden Nutzern – siehe README.
 */
let cached: { key: string; client: Anthropic } | null = null;

function getClient(apiKey: string): Anthropic {
  if (cached && cached.key === apiKey) return cached.client;
  const client = new Anthropic({
    apiKey,
    // Ohne dieses Flag verweigert das SDK den Betrieb im Browser.
    dangerouslyAllowBrowser: true,
  });
  cached = { key: apiKey, client };
  return client;
}

export const CHAT_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 (beste Qualität)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (schneller, günstiger)' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (am günstigsten)' },
] as const;

export const DEFAULT_CHAT_MODEL = 'claude-opus-5';
export const DEFAULT_LOOKUP_MODEL = 'claude-opus-5';

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/** Übersetzt SDK-Fehler in eine Meldung, die in der UI etwas taugt. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return 'Der API-Key wird abgelehnt (401). Bitte in den Einstellungen prüfen.';
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return 'Zugriff verweigert (403). Hat der Key Rechte für die Messages API?';
  }
  if (err instanceof Anthropic.RateLimitError) {
    return 'Rate-Limit erreicht (429). Kurz warten und erneut senden.';
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `Ungültige Anfrage (400): ${err.message}`;
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return 'Keine Verbindung zur Claude API. Netzwerk prüfen (oder der Browser blockt die Anfrage).';
  }
  if (err instanceof Anthropic.APIError) {
    return `API-Fehler ${err.status ?? ''}: ${err.message}`.trim();
  }
  if (err instanceof Error) return err.message;
  return 'Unbekannter Fehler.';
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Anthropic.APIUserAbortError || (err instanceof Error && err.name === 'AbortError');
}

export interface StreamChatOptions {
  settings: Settings;
  area: Area;
  /** Die komplette Historie inkl. der neuen Nutzer-Nachricht. */
  messages: Message[];
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
}

/**
 * Führt einen Gesprächszug aus und streamt die Antwort.
 * Gibt den vollständigen Antworttext zurück.
 */
export async function streamChat(opts: StreamChatOptions): Promise<string> {
  const { settings, area, messages, signal, onDelta } = opts;
  const client = getClient(settings.apiKey);

  const history: Anthropic.MessageParam[] = messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  const stream = client.messages.stream(
    {
      model: settings.chatModel || DEFAULT_CHAT_MODEL,
      // Tandem-Antworten sind kurz – die Obergrenze ist bewusst niedrig.
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(area),
          // Der System-Prompt ist pro Bereich stabil, also cachebar.
          cache_control: { type: 'ephemeral' },
        },
      ],
      // Plauderei braucht keine tiefe Analyse: niedriger Effort ist hier
      // schneller und günstiger, ohne dass die Antworten schlechter werden.
      output_config: { effort: 'low' },
      messages: history,
    },
    { signal },
  );

  stream.on('text', onDelta);
  const final = await stream.finalMessage();

  if (final.stop_reason === 'refusal') {
    throw new Error('Die Antwort wurde aus Sicherheitsgründen abgebrochen. Formuliere die Nachricht anders.');
  }
  return textOf(final.content);
}

const LookupSchema = z.object({
  segments: z
    .array(
      z.object({
        text: z.string().describe('Das Wort bzw. die Zeichengruppe aus der Auswahl.'),
        reading: z.string().describe('Aussprache/Umschrift dieses Teils.'),
        meaning: z.string().describe('Kurze Bedeutung dieses Teils in der Zielsprache des Nutzers.'),
      }),
    )
    .describe('Die Auswahl in sinnvolle Wörter zerlegt, in der Reihenfolge des Originals.'),
  translation: z.string().describe('Übersetzung der gesamten Auswahl.'),
  note: z
    .string()
    .describe('Optionaler kurzer Hinweis zu Grammatik, Ton oder Register. Leerer String, wenn nichts Wichtiges.'),
});

export interface LookupOptions {
  settings: Settings;
  area: Area;
  /** Der markierte Text (ein Zeichen, ein Wort oder mehrere). */
  selection: string;
  /** Der Satz/die Nachricht, in der die Auswahl steht – für den Kontext. */
  context: string;
  signal?: AbortSignal;
}

/** Schlägt Aussprache + Bedeutung für die aktuelle Auswahl nach. */
export async function lookup(opts: LookupOptions): Promise<LookupResult> {
  const { settings, area, selection, context, signal } = opts;
  const client = getClient(settings.apiKey);
  const target = getLanguage(area.targetLang);
  const native = getLanguage(area.nativeLang);

  const system = [
    `Du bist ein Wörterbuch für Lernende von ${target.label}. Die Erklärungssprache ist ${native.label}.`,
    `"reading" ist immer die ${target.readingName}-Umschrift (bei Chinesisch: Pinyin mit Tonzeichen, z.B. "nǐ hǎo").`,
    `"meaning" und "translation" sind immer auf ${native.label}.`,
    'Zerlege die Auswahl in die Wörter, wie sie in der Sprache tatsächlich vorkommen (bei Chinesisch also z.B. 朋友 als ein Wort, nicht als zwei Zeichen).',
    'Ist die Auswahl ein einzelnes Zeichen, gib genau ein Segment zurück.',
    'Nutze den Kontext, um die im Satz passende Bedeutung zu wählen. Halte dich kurz.',
  ].join('\n');

  const res = await client.messages.parse(
    {
      model: settings.lookupModel || DEFAULT_LOOKUP_MODEL,
      max_tokens: 1500,
      system,
      output_config: { format: zodOutputFormat(LookupSchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: [
            `Kontext (ganze Nachricht): ${context || '(kein Kontext)'}`,
            `Auswahl: ${selection}`,
          ].join('\n'),
        },
      ],
    },
    { signal },
  );

  const parsed = res.parsed_output ?? parseLoosely(textOf(res.content as Anthropic.ContentBlock[]));
  if (!parsed) throw new Error('Die Antwort konnte nicht gelesen werden.');

  return {
    query: selection,
    segments: parsed.segments,
    translation: parsed.translation,
    note: parsed.note?.trim() ? parsed.note.trim() : undefined,
  };
}

/** Notausgang, falls die strukturierte Ausgabe einmal nicht greift. */
function parseLoosely(text: string): z.infer<typeof LookupSchema> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return LookupSchema.parse(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return null;
  }
}
