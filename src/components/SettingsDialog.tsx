import { useState } from 'react';
import type { ProviderConfig, ProviderId, Settings } from '../lib/types';
import type { ModelOption } from '../lib/providers/types';
import { PROVIDERS, PROVIDER_IDS, listModels } from '../lib/ai';
import { isPersistent } from '../lib/storage';
import { clearCache } from '../lib/lookupCache';
import { dictionaryMeta, isLoaded } from '../lib/dictionary';

interface Props {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsDialog({ settings, onSave, onClose }: Props) {
  const [provider, setProvider] = useState<ProviderId>(settings.provider);
  const [configs, setConfigs] = useState<Record<ProviderId, ProviderConfig>>({
    gemini: { ...settings.gemini },
    anthropic: { ...settings.anthropic },
  });
  const [reveal, setReveal] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [remoteModels, setRemoteModels] = useState<Partial<Record<ProviderId, ModelOption[]>>>({});
  const [modelStatus, setModelStatus] = useState<string | null>(null);

  const definition = PROVIDERS[provider];
  const config = configs[provider];
  const models = remoteModels[provider] ?? definition.models;
  const meta = dictionaryMeta();

  const patch = (change: Partial<ProviderConfig>) => {
    setConfigs((prev) => ({ ...prev, [provider]: { ...prev[provider], ...change } }));
  };

  const loadModels = async () => {
    setModelStatus('Lade Modelle …');
    try {
      const list = await listModels({ ...settings, provider, [provider]: config } as Settings);
      setRemoteModels((prev) => ({ ...prev, [provider]: list }));
      setModelStatus(`${list.length} Modelle geladen.`);
    } catch (error) {
      setModelStatus(definition.describeError(error));
    }
  };

  /** Ein Modell, das nicht in der Liste steht, bleibt trotzdem wählbar. */
  const options: ModelOption[] = [config.chatModel, config.lookupModel].reduce(
    (list, id) => (id && !list.some((model) => model.id === id) ? [...list, { id, label: id }] : list),
    models,
  );

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="modal" onPointerDown={(event) => event.stopPropagation()}>
        <h2>Einstellungen</h2>

        <label>
          Anbieter
          <select value={provider} onChange={(event) => setProvider(event.target.value as ProviderId)}>
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {PROVIDERS[id].label}
              </option>
            ))}
          </select>
        </label>
        {!definition.supportsAudioInput && (
          <p className="muted tiny">
            🎤 Audio-Modus (Sprachnachricht direkt an die KI, ohne Transkription) gibt es aktuell nur mit Google
            Gemini – {definition.label} unterstützt das (noch) nicht.
          </p>
        )}

        <label>
          API-Key ({definition.label})
          <div className="input-row">
            <input
              type={reveal ? 'text' : 'password'}
              value={config.apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder={provider === 'gemini' ? 'AIza…' : 'sk-ant-…'}
              onChange={(event) => patch({ apiKey: event.target.value.trim() })}
            />
            <button className="btn btn-secondary" onClick={() => setReveal((value) => !value)}>
              {reveal ? 'verbergen' : 'zeigen'}
            </button>
          </div>
        </label>
        <p className="muted tiny">
          {definition.keyHint} Key holen:{' '}
          <a href={definition.keyUrl} target="_blank" rel="noreferrer">
            {definition.keyUrl.replace('https://', '')}
          </a>
          . Er wird nur in diesem Browser gespeichert und direkt an den Anbieter geschickt – er landet nie im
          Repository. Wer Zugriff auf dieses Gerät hat, kann ihn auslesen.
        </p>

        <div className="row">
          <label>
            Modell fürs Gespräch
            <select value={config.chatModel} onChange={(event) => patch({ chatModel: event.target.value })}>
              {options.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modell fürs Nachschlagen
            <select value={config.lookupModel} onChange={(event) => patch({ lookupModel: event.target.value })}>
              {options.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted tiny">
          <button className="link-btn" onClick={() => void loadModels()} disabled={!config.apiKey}>
            Modelle laden
          </button>{' '}
          holt die Liste, die dein Key tatsächlich freischaltet. {modelStatus}
        </p>

        <p className="muted tiny">
          Wörterbuch:{' '}
          {meta ? (
            <a href={meta.source} target="_blank" rel="noreferrer">
              {meta.name}
            </a>
          ) : (
            'HanDeDict'
          )}
          {meta
            ? `, ${meta.entries.toLocaleString('de-DE')} Einträge (Stand ${meta.dataStamp.slice(0, 10)}, ${meta.license})`
            : isLoaded()
              ? ' (geladen)'
              : ' (wird beim ersten Nachschlagen geladen)'}
          . Chinesisch → Deutsch läuft damit ohne API; die KI kommt nur für Kontext, ganze Sätze und fehlende
          Wörter dazu.
        </p>

        <p className="muted tiny">
          Speicher:{' '}
          {isPersistent()
            ? 'localStorage – Daten bleiben in diesem Browser.'
            : 'nur im Arbeitsspeicher (privater Modus) – beim Schließen des Tabs weg.'}
        </p>

        <div className="modal-foot">
          <button
            className="btn btn-secondary"
            onClick={() => {
              clearCache();
              setCacheCleared(true);
            }}
          >
            {cacheCleared ? 'Cache geleert' : 'KI-Cache leeren'}
          </button>
          <span className="spacer" />
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="btn"
            onClick={() => {
              onSave({ provider, gemini: configs.gemini, anthropic: configs.anthropic });
              onClose();
            }}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
