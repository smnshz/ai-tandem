import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Nebenaktionen (z.B. Löschen) – stehen links, auf dem Handy unten. */
  footerStart?: ReactNode;
  /** Hauptaktionen – stehen rechts, auf dem Handy oben und volle Breite. */
  footerEnd: ReactNode;
}

/**
 * Einheitliche Hülle für alle Dialoge: Kopfzeile mit Titel und Schließen,
 * scrollbarer Inhalt, feste Fußzeile mit klar sortierten Aktionen.
 * Auf dem Handy wird daraus eine Vollbildseite.
 */
export function Dialog({ title, onClose, children, footerStart, footerEnd }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Hintergrund darf nicht mitscrollen, solange der Dialog offen ist.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div className="dialog-backdrop" onPointerDown={onClose}>
      <div
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="dialog__head">
          <h2 className="dialog__title">{title}</h2>
          <button type="button" className="btn btn--quiet btn--icon" onClick={onClose} aria-label="Schließen">
            <X />
          </button>
        </header>

        <div className="dialog__body">{children}</div>

        <footer className="dialog__foot">
          {footerStart ? <div className="dialog__foot-start">{footerStart}</div> : null}
          <div className="dialog__foot-end">{footerEnd}</div>
        </footer>
      </div>
    </div>
  );
}
