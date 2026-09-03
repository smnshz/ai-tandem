import { useEffect, useRef } from 'react';
import type { Message } from '../lib/types';
import type { LanguageDef } from '../lib/languages';
import { AnnotatedText } from './AnnotatedText';
import { canSpeak } from '../lib/speech';
import { hasSelectableContent } from '../lib/tokenize';
import { parseStructuredReply } from '../lib/responseFormat';

interface Props {
  messages: Message[];
  targetLang: LanguageDef;
  activeLookupMessageId: string | null;
  streamingMessageId: string | null;
  speakingMessageId: string | null;
  onSelect: (messageId: string, selection: string, anchor: DOMRect) => void;
  onTranslateMessage: (message: Message) => void;
  onToggleSpeak: (message: Message) => void;
}

export function MessageList({
  messages,
  targetLang,
  activeLookupMessageId,
  streamingMessageId,
  speakingMessageId,
  onSelect,
  onTranslateMessage,
  onToggleSpeak,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streamingMessageId]);

  return (
    <div className="messages">
      {messages.map((message) => {
        const isStreaming = streamingMessageId === message.id;
        const isUser = message.role === 'user';
        // Bei User-Nachrichten und alten Nachrichten ohne Format-Marker (vor
        // diesem Feature) ist der ganze Inhalt der "Gesprächstext".
        const parsed = isUser ? null : parseStructuredReply(message.content);
        const legacyPlain = !isUser && !parsed!.replyStarted && !isStreaming;
        const replyText = isUser ? message.content : parsed!.replyStarted ? parsed!.reply : legacyPlain ? message.content : '';
        const showTyping = !message.audio && !replyText && isStreaming;
        const annotatable = hasSelectableContent(replyText, targetLang);
        const isSpeaking = speakingMessageId === message.id;

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
              {parsed && parsed.correction && parsed.correction !== 'none' && (
                <div className="correction">
                  {parsed.correction.kind === 'fields' ? (
                    <>
                      {parsed.correction.quote && <div className="correction-quote">„{parsed.correction.quote}“</div>}
                      {parsed.correction.corrected && (
                        <div className="correction-fixed">→ {parsed.correction.corrected}</div>
                      )}
                      {parsed.correction.explanation && (
                        <div className="correction-explain">{parsed.correction.explanation}</div>
                      )}
                    </>
                  ) : (
                    <div className="correction-fixed">{parsed.correction.text}</div>
                  )}
                  <hr className="correction-divider" />
                </div>
              )}
              {replyText ? (
                annotatable ? (
                  <AnnotatedText
                    text={replyText}
                    lang={targetLang}
                    isActive={activeLookupMessageId === message.id}
                    onSelect={(selection, anchor) => onSelect(message.id, selection, anchor)}
                  />
                ) : (
                  <span className="plain">{replyText}</span>
                )
              ) : (
                showTyping && <span className="typing" aria-label="schreibt" />
              )}
              {message.error && <p className="error tiny">{message.error}</p>}
            </div>
            {replyText && (
              <div className="msg-tools">
                {canSpeak() && (
                  <button className="link-btn" onClick={() => onToggleSpeak(message)}>
                    {isSpeaking ? '⏹ stoppen' : '🔊 vorlesen'}
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
