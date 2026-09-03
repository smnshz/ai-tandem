import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Area } from '../lib/types';
import { LANGUAGES } from '../lib/languages';
import { Dialog } from './Dialog';

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
    <Dialog
      title={area ? 'Bereich bearbeiten' : 'Neuer Bereich'}
      onClose={onClose}
      footerStart={
        canDelete && area ? (
          <button type="button" className="btn btn--danger" onClick={onDelete}>
            <Trash2 />
            Löschen
          </button>
        ) : undefined
      }
      footerEnd={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn" onClick={save}>
            Speichern
          </button>
        </>
      }
    >
      <div className="field-group">
        <div className="field">
          <label className="field__label" htmlFor="area-name">
            Name
          </label>
          <input
            id="area-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="z.B. Chinesisch"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="area-target">
              Ich lerne
            </label>
            <select
              id="area-target"
              className="select"
              value={targetLang}
              onChange={(event) => setTargetLang(event.target.value)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="area-native">
              Erklärungen auf
            </label>
            <select
              id="area-native"
              className="select"
              value={nativeLang}
              onChange={(event) => setNativeLang(event.target.value)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="area-prompt">
            Initialer Prompt (Rolle, Situation, Niveau)
          </label>
          <textarea
            id="area-prompt"
            className="textarea"
            rows={6}
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            placeholder="z.B. Du bist Barista in einem Café in Taipeh. Ich bin Anfänger und bestelle etwas."
          />
          <p className="field__hint">
            Die Tandem-Regeln (kurze Antworten, keine Übersetzung im Text, Korrekturzeile) kommen automatisch dazu.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
