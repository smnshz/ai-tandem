import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, LoaderCircle, Sparkles, Square, TriangleAlert, Volume2, X } from 'lucide-react';
import type { LookupResult } from '../lib/types';
import type { LanguageDef } from '../lib/languages';
import { canSpeak, speak, stopSpeaking } from '../lib/speech';

export interface LookupState {
  messageId: string;
  selection: string;
  anchor: DOMRect;
  status: 'loading' | 'done' | 'error';
  result?: LookupResult;
  error?: string;
  fromCache?: boolean;
}

interface Props {
  state: LookupState;
  targetLang: LanguageDef;
  onClose: () => void;
  /** Auswahl (noch einmal) von der KI erklären lassen. */
  onAskAi: () => void;
}

const MOBILE_BREAKPOINT = 760;

export function LookupPopup({ state, targetLang, onClose, onAskAi }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const [isSheet, setIsSheet] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Beim Schließen bzw. bei neuer Auswahl darf keine Sprachausgabe weiterlaufen.
  useEffect(() => {
    setIsSpeaking(false);
    return () => stopSpeaking();
  }, [state.selection]);

  useEffect(() => {
    const onResize = () => setIsSheet(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Auf großen Screens hängt die Karte am angetippten Zeichen,
  // auf dem Handy kommt sie als Sheet von unten.
  useLayoutEffect(() => {
    if (isSheet) {
      setStyle({});
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    const { width, height } = card.getBoundingClientRect();
    const margin = 10;
    const anchor = state.anchor;

    const left = Math.min(
      Math.max(margin, anchor.left + anchor.width / 2 - width / 2),
      window.innerWidth - width - margin,
    );
    const below = anchor.bottom + margin;
    const top = below + height > window.innerHeight - margin ? Math.max(margin, anchor.top - height - margin) : below;

    setStyle({ left, top, visibility: 'visible' });
  }, [state.anchor, state.status, state.result, isSheet]);

  const speakable = canSpeak();

  return (
    <>
      <div className="popup-backdrop" onPointerDown={onClose} />
      <div ref={cardRef} className={isSheet ? 'lookup lookup--sheet' : 'lookup'} style={style} role="dialog">
        <header className="lookup__head">
          <span className="lookup__query" lang={targetLang.code}>
            {state.selection}
          </span>
          <div className="lookup__actions">
            {speakable && (
              <button
                type="button"
                className="btn btn--quiet btn--icon btn--sm"
                title={isSpeaking ? 'Stoppen' : 'Vorlesen'}
                aria-label={isSpeaking ? 'Stoppen' : 'Vorlesen'}
                onClick={() => {
                  if (isSpeaking) {
                    stopSpeaking();
                    setIsSpeaking(false);
                    return;
                  }
                  setIsSpeaking(true);
                  speak(state.selection, targetLang.speechLang, { onEnd: () => setIsSpeaking(false) });
                }}
              >
                {isSpeaking ? <Square /> : <Volume2 />}
              </button>
            )}

            <button
              type="button"
              className="btn btn--quiet btn--icon btn--sm"
              title="Schließen"
              aria-label="Schließen"
              onClick={onClose}
            >
              <X />
            </button>
          </div>
        </header>

        {state.status === 'loading' && (
          <p className="lookup__status">
            <LoaderCircle className="spin" size={16} />
            Wird nachgeschlagen …
          </p>
        )}

        {state.status === 'error' && (
          <p className="lookup__status lookup__status--error">
            <TriangleAlert size={16} />
            {state.error}
          </p>
        )}

        {state.status === 'done' && state.result && (
          <div className="lookup__body">
            <ul className="segments">
              {state.result.segments.map((segment, index) => (
                <li key={index} className={segment.unknown ? 'seg-unknown' : undefined}>
                  <span className="seg-text" lang={targetLang.code}>
                    {segment.text}
                  </span>
                  <span className="seg-reading">{segment.reading}</span>
                  <span className="seg-meaning">{segment.meaning}</span>
                </li>
              ))}
            </ul>

            {state.result.translation && (
              <p className="lookup__translation">
                <strong>Ganze Auswahl:</strong> {state.result.translation}
              </p>
            )}
            {state.result.note && <p className="lookup__note">{state.result.note}</p>}

            <div className="lookup__foot">
              <span className="badge">
                {state.result.source === 'dict' ? <BookOpen size={13} /> : <Sparkles size={13} />}
                {state.result.source === 'dict' ? 'Wörterbuch · offline' : 'KI'}
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={onAskAi}>
                <Sparkles size={15} />
                {state.result.incomplete
                  ? 'Fehlende Wörter klären'
                  : state.result.source === 'dict'
                    ? 'Im Satzkontext erklären'
                    : 'Noch einmal nachschlagen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
