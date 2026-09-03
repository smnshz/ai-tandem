import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Area, Chat, Message, Role, Settings } from './types';
import { KEYS, load, save } from './storage';
import { newId } from './id';
import { DEFAULT_CHAT_MODEL, DEFAULT_LOOKUP_MODEL } from './anthropic';

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  chatModel: DEFAULT_CHAT_MODEL,
  lookupModel: DEFAULT_LOOKUP_MODEL,
};

function defaultArea(): Area {
  return {
    id: newId(),
    name: 'Chinesisch',
    systemPrompt:
      'Wir sind in Taipeh. Du bist eine freundliche Verkäuferin an einem Nachtmarkt-Stand ' +
      'und ich bin Kunde. Ich bin Anfänger und mache viele Fehler – bleib geduldig und ' +
      'benutze einfache, alltagsnahe Sätze.',
    targetLang: 'zh-TW',
    nativeLang: 'de',
    createdAt: Date.now(),
  };
}

export interface Store {
  areas: Area[];
  chats: Chat[];
  settings: Settings;
  activeArea: Area | null;
  activeChat: Chat | null;
  chatsOfActiveArea: Chat[];

  selectArea: (id: string) => void;
  createArea: (draft: Omit<Area, 'id' | 'createdAt'>) => Area;
  updateArea: (id: string, patch: Partial<Area>) => void;
  deleteArea: (id: string) => void;

  selectChat: (id: string | null) => void;
  createChat: (areaId: string) => Chat;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;

  addMessage: (chatId: string, role: Role, content: string) => Message;
  patchMessage: (chatId: string, messageId: string, patch: Partial<Message>) => void;

  saveSettings: (patch: Partial<Settings>) => void;
}

export function useStore(): Store {
  const [areas, setAreas] = useState<Area[]>(() => {
    const stored = load<Area[]>(KEYS.areas, []);
    return stored.length ? stored : [defaultArea()];
  });
  const [chats, setChats] = useState<Chat[]>(() => load<Chat[]>(KEYS.chats, []));
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...load<Partial<Settings>>(KEYS.settings, {}),
  }));
  const [activeAreaId, setActiveAreaId] = useState<string | null>(() => load<string | null>(KEYS.activeArea, null));
  const [activeChatId, setActiveChatId] = useState<string | null>(() => load<string | null>(KEYS.activeChat, null));

  useEffect(() => save(KEYS.areas, areas), [areas]);
  useEffect(() => save(KEYS.chats, chats), [chats]);
  useEffect(() => save(KEYS.settings, settings), [settings]);
  useEffect(() => save(KEYS.activeArea, activeAreaId), [activeAreaId]);
  useEffect(() => save(KEYS.activeChat, activeChatId), [activeChatId]);

  const activeArea = useMemo(
    () => areas.find((a) => a.id === activeAreaId) ?? areas[0] ?? null,
    [areas, activeAreaId],
  );
  const chatsOfActiveArea = useMemo(
    () => chats.filter((c) => c.areaId === activeArea?.id).sort((a, b) => b.updatedAt - a.updatedAt),
    [chats, activeArea],
  );
  const activeChat = useMemo(() => {
    const found = chats.find((c) => c.id === activeChatId);
    return found && found.areaId === activeArea?.id ? found : null;
  }, [chats, activeChatId, activeArea]);

  const selectArea = useCallback((id: string) => {
    setActiveAreaId(id);
    setActiveChatId(null);
  }, []);

  const createArea = useCallback((draft: Omit<Area, 'id' | 'createdAt'>) => {
    const area: Area = { ...draft, id: newId(), createdAt: Date.now() };
    setAreas((prev) => [...prev, area]);
    setActiveAreaId(area.id);
    setActiveChatId(null);
    return area;
  }, []);

  const updateArea = useCallback((id: string, patch: Partial<Area>) => {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const deleteArea = useCallback((id: string) => {
    setAreas((prev) => prev.filter((a) => a.id !== id));
    setChats((prev) => prev.filter((c) => c.areaId !== id));
    setActiveAreaId((current) => (current === id ? null : current));
    setActiveChatId(null);
  }, []);

  const createChat = useCallback((areaId: string) => {
    const now = Date.now();
    const chat: Chat = {
      id: newId(),
      areaId,
      title: 'Neues Gespräch',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    return chat;
  }, []);

  const deleteChat = useCallback((id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    setActiveChatId((current) => (current === id ? null : current));
  }, []);

  const renameChat = useCallback((id: string, title: string) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, []);

  const addMessage = useCallback((chatId: string, role: Role, content: string) => {
    const message: Message = { id: newId(), role, content, createdAt: Date.now() };
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, messages: [...c.messages, message], updatedAt: Date.now() } : c,
      ),
    );
    return message;
  }, []);

  const patchMessage = useCallback((chatId: string, messageId: string, patch: Partial<Message>) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              updatedAt: Date.now(),
              messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
            }
          : c,
      ),
    );
  }, []);

  const saveSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    areas,
    chats,
    settings,
    activeArea,
    activeChat,
    chatsOfActiveArea,
    selectArea,
    createArea,
    updateArea,
    deleteArea,
    selectChat: setActiveChatId,
    createChat,
    deleteChat,
    renameChat,
    addMessage,
    patchMessage,
    saveSettings,
  };
}
