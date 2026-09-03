import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tokenize } from '../lib/tokenize';
import type { LanguageDef } from '../lib/languages';

interface Props {
  text: string;
  lang: LanguageDef;
  /** Ist gerade eine Auswahl aus genau diesem Text aktiv? */
  isActive: boolean;
  /** Auswahl abgeschlossen: Text + Position für das Popup. */
  onSelect: (selection: string, anchor: DOMRect) => void;
}

interface Range {
  a: number;
  b: number;
}

/**
 * Rendert Text so, dass jedes Zeichen (bzw. Wort) angetippt werden kann.
 * Antippen wählt eine Einheit aus, Ziehen wählt mehrere zusammenhängende aus.
 */
export function AnnotatedText({ text, lang, isActive, onSelect }: Props) {
  const tokens = useMemo(() => tokenize(text, lang), [text, lang]);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [dragging, setDragging] = useState(false);

  // Sobald die Auswahl woanders passiert (oder das Popup zugeht), Markierung weg.
  useEffect(() => {
    if (!isActive) setRange(null);
  }, [isActive]);

  const indexFromPoint = useCallback((x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y);
    const token = el?.closest('[data-token]');
    if (!token || !containerRef.current?.contains(token)) return null;
    const value = token.getAttribute('data-token');
    return value == null ? null : Number(value);
  }, []);

  const commit = useCallback(
    (r: Range) => {
      const from = Math.min(r.a, r.b);
      const to = Math.max(r.a, r.b);
      const selection = tokens
        .slice(from, to + 1)
        .map((t) => t.text)
        .join('');
      if (!selection.trim()) return;

      const nodes = containerRef.current?.querySelectorAll<HTMLElement>('[data-token]');
      let anchor: DOMRect | null = null;
      nodes?.forEach((node) => {
        const i = Number(node.getAttribute('data-token'));
        if (i < from || i > to) return;
        const rect = node.getBoundingClientRect();
        anchor = anchor ? unionRect(anchor, rect) : rect;
      });
      onSelect(selection, anchor ?? new DOMRect(0, 0, 0, 0));
    },
    [tokens, onSelect],
  );

  const handlePointerDown = (event: React.PointerEvent, index: number) => {
    if (!tokens[index]?.selectable) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    setRange({ a: index, b: index });
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!dragging || !range) return;
    const index = indexFromPoint(event.clientX, event.clientY);
    if (index != null && tokens[index]?.selectable && index !== range.b) {
      setRange({ ...range, b: index });
    }
  };

  const handlePointerUp = () => {
    if (!dragging || !range) return;
    setDragging(false);
    commit(range);
  };

  const from = range ? Math.min(range.a, range.b) : -1;
  const to = range ? Math.max(range.a, range.b) : -2;

  return (
    <span
      ref={containerRef}
      className="annotated"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {tokens.map((token, index) =>
        token.selectable ? (
          <span
            key={index}
            data-token={index}
            className={'tok' + (index >= from && index <= to ? ' tok-selected' : '')}
            onPointerDown={(event) => handlePointerDown(event, index)}
            role="button"
            tabIndex={-1}
          >
            {token.text}
          </span>
        ) : (
          <span key={index} className="tok-plain">
            {token.text}
          </span>
        ),
      )}
    </span>
  );
}

function unionRect(a: DOMRect, b: DOMRect): DOMRect {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.right, b.right);
  const bottom = Math.max(a.bottom, b.bottom);
  return new DOMRect(left, top, right - left, bottom - top);
}
