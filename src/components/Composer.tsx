import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Mic, Square, Trash2 } from 'lucide-react';
import { startRecording, type AudioRecorder, type RecordedAudio } from '../lib/audio';

export interface SendPayload {
  text?: string;
  audio?: RecordedAudio;
}

interface Props {
  disabled: boolean;
  busy: boolean;
  placeholder: string;
  /** Direkter Audio-Modus verfügbar (Browser kann aufnehmen + Anbieter versteht Audio)? */
  canRecordAudio: boolean;
  onSend: (payload: SendPayload) => void;
  onStop: () => void;
}

const MAX_TEXTAREA_HEIGHT = 140;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function Composer({ disabled, busy, placeholder, canRecordAudio, onSend, onStop }: Props) {
  const [value, setValue] = useState('');
  const [recorder, setRecorder] = useState<AudioRecorder | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recordingStartRef = useRef(0);

  useEffect(() => {
    if (!recorder) return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - recordingStartRef.current), 200);
    return () => window.clearInterval(timer);
  }, [recorder]);

  const submitText = () => {
    const text = value.trim();
    if (!text || disabled || busy) return;
    setValue('');
    onSend({ text });
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Auf Touch-Geräten macht Enter eine neue Zeile, sonst schickt es ab.
    const isDesktop = window.matchMedia('(pointer: fine)').matches;
    if (event.key === 'Enter' && !event.shiftKey && isDesktop) {
      event.preventDefault();
      submitText();
    }
  };

  const autoGrow = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px';
  };

  const beginRecording = async () => {
    setMicError(null);
    try {
      const handle = await startRecording();
      recordingStartRef.current = Date.now();
      setElapsedMs(0);
      setRecorder(handle);
    } catch {
      setMicError('Mikrofonzugriff nicht möglich – bitte Berechtigung erteilen.');
    }
  };

  const stopAndSend = async () => {
    if (!recorder) return;
    setRecorder(null);
    const result = await recorder.stop();
    if (result && result.durationMs >= 400) onSend({ audio: result });
  };

  const cancelRecording = () => {
    if (!recorder) return;
    recorder.cancel();
    setRecorder(null);
  };

  const showMic = canRecordAudio && !busy && !value.trim();
  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="composer">
      <div className="composer__inner">
        {micError && <p className="composer__note">{micError}</p>}

        {recorder ? (
          <div className="recorder">
            <span className="recorder__dot" aria-hidden="true" />
            <span className="recorder__time">Aufnahme läuft · {formatElapsed(elapsedMs)}</span>
            <div className="recorder__actions">
              <button
                type="button"
                className="btn btn--quiet btn--icon"
                onClick={cancelRecording}
                title="Aufnahme verwerfen"
                aria-label="Aufnahme verwerfen"
              >
                <Trash2 />
              </button>
              <button
                type="button"
                className="btn btn--icon"
                onClick={() => void stopAndSend()}
                title="Aufnahme senden"
                aria-label="Aufnahme senden"
              >
                <Check />
              </button>
            </div>
          </div>
        ) : (
          <div className="composer__field">
            <textarea
              ref={textareaRef}
              className="composer__input"
              value={value}
              rows={1}
              placeholder={placeholder}
              disabled={disabled}
              aria-label="Nachricht"
              onChange={(event) => {
                setValue(event.target.value);
                autoGrow(event.target);
              }}
              onKeyDown={handleKeyDown}
            />
            <div className="composer__actions">
              {showMic && (
                <button
                  type="button"
                  className="btn btn--quiet btn--icon"
                  onClick={() => void beginRecording()}
                  disabled={disabled}
                  title="Sprachnachricht aufnehmen – geht direkt als Audio an die KI"
                  aria-label="Sprachnachricht aufnehmen"
                >
                  <Mic />
                </button>
              )}
              {busy ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--icon composer__send"
                  onClick={onStop}
                  title="Antwort stoppen"
                  aria-label="Antwort stoppen"
                >
                  <Square />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--icon composer__send"
                  onClick={submitText}
                  disabled={!canSend}
                  title="Senden"
                  aria-label="Senden"
                >
                  <ArrowUp />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
