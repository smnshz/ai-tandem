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
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={open ? 'sidebar sidebar-open' : 'sidebar'}>
        <div className="sidebar-section">
          <div className="sidebar-head">
            <h2>Bereiche</h2>
            <button className="icon-btn" title="Neuer Bereich" onClick={onNewArea}>
              ＋
            </button>
          </div>
          <ul className="area-list">
            {areas.map((area) => (
              <li key={area.id}>
                <button
                  className={area.id === activeArea?.id ? 'area active' : 'area'}
                  onClick={() => onSelectArea(area.id)}
                >
                  <span className="area-name">{area.name}</span>
                  <span className="area-lang">{getLanguage(area.targetLang).label}</span>
                </button>
                {area.id === activeArea?.id && (
                  <button className="icon-btn" title="Bereich bearbeiten" onClick={() => onEditArea(area)}>
                    ✎
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-section grow">
          <div className="sidebar-head">
            <h2>Gespräche</h2>
            <button className="icon-btn" title="Neues Gespräch" onClick={onNewChat} disabled={!activeArea}>
              ＋
            </button>
          </div>
          <ul className="chat-list">
            {chats.length === 0 && <li className="muted tiny pad">Noch keine Gespräche.</li>}
            {chats.map((chat) => (
              <li key={chat.id}>
                <button
                  className={chat.id === activeChatId ? 'chat active' : 'chat'}
                  onClick={() => onSelectChat(chat.id)}
                >
                  {chat.title}
                </button>
                <button className="icon-btn" title="Gespräch löschen" onClick={() => onDeleteChat(chat.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-foot">
          <button className="btn btn-secondary full" onClick={onOpenSettings}>
            ⚙ Einstellungen{hasApiKey ? '' : ' ⚠'}
          </button>
        </div>
      </aside>
    </>
  );
}
