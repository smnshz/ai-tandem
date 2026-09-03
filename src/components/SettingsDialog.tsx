import { useState } from 'react';
import { Eye, EyeOff, Info, Mic, RefreshCw, Trash2 } from 'lucide-react';
import type { ProviderConfig, ProviderId, Settings } from '../lib/types';
import type { ModelOption } from '../lib/providers/types';
import { PROVIDERS, PROVIDER_IDS, listModels } from '../lib/ai';
import { isPersistent } from '../lib/storage';
import { clearCache } from '../lib/lookupCache';
import { dictionaryMeta, isLoaded } from '../lib/dictionary';
import { Dialog } from './Dialog';

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
  const [loadingModels, setLoadingModels] = useState(false);

  const definition = PROVIDERS[provider];
  const config = configs[provider];
  const models = remoteModels[provider] ?? definition.models;
  const meta = dictionaryMeta();

  const patch = (change: Partial<ProviderConfig>) => {
    setConfigs((prev) => ({ ...prev, [provider]: { ...prev[provider], ...change } }));
  };

  const loadModels = async () => {
    setLoadingModels(true);
    setModelStatus(null);
    try {
      const list = await listModels({ ...settings, provider, [provider]: config } as Settings);
      setRemoteModels((prev) => ({ ...prev, [provider]: list }));
      setModelStatus(`${list.length} Modelle geladen.`);
    } catch (error) {
      setModelStatus(definition.describeError(error));
    } finally {
      setLoadingModels(false);
    }
  };

  /** Ein Modell, das nicht in der Liste steht, bleibt trotzdem wählbar. */
  const options: ModelOption[] = [config.chatModel, config.lookupModel].reduce(
    (list, id) => (id && !list.some((model) => model.id === id) ? [...list, { id, label: id }] : list),
    models,
  );

  return (
    <Dialog
      title="Einstellungen"
      onClose={onClose}
      footerEnd={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onSave({ provider, gemini: configs.gemini, anthropic: configs.anthropic });
              onClose();
            }}
          >
            Speichern
          </button>
        </>
      }
    >
      <section className="section">
        <h3 className="section__title">Anbieter</h3>

        <div className="field">
          <label className="field__label" htmlFor="settings-provider">
            KI-Anbieter
          </label>
          <select
            id="settings-provider"
            className="select"
            value={provider}
            onChange={(event) => setProvider(event.target.value as ProviderId)}
          >
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {PROVIDERS[id].label}
              </option>
            ))}
          </select>
        </div>

        {!definition.supportsAudioInput && (
          <div className="note-card">
            <Mic size={15} />
            <p>
              Sprachnachrichten gehen aktuell nur mit Google Gemini direkt als Audio an die KI –{' '}
              {definition.label} unterstützt das noch nicht.
            </p>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="settings-key">
            API-Key ({definition.label})
          </label>
          <div className="input-row">
            <input
              id="settings-key"
              className="input"
              type={reveal ? 'text' : 'password'}
              value={config.apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder={provider === 'gemini' ? 'AIza…' : 'sk-ant-…'}
              onChange={(event) => patch({ apiKey: event.target.value.trim() })}
            />
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={() => setReveal((value) => !value)}
              title={reveal ? 'Key verbergen' : 'Key anzeigen'}
              aria-label={reveal ? 'Key verbergen' : 'Key anzeigen'}
            >
              {reveal ? <EyeOff /> : <Eye />}
            </button>
          </div>
          <p className="field__hint">
            {definition.keyHint} Key holen:{' '}
            <a href={definition.keyUrl} target="_blank" rel="noreferrer">
              {definition.keyUrl.replace('https://', '')}
            </a>
            . Er wird nur in diesem Browser gespeichert und direkt an den Anbieter geschickt – er landet nie im
            Repository. Wer Zugriff auf dieses Gerät hat, kann ihn auslesen.
          </p>
        </div>
      </section>

      <section className="section">
        <h3 className="section__title">Modelle</h3>

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="settings-chat-model">
              Fürs Gespräch
            </label>
            <select
              id="settings-chat-model"
              className="select"
              value={config.chatModel}
              onChange={(event) => patch({ chatModel: event.target.value })}
            >
              {options.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="settings-lookup-model">
              Fürs Nachschlagen
            </label>
            <select
              id="settings-lookup-model"
              className="select"
              value={config.lookupModel}
              onChange={(event) => patch({ lookupModel: event.target.value })}
            >
              {options.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void loadModels()}
            disabled={!config.apiKey || loadingModels}
          >
            <RefreshCw size={15} className={loadingModels ? 'spin' : undefined} />
            {loadingModels ? 'Lade Modelle …' : 'Modelle laden'}
          </button>
          <p className="field__hint">
            Holt die Liste, die dein Key tatsächlich freischaltet. {modelStatus}
          </p>
        </div>
      </section>

      <section className="section">
        <h3 className="section__title">Daten</h3>

        <div className="note-card">
          <Info size={15} />
          <div>
            <p>
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
            <p>
              Speicher:{' '}
              {isPersistent()
                ? 'localStorage – Daten bleiben in diesem Browser.'
                : 'nur im Arbeitsspeicher (privater Modus) – beim Schließen des Tabs weg.'}
            </p>
          </div>
        </div>

        <div className="field">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              clearCache();
              setCacheCleared(true);
            }}
            disabled={cacheCleared}
          >
            <Trash2 size={15} />
            {cacheCleared ? 'Cache geleert' : 'KI-Cache leeren'}
          </button>
          <p className="field__hint">Verwirft gespeicherte Nachschlage-Ergebnisse der KI.</p>
        </div>
      </section>
    </Dialog>
  );
}
