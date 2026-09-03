import { useRef, useState } from 'react';

interface Props {
  disabled: boolean;
  busy: boolean;
  placeholder: string;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ disabled, busy, placeholder, onSend, onStop }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled || busy) return;
    setValue('');
    onSend(text);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Auf Touch-Geräten macht Enter eine neue Zeile, sonst schickt es ab.
    const isDesktop = window.matchMedia('(pointer: fine)').matches;
    if (event.key === 'Enter' && !event.shiftKey && isDesktop) {
      event.preventDefault();
      submit();
    }
  };

  const autoGrow = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 160) + 'px';
  };

  return (
    <div className="composer">
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
      {busy ? (
        <button className="btn btn-secondary" onClick={onStop}>
          Stopp
        </button>
      ) : (
        <button className="btn" onClick={submit} disabled={disabled || !value.trim()}>
          Senden
        </button>
      )}
    </div>
  );
}
