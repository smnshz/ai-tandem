import type { ModelOption, Provider, ChatRequest, LookupRequest } from './types';
import { ProviderError, parseLoosely, toLookupResult, type RawLookup } from './types';

/**
 * Google Gemini über die REST-API (generativelanguage.googleapis.com).
 * Der Key liegt im Browser und geht als `x-goog-api-key`-Header raus –
 * Google erlaubt das per CORS, siehe README zu den Konsequenzen.
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

const MODELS: ModelOption[] = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (kostenloses Kontingent)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (am schnellsten)' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (neuestes)' },
];

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  error?: { code: number; message: string; status: string };
}

function textOf(response: GeminiResponse): string {
  return (response.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

async function assertOk(response: Response): Promise<void> {
  if (response.ok) return;
  let message = `${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as GeminiResponse;
    if (body.error?.message) message = body.error.message;
  } catch {
    /* Antwort war kein JSON – Statuszeile reicht. */
  }
  throw new ProviderError(message, response.status);
}

function headers(apiKey: string): Record<string, string> {
  return { 'content-type': 'application/json', 'x-goog-api-key': apiKey };
}

/** Unsere Rollen heißen bei Gemini "user" und "model". */
function toContents(request: ChatRequest) {
  return request.messages
    .filter((message) => message.content.trim().length > 0 || (message.audio && message.audio.data))
    .map((message) => {
      const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];
      // Audio zuerst, direkt als Bytes – keine Transkription dazwischen.
      if (message.audio?.data) {
        parts.push({ inlineData: { mimeType: message.audio.mimeType, data: message.audio.data } });
      }
      if (message.content.trim()) parts.push({ text: message.content });
      return { role: message.role === 'assistant' ? 'model' : 'user', parts };
    });
}

async function streamChat(request: ChatRequest): Promise<string> {
  const model = request.config.chatModel || MODELS[0].id;
  const response = await fetch(`${BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: headers(request.config.apiKey),
    signal: request.signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: toContents(request),
      generationConfig: {
        // Tandem-Antworten sind kurz – die Obergrenze ist bewusst niedrig.
        maxOutputTokens: 2000,
        temperature: 0.9,
        // Ohne das hier frisst "Thinking" bei neueren Modellen das ganze
        // Token-Budget auf, bevor sichtbarer Text kommt (leere Bubble).
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  await assertOk(response);
  if (!response.body) throw new ProviderError('Die Antwort kam ohne Inhalt an.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let finishReason: string | undefined;

  // Server-Sent Events: Blöcke sind durch eine Leerzeile getrennt
  // (mal "\n\n", mal "\r\n\r\n"), die Nutzdaten stehen in Zeilen,
  // die mit "data:" beginnen.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.search(/\r?\n\r?\n/);
    while (separator !== -1) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator).replace(/^(\r?\n){2}/, '');
      separator = buffer.search(/\r?\n\r?\n/);

      const payload = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (!payload || payload === '[DONE]') continue;

      try {
        const chunk = JSON.parse(payload) as GeminiResponse;
        if (chunk.error) throw new ProviderError(chunk.error.message, chunk.error.code);
        const blocked = chunk.promptFeedback?.blockReason;
        if (blocked) throw new ProviderError(`Die Anfrage wurde blockiert (${blocked}).`);
        if (chunk.candidates?.[0]?.finishReason) finishReason = chunk.candidates[0].finishReason;
        const delta = (chunk.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
        if (delta) {
          full += delta;
          request.onDelta(delta);
        }
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        // Unvollständiger JSON-Block: der nächste Chunk bringt den Rest.
      }
    }
  }

  const trimmed = full.trim();
  if (!trimmed && finishReason && finishReason !== 'STOP') {
    throw new ProviderError(`Keine Antwort erhalten (${finishReason}). Anderes Modell oder kürzere Nachricht versuchen.`);
  }
  return trimmed;
}

/** Gemini beschreibt Schemas im OpenAPI-Stil. */
const LOOKUP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    segments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          reading: { type: 'STRING' },
          meaning: { type: 'STRING' },
        },
        required: ['text', 'reading', 'meaning'],
        propertyOrdering: ['text', 'reading', 'meaning'],
      },
    },
    translation: { type: 'STRING' },
    note: { type: 'STRING' },
  },
  required: ['segments', 'translation'],
  propertyOrdering: ['segments', 'translation', 'note'],
};

async function lookup(request: LookupRequest) {
  const model = request.config.lookupModel || MODELS[0].id;
  const response = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: headers(request.config.apiKey),
    signal: request.signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                `Kontext (ganze Nachricht): ${request.context || '(kein Kontext)'}`,
                `Auswahl: ${request.selection}`,
              ].join('\n'),
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: LOOKUP_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  await assertOk(response);

  const body = (await response.json()) as GeminiResponse;
  const text = textOf(body);
  let raw: RawLookup | null = null;
  try {
    raw = JSON.parse(text) as RawLookup;
  } catch {
    raw = parseLoosely(text);
  }
  if (!raw?.segments) throw new ProviderError('Die Antwort konnte nicht gelesen werden.');
  return toLookupResult(request.selection, raw);
}

interface ModelListResponse {
  models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
}

async function listModels(apiKey: string): Promise<ModelOption[]> {
  const response = await fetch(`${BASE}/models?pageSize=200`, { headers: headers(apiKey) });
  await assertOk(response);
  const body = (await response.json()) as ModelListResponse;
  return (body.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => ({
      id: model.name.replace(/^models\//, ''),
      label: model.displayName ?? model.name.replace(/^models\//, ''),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function describeError(error: unknown): string {
  if (error instanceof ProviderError) {
    switch (error.status) {
      case 400:
        return `Gemini lehnt die Anfrage ab: ${error.message}`;
      case 401:
      case 403:
        return 'Der API-Key wird abgelehnt. In den Einstellungen prüfen (oder ist die Generative Language API im Projekt nicht aktiviert?).';
      case 404:
        return `Modell nicht gefunden: ${error.message}. In den Einstellungen "Modelle laden" drücken und eins aus der Liste wählen.`;
      case 429:
        return 'Kontingent erschöpft (429). Beim kostenlosen Tarif greifen Tages- und Minutenlimits – später erneut versuchen oder ein anderes Modell wählen.';
      default:
        return error.message;
    }
  }
  if (error instanceof TypeError) {
    return 'Keine Verbindung zur Gemini-API. Netzwerk prüfen.';
  }
  if (error instanceof Error) return error.message;
  return 'Unbekannter Fehler.';
}

export const geminiProvider: Provider = {
  id: 'gemini',
  label: 'Google Gemini',
  keyUrl: 'https://aistudio.google.com/apikey',
  keyHint: 'Key aus dem Google AI Studio. Für Flash-Modelle gibt es ein kostenloses Kontingent.',
  defaultChatModel: MODELS[0].id,
  defaultLookupModel: MODELS[0].id,
  models: MODELS,
  supportsAudioInput: true,
  streamChat,
  lookup,
  listModels,
  describeError,
};
