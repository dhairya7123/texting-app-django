import React from 'react';
import { ArrowLeft, Users, MoreVertical, Info } from 'lucide-react';
import Avatar from '../common/Avatar';
import { useChatStore } from '../../stores/chatStore';

export default function ChatHeader({ conversation, onOpenGroupInfo }) {
  const { onlineMap, lastSeenMap, typingMap, setSidebarOpen } = useChatStore();
  const isGroup = conversation.type === 'group';


  let isOnline = false;
  let lastSeenText = '';

  if (!isGroup && conversation.other_user) {
    const otherId = conversation.other_user.id;
    isOnline = !!onlineMap[otherId];
    const lastSeen = lastSeenMap[otherId];
    if (isOnline) {
      lastSeenText = 'Online';
    } else if (lastSeen) {
      const d = new Date(lastSeen);
      lastSeenText = `Last seen ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      lastSeenText = 'Offline';
    }
  } else if (isGroup) {
    const count = conversation.members?.length || 0;
    lastSeenText = `${count} members`;
  }


  const convTyping = typingMap[conversation.id] || {};
  const typingUsernames = Object.values(convTyping);
  const isSomeoneTyping = typingUsernames.length > 0;
  const typingText =
    typingUsernames.length === 1
      ? `${typingUsernames[0]} is typing...`
      : `${typingUsernames.length} people are typing...`;

  return (
    <div
      style={{
        padding: '10px 16px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 5,
        height: '60px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

        <button
          onClick={() => setSidebarOpen(true)}
          className="mobile-back-btn"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>


        <div
          onClick={isGroup ? onOpenGroupInfo : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: isGroup ? 'pointer' : 'default',
          }}
        >
          <Avatar
            src={conversation.avatar_url}
            name={conversation.title}
            size="md"
            isOnline={isOnline}
            showOnlineBadge={!isGroup}
          />
          <div>
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
              }}
            >
              {conversation.title}
            </h3>
            <div
              style={{
                fontSize: '12px',
                color: isSomeoneTyping
                  ? 'var(--accent-primary)'
                  : isOnline
                  ? 'var(--online-dot)'
                  : 'var(--text-muted)',
                fontWeight: isSomeoneTyping ? 600 : 400,
              }}
            >
              {isSomeoneTyping ? typingText : lastSeenText}
            </div>
          </div>
        </div>
      </div>


      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {isGroup && (
          <button
            onClick={onOpenGroupInfo}
            title="Group info"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Info size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
