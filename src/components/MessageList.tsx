import { useEffect, useRef } from 'react';
import { Languages, Mic, Square, Volume2 } from 'lucide-react';
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
      <div className="messages__inner">
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
            <div key={message.id} data-message={message.id} className={`msg msg--${message.role}`}>
              <div className="bubble">
                {message.audio &&
                  (message.audio.data ? (
                    <audio
                      className="voice-msg"
                      controls
                      preload="none"
                      src={`data:${message.audio.mimeType};base64,${message.audio.data}`}
                    />
                  ) : (
                    <span className="voice-hint">
                      <Mic size={15} />
                      Sprachnachricht (nach Neuladen nicht mehr abspielbar)
                    </span>
                  ))}
                {parsed && parsed.correction && parsed.correction !== 'none' && (
                  <div className="correction">
                    {parsed.correction.quote && <div className="correction__quote">„{parsed.correction.quote}“</div>}
                    {parsed.correction.corrected && (
                      <div className="correction__fixed">{parsed.correction.corrected}</div>
                    )}
                    {parsed.correction.explanation && (
                      <div className="correction__explain">{parsed.correction.explanation}</div>
                    )}
                    <hr className="correction__divider" />
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
                <div className="msg__tools">
                  {canSpeak() && (
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      onClick={() => onToggleSpeak(message)}
                    >
                      {isSpeaking ? <Square size={15} /> : <Volume2 size={15} />}
                      {isSpeaking ? 'Stoppen' : 'Vorlesen'}
                    </button>
                  )}
                  {annotatable && (
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      onClick={() => onTranslateMessage(message)}
                    >
                      <Languages size={15} />
                      Übersetzen
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
