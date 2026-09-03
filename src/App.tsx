import { useCallback, useRef, useState } from 'react';
import { useStore } from './lib/state';
import { getLanguage } from './lib/languages';
import { deriveChatTitle } from './lib/prompt';
import { describeError, isAbortError, lookup, streamChat } from './lib/anthropic';
import { getCached, putCached } from './lib/lookupCache';
import type { Area, Message } from './lib/types';
import { Sidebar } from './components/Sidebar';
import { MessageList } from './components/MessageList';
import { Composer } from './components/Composer';
import { LookupPopup, type LookupState } from './components/LookupPopup';
import { AreaDialog } from './components/AreaDialog';
import { SettingsDialog } from './components/SettingsDialog';

export default function App() {
  const store = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [areaDialog, setAreaDialog] = useState<{ area: Area | null } | null>(null);
  const [lookupState, setLookupState] = useState<LookupState | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const chatAbortRef = useRef<AbortController | null>(null);
  const lookupAbortRef = useRef<AbortController | null>(null);

  const { activeArea, activeChat, settings } = store;
  const targetLang = getLanguage(activeArea?.targetLang ?? 'zh-TW');
  const hasApiKey = settings.apiKey.trim().length > 0;

  // --- Gespräch ---------------------------------------------------------

  const send = useCallback(
    async (text: string) => {
      if (!activeArea) return;
      const chat = activeChat ?? store.createChat(activeArea.id);

      store.addMessage(chat.id, 'user', text);
      if (chat.messages.length === 0) store.renameChat(chat.id, deriveChatTitle(text));

      const placeholder = store.addMessage(chat.id, 'assistant', '');
      setStreamingMessageId(placeholder.id);

      const history: Message[] = [
        ...chat.messages,
        { id: 'tmp', role: 'user', content: text, createdAt: Date.now() },
      ];

      const controller = new AbortController();
      chatAbortRef.current = controller;
      let streamed = '';

      try {
        const full = await streamChat({
          settings,
          area: activeArea,
          messages: history,
          signal: controller.signal,
          onDelta: (delta) => {
            streamed += delta;
            store.patchMessage(chat.id, placeholder.id, { content: streamed });
          },
        });
        store.patchMessage(chat.id, placeholder.id, { content: full || streamed });
      } catch (error) {
        if (isAbortError(error)) {
          store.patchMessage(chat.id, placeholder.id, { content: streamed, error: 'Abgebrochen.' });
        } else {
          store.patchMessage(chat.id, placeholder.id, { content: streamed, error: describeError(error) });
        }
      } finally {
        chatAbortRef.current = null;
        setStreamingMessageId(null);
      }
    },
    [activeArea, activeChat, settings, store],
  );

  const stop = useCallback(() => {
    chatAbortRef.current?.abort();
  }, []);

  // --- Nachschlagen -----------------------------------------------------

  const runLookup = useCallback(
    async (messageId: string, selection: string, anchor: DOMRect, context: string, force = false) => {
      if (!activeArea) return;
      if (!hasApiKey) {
        setLookupState({
          messageId,
          selection,
          anchor,
          status: 'error',
          error: 'Kein API-Key hinterlegt – bitte in den Einstellungen eintragen.',
        });
        return;
      }

      const cachedResult = force ? undefined : getCached(activeArea.targetLang, selection);
      if (cachedResult) {
        setLookupState({ messageId, selection, anchor, status: 'done', result: cachedResult, fromCache: true });
        return;
      }

      lookupAbortRef.current?.abort();
      const controller = new AbortController();
      lookupAbortRef.current = controller;

      setLookupState({ messageId, selection, anchor, status: 'loading' });
      try {
        const result = await lookup({
          settings,
          area: activeArea,
          selection,
          context,
          signal: controller.signal,
        });
        putCached(activeArea.targetLang, selection, result);
        setLookupState({ messageId, selection, anchor, status: 'done', result });
      } catch (error) {
        if (isAbortError(error)) return;
        setLookupState({ messageId, selection, anchor, status: 'error', error: describeError(error) });
      }
    },
    [activeArea, hasApiKey, settings],
  );

  const handleSelect = useCallback(
    (messageId: string, selection: string, anchor: DOMRect) => {
      const context = activeChat?.messages.find((m) => m.id === messageId)?.content ?? '';
      void runLookup(messageId, selection, anchor, context);
    },
    [activeChat, runLookup],
  );

  const handleTranslateMessage = useCallback(
    (message: Message) => {
      const element = document.querySelector(`[data-message="${message.id}"]`);
      const anchor = element?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2, 120, 0, 0);
      void runLookup(message.id, message.content, anchor, message.content);
    },
    [runLookup],
  );

  const closeLookup = useCallback(() => {
    lookupAbortRef.current?.abort();
    setLookupState(null);
  }, []);

  // --- Bereiche ---------------------------------------------------------

  const saveArea = (draft: Omit<Area, 'id' | 'createdAt'>) => {
    if (areaDialog?.area) {
      store.updateArea(areaDialog.area.id, draft);
    } else {
      store.createArea(draft);
    }
    setAreaDialog(null);
  };

  const deleteArea = () => {
    if (areaDialog?.area && confirm(`Bereich "${areaDialog.area.name}" mit allen Gesprächen löschen?`)) {
      store.deleteArea(areaDialog.area.id);
      setAreaDialog(null);
    }
  };

  // --- Render -----------------------------------------------------------

  return (
    <div className="app">
      <Sidebar
        areas={store.areas}
        activeArea={activeArea}
        chats={store.chatsOfActiveArea}
        activeChatId={activeChat?.id ?? null}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectArea={(id) => {
          store.selectArea(id);
          closeLookup();
        }}
        onNewArea={() => setAreaDialog({ area: null })}
        onEditArea={(area) => setAreaDialog({ area })}
        onSelectChat={(id) => {
          store.selectChat(id);
          setSidebarOpen(false);
          closeLookup();
        }}
        onNewChat={() => {
          if (activeArea) store.createChat(activeArea.id);
          setSidebarOpen(false);
          closeLookup();
        }}
        onDeleteChat={store.deleteChat}
        onOpenSettings={() => setSettingsOpen(true)}
        hasApiKey={hasApiKey}
      />

      <main className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setSidebarOpen(true)} title="Menü">
            ☰
          </button>
          <div className="topbar-title">
            <strong>{activeArea?.name ?? 'AI Sprachtandem'}</strong>
            <span className="muted tiny">{activeChat?.title ?? 'Neues Gespräch'}</span>
          </div>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Einstellungen">
            ⚙
          </button>
        </header>

        {!hasApiKey && (
          <div className="banner">
            Kein API-Key hinterlegt.{' '}
            <button className="link-btn" onClick={() => setSettingsOpen(true)}>
              Jetzt eintragen
            </button>
          </div>
        )}

        {activeChat && activeChat.messages.length > 0 ? (
          <MessageList
            messages={activeChat.messages}
            targetLang={targetLang}
            activeLookupMessageId={lookupState?.messageId ?? null}
            streamingMessageId={streamingMessageId}
            onSelect={handleSelect}
            onTranslateMessage={handleTranslateMessage}
          />
        ) : (
          <div className="empty">
            <h1>{activeArea?.name ?? 'Sprachtandem'}</h1>
            <p className="muted">
              Schreib einfach los – {targetLang.label} oder Deutsch. Antworten kommen auf {targetLang.label}.
            </p>
            <p className="muted tiny">
              Tipp: einzelne Zeichen antippen zeigt {targetLang.readingName} und Bedeutung. Über mehrere Zeichen
              ziehen übersetzt den ganzen Ausschnitt.
            </p>
          </div>
        )}

        <Composer
          disabled={!activeArea}
          busy={streamingMessageId !== null}
          placeholder={`Nachricht auf ${targetLang.label} …`}
          onSend={(text) => void send(text)}
          onStop={stop}
        />
      </main>

      {lookupState && (
        <LookupPopup
          state={lookupState}
          targetLang={targetLang}
          onClose={closeLookup}
          onReload={() =>
            void runLookup(
              lookupState.messageId,
              lookupState.selection,
              lookupState.anchor,
              activeChat?.messages.find((m) => m.id === lookupState.messageId)?.content ?? '',
              true,
            )
          }
        />
      )}

      {areaDialog && (
        <AreaDialog
          area={areaDialog.area}
          canDelete={store.areas.length > 1}
          onSave={saveArea}
          onDelete={deleteArea}
          onClose={() => setAreaDialog(null)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog settings={settings} onSave={store.saveSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
