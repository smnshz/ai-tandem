import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { ModelOption, Provider, ChatRequest, LookupRequest } from './types';
import { parseLoosely, toLookupResult } from './types';

/**
 * Anthropic Claude über das offizielle SDK, direkt aus dem Browser.
 * Kostet API-Guthaben (kein Bestandteil des Claude-Abos) – siehe README.
 */
const MODELS: ModelOption[] = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 (beste Qualität)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (am günstigsten)' },
];

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

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

async function streamChat(request: ChatRequest): Promise<string> {
  const client = getClient(request.config.apiKey);
  const history: Anthropic.MessageParam[] = request.messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.content }));

  const stream = client.messages.stream(
    {
      model: request.config.chatModel || MODELS[0].id,
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: request.system,
          // Der System-Prompt ist pro Bereich stabil, also cachebar.
          cache_control: { type: 'ephemeral' },
        },
      ],
      // Plauderei braucht keine tiefe Analyse: niedriger Effort ist hier
      // schneller und günstiger, ohne dass die Antworten schlechter werden.
      output_config: { effort: 'low' },
      messages: history,
    },
    { signal: request.signal },
  );

  stream.on('text', request.onDelta);
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') {
    throw new Error('Die Antwort wurde aus Sicherheitsgründen abgebrochen. Formuliere die Nachricht anders.');
  }
  return textOf(final.content);
}

const LookupSchema = z.object({
  segments: z.array(
    z.object({
      text: z.string().describe('Das Wort bzw. die Zeichengruppe aus der Auswahl.'),
      reading: z.string().describe('Aussprache/Umschrift dieses Teils.'),
      meaning: z.string().describe('Kurze Bedeutung dieses Teils.'),
    }),
  ),
  translation: z.string().describe('Übersetzung der gesamten Auswahl.'),
  note: z.string().describe('Kurzer Hinweis zu Grammatik oder Register. Leerer String, wenn nichts Wichtiges.'),
});

async function lookup(request: LookupRequest) {
  const client = getClient(request.config.apiKey);
  const response = await client.messages.parse(
    {
      model: request.config.lookupModel || MODELS[0].id,
      max_tokens: 1500,
      system: request.system,
      output_config: { format: zodOutputFormat(LookupSchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: [
            `Kontext (ganze Nachricht): ${request.context || '(kein Kontext)'}`,
            `Auswahl: ${request.selection}`,
          ].join('\n'),
        },
      ],
    },
    { signal: request.signal },
  );

  const parsed = response.parsed_output ?? parseLoosely(textOf(response.content as Anthropic.ContentBlock[]));
  if (!parsed) throw new Error('Die Antwort konnte nicht gelesen werden.');
  return toLookupResult(request.selection, parsed);
}

async function listModels(apiKey: string): Promise<ModelOption[]> {
  const client = getClient(apiKey);
  const page = await client.models.list({ limit: 50 });
  return page.data.map((model) => ({ id: model.id, label: model.display_name ?? model.id }));
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'Der API-Key wird abgelehnt (401). Bitte in den Einstellungen prüfen.';
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'Zugriff verweigert (403). Hat der Key Rechte für die Messages API?';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Rate-Limit erreicht (429). Kurz warten und erneut senden.';
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `Ungültige Anfrage (400): ${error.message}`;
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Keine Verbindung zur Claude API. Netzwerk prüfen.';
  }
  if (error instanceof Anthropic.APIError) {
    return `API-Fehler ${error.status ?? ''}: ${error.message}`.trim();
  }
  if (error instanceof Error) return error.message;
  return 'Unbekannter Fehler.';
}

export const anthropicProvider: Provider = {
  id: 'anthropic',
  label: 'Anthropic Claude',
  keyUrl: 'https://console.anthropic.com/settings/keys',
  keyHint: 'Braucht API-Guthaben – das Claude-Abo (Pro/Max) gilt hier nicht.',
  defaultChatModel: MODELS[0].id,
  defaultLookupModel: MODELS[2].id,
  models: MODELS,
  streamChat,
  lookup,
  listModels,
  describeError,
};
