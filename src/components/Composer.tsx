import { useEffect, useRef, useState } from 'react';
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
    element.style.height = Math.min(element.scrollHeight, 160) + 'px';
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

  if (recorder) {
    return (
      <div className="composer composer-recording">
        <span className="rec-dot" aria-hidden="true" />
        <span className="rec-time">Aufnahme … {formatElapsed(elapsedMs)}</span>
        <button className="btn btn-secondary" onClick={cancelRecording} title="Verwerfen">
          Verwerfen
        </button>
        <button className="btn" onClick={() => void stopAndSend()} title="Aufnahme senden">
          ✔ Senden
        </button>
      </div>
    );
  }

  return (
    <div className="composer">
      {micError && <p className="error tiny mic-error">{micError}</p>}
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          setValue(event.target.value);
          autoGrow(event.target);
        }}
        onKeyDown={handleKeyDown}
      />
      {canRecordAudio && !busy && !value.trim() && (
        <button
          className="icon-btn mic-btn"
          onClick={() => void beginRecording()}
          disabled={disabled}
          title="Sprachnachricht aufnehmen – geht direkt als Audio an die KI"
        >
          🎤
        </button>
      )}
      {busy ? (
        <button className="btn btn-secondary" onClick={onStop}>
          Stopp
        </button>
      ) : (
        <button className="btn" onClick={submitText} disabled={disabled || !value.trim()}>
          Senden
        </button>
      )}
    </div>
  );
}
