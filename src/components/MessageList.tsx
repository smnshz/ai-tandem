import { useEffect, useRef } from 'react';
import type { Message } from '../lib/types';
import type { LanguageDef } from '../lib/languages';
import { AnnotatedText } from './AnnotatedText';
import { canSpeak, speak } from '../lib/speech';
import { hasSelectableContent } from '../lib/tokenize';

interface Props {
  messages: Message[];
  targetLang: LanguageDef;
  activeLookupMessageId: string | null;
  streamingMessageId: string | null;
  onSelect: (messageId: string, selection: string, anchor: DOMRect) => void;
  onTranslateMessage: (message: Message) => void;
}

export function MessageList({
  messages,
  targetLang,
  activeLookupMessageId,
  streamingMessageId,
  onSelect,
  onTranslateMessage,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streamingMessageId]);

  return (
    <div className="messages">
      {messages.map((message) => {
        const annotatable = hasSelectableContent(message.content, targetLang);
        return (
          <div key={message.id} data-message={message.id} className={`msg msg-${message.role}`}>
            <div className="bubble">
              {message.audio && (
                message.audio.data ? (
                  <audio className="voice-msg" controls preload="none" src={`data:${message.audio.mimeType};base64,${message.audio.data}`} />
                ) : (
                  <span className="muted tiny">🎤 Sprachnachricht (nach Neuladen nicht mehr abspielbar)</span>
                )
              )}
              {message.content ? (
                annotatable ? (
                  <AnnotatedText
                    text={message.content}
                    lang={targetLang}
                    isActive={activeLookupMessageId === message.id}
                    onSelect={(selection, anchor) => onSelect(message.id, selection, anchor)}
                  />
                ) : (
                  <span className="plain">{message.content}</span>
                )
              ) : (
                !message.audio && streamingMessageId === message.id && (
                  <span className="typing" aria-label="schreibt" />
                )
              )}
              {message.error && <p className="error tiny">{message.error}</p>}
            </div>
            {message.content && (
              <div className="msg-tools">
                {canSpeak() && (
                  <button className="link-btn" onClick={() => speak(message.content, targetLang.speechLang)}>
                    🔊 vorlesen
                  </button>
                )}
                {annotatable && (
                  <button className="link-btn" onClick={() => onTranslateMessage(message)}>
                    übersetzen
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
