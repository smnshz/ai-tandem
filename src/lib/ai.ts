import type { Area, LookupResult, Message, ProviderId, Settings } from './types';
import type { ModelOption, Provider } from './providers/types';
import { isAbortError } from './providers/types';
import { geminiProvider } from './providers/gemini';
import { anthropicProvider } from './providers/anthropic';
import { buildSystemPrompt, buildLookupPrompt } from './prompt';
import { lookupOffline, supportsOffline } from './dictionary';
import { getCached, putCached } from './lookupCache';

export const PROVIDERS: Record<ProviderId, Provider> = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
};

export const PROVIDER_IDS: ProviderId[] = ['gemini', 'anthropic'];

export { isAbortError };

export function providerOf(settings: Settings): Provider {
  return PROVIDERS[settings.provider] ?? geminiProvider;
}

export function configOf(settings: Settings) {
  return settings[settings.provider] ?? settings.gemini;
}

export function hasApiKey(settings: Settings): boolean {
  return configOf(settings).apiKey.trim().length > 0;
}

export function describeError(settings: Settings, error: unknown): string {
  return providerOf(settings).describeError(error);
}

export function listModels(settings: Settings): Promise<ModelOption[]> {
  return providerOf(settings).listModels(configOf(settings).apiKey);
}

export interface ChatOptions {
  settings: Settings;
  area: Area;
  messages: Message[];
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
}

export function streamChat(options: ChatOptions): Promise<string> {
  return providerOf(options.settings).streamChat({
    config: configOf(options.settings),
    area: options.area,
    messages: options.messages,
    system: buildSystemPrompt(options.area),
    signal: options.signal,
    onDelta: options.onDelta,
  });
}

export interface LookupOptions {
  settings: Settings;
  area: Area;
  selection: string;
  context: string;
  /**
   * 'auto' nimmt das Offline-Wörterbuch, wenn es die Sprache abdeckt.
   * 'ai' erzwingt die KI (für Kontext, ganze Sätze oder fehlende Wörter).
   */
  mode: 'auto' | 'ai';
  signal?: AbortSignal;
}

/**
 * Nachschlagen in drei Stufen: Wörterbuch (gratis, sofort) → KI-Cache → KI.
 */
export async function resolveLookup(options: LookupOptions): Promise<LookupResult> {
  const { settings, area, selection, context, mode, signal } = options;

  if (mode === 'auto') {
    const cached = getCached(area.targetLang, selection);
    if (cached) return cached;

    if (supportsOffline(area)) {
      const offline = await lookupOffline(selection);
      // Unvollständige Treffer zeigen wir trotzdem – die KI ist dann einen Klick entfernt.
      if (offline) return offline;
    }
  }

  if (!hasApiKey(settings)) {
    throw new Error('Kein API-Key hinterlegt – bitte in den Einstellungen eintragen.');
  }

  const result = await providerOf(settings).lookup({
    config: configOf(settings),
    area,
    selection,
    context,
    system: buildLookupPrompt(area),
    signal,
  });
  putCached(area.targetLang, selection, result);
  return result;
}
