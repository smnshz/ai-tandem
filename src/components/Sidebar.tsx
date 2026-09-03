import { Pencil, Plus, Settings, Trash2, TriangleAlert, X } from 'lucide-react';
import type { Area, Chat } from '../lib/types';
import { getLanguage } from '../lib/languages';

interface Props {
  areas: Area[];
  activeArea: Area | null;
  chats: Chat[];
  activeChatId: string | null;
  open: boolean;
  onClose: () => void;
  onSelectArea: (id: string) => void;
  onNewArea: () => void;
  onEditArea: (area: Area) => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
}

export function Sidebar(props: Props) {
  const {
    areas,
    activeArea,
    chats,
    activeChatId,
    open,
    onClose,
    onSelectArea,
    onNewArea,
    onEditArea,
    onSelectChat,
    onNewChat,
    onDeleteChat,
    onOpenSettings,
    hasApiKey,
  } = props;

  return (
    <>
      {open && <div className="sidebar__backdrop" onClick={onClose} />}
      <aside className={open ? 'sidebar sidebar--open' : 'sidebar'}>
        <div className="sidebar__head">
          <span className="sidebar__brand">AI Sprachtandem</span>
          <button
            type="button"
            className="btn btn--quiet btn--icon only-mobile"
            onClick={onClose}
            aria-label="Menü schließen"
          >
            <X />
          </button>
        </div>

        <div className="sidebar__body">
          <section className="sidebar__section">
            <div className="sidebar__section-head">
              <h2>Bereiche</h2>
              <button
                type="button"
                className="btn btn--quiet btn--icon btn--sm"
                onClick={onNewArea}
                title="Neuer Bereich"
                aria-label="Neuer Bereich"
              >
                <Plus />
              </button>
            </div>

            <ul className="nav-list">
              {areas.map((area) => {
                const isActive = area.id === activeArea?.id;
                return (
                  <li key={area.id} className={isActive ? 'nav-row nav-row--active' : 'nav-row'}>
                    <button type="button" className="nav-item" onClick={() => onSelectArea(area.id)}>
                      <span className="nav-item__label">{area.name}</span>
                      <span className="nav-item__meta">{getLanguage(area.targetLang).label}</span>
                    </button>
                    {isActive && (
                      <button
                        type="button"
                        className="btn btn--quiet btn--icon btn--sm nav-row__action"
                        onClick={() => onEditArea(area)}
                        title="Bereich bearbeiten"
                        aria-label={`Bereich ${area.name} bearbeiten`}
                      >
                        <Pencil />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="sidebar__section">
            <div className="sidebar__section-head">
              <h2>Gespräche</h2>
              <button
                type="button"
                className="btn btn--quiet btn--icon btn--sm"
                onClick={onNewChat}
                disabled={!activeArea}
                title="Neues Gespräch"
                aria-label="Neues Gespräch"
              >
                <Plus />
              </button>
            </div>

            <ul className="nav-list">
              {chats.length === 0 && <li className="nav-empty">Noch keine Gespräche.</li>}
              {chats.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <li key={chat.id} className={isActive ? 'nav-row nav-row--active' : 'nav-row'}>
                    <button type="button" className="nav-item" onClick={() => onSelectChat(chat.id)}>
                      <span className="nav-item__label">{chat.title}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn--quiet btn--icon btn--sm nav-row__action"
                      onClick={() => onDeleteChat(chat.id)}
                      title="Gespräch löschen"
                      aria-label={`Gespräch ${chat.title} löschen`}
                    >
                      <Trash2 />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="sidebar__foot">
          <button type="button" className="btn btn--ghost btn--block" onClick={onOpenSettings}>
            <Settings />
            Einstellungen
            {!hasApiKey && <TriangleAlert className="error" aria-label="Kein API-Key hinterlegt" />}
          </button>
        </div>
      </aside>
    </>
  );
}
