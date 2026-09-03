import { useState } from 'react';
import type { Area } from '../lib/types';
import { LANGUAGES } from '../lib/languages';

interface Props {
  /** null = neuer Bereich */
  area: Area | null;
  canDelete: boolean;
  onSave: (draft: Omit<Area, 'id' | 'createdAt'>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function AreaDialog({ area, canDelete, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(area?.name ?? '');
  const [systemPrompt, setSystemPrompt] = useState(area?.systemPrompt ?? '');
  const [targetLang, setTargetLang] = useState(area?.targetLang ?? 'zh-TW');
  const [nativeLang, setNativeLang] = useState(area?.nativeLang ?? 'de');

  const save = () => {
    onSave({
      name: name.trim() || 'Ohne Namen',
      systemPrompt: systemPrompt.trim(),
      targetLang,
      nativeLang,
    });
  };

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="modal" onPointerDown={(event) => event.stopPropagation()}>
        <h2>{area ? 'Bereich bearbeiten' : 'Neuer Bereich'}</h2>

        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="z.B. Chinesisch" />
        </label>

        <div className="row">
          <label>
            Ich lerne
            <select value={targetLang} onChange={(event) => setTargetLang(event.target.value)}>
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Erklärungen auf
            <select value={nativeLang} onChange={(event) => setNativeLang(event.target.value)}>
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Initialer Prompt (Rolle, Situation, Niveau)
          <textarea
            rows={7}
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            placeholder="z.B. Du bist Barista in einem Café in Taipeh. Ich bin Anfänger und bestelle etwas."
          />
        </label>
        <p className="muted tiny">
          Die Tandem-Regeln (kurze Antworten, keine Übersetzung im Text, Korrekturzeile) kommen automatisch dazu.
        </p>

        <div className="modal-foot">
          {canDelete && area && (
            <button className="btn btn-danger" onClick={onDelete}>
              Bereich löschen
            </button>
          )}
          <span className="spacer" />
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn" onClick={save}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
