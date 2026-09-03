import { useState } from 'react';
import type { Settings } from '../lib/types';
import { CHAT_MODELS } from '../lib/anthropic';
import { isPersistent } from '../lib/storage';
import { clearCache } from '../lib/lookupCache';

interface Props {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsDialog({ settings, onSave, onClose }: Props) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [chatModel, setChatModel] = useState(settings.chatModel);
  const [lookupModel, setLookupModel] = useState(settings.lookupModel);
  const [reveal, setReveal] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="modal" onPointerDown={(event) => event.stopPropagation()}>
        <h2>Einstellungen</h2>

        <label>
          Anthropic API-Key
          <div className="input-row">
            <input
              type={reveal ? 'text' : 'password'}
              value={apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              onChange={(event) => setApiKey(event.target.value.trim())}
            />
            <button className="btn btn-secondary" onClick={() => setReveal((value) => !value)}>
              {reveal ? 'verbergen' : 'zeigen'}
            </button>
          </div>
        </label>
        <p className="muted tiny">
          Den Key gibt es unter{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com/settings/keys
          </a>
          . Er wird nur in diesem Browser gespeichert (localStorage) und direkt an die Claude API geschickt – er
          landet nie im Repository. Wer die Seite auf demselben Gerät öffnet, kann ihn auslesen: also nur auf
          eigenen Geräten benutzen.
        </p>

        <div className="row">
          <label>
            Modell fürs Gespräch
            <select value={chatModel} onChange={(event) => setChatModel(event.target.value)}>
              {CHAT_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modell fürs Nachschlagen
            <select value={lookupModel} onChange={(event) => setLookupModel(event.target.value)}>
              {CHAT_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="muted tiny">
          Speicher: {isPersistent() ? 'localStorage – Daten bleiben in diesem Browser.' : 'nur im Arbeitsspeicher (privater Modus) – beim Schließen des Tabs weg.'}
        </p>

        <div className="modal-foot">
          <button
            className="btn btn-secondary"
            onClick={() => {
              clearCache();
              setCacheCleared(true);
            }}
          >
            {cacheCleared ? 'Cache geleert' : 'Übersetzungs-Cache leeren'}
          </button>
          <span className="spacer" />
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="btn"
            onClick={() => {
              onSave({ apiKey, chatModel, lookupModel });
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
