import React from 'react';
import { Users, Check, CheckCheck, FileText, Image as ImageIcon } from 'lucide-react';
import Avatar from '../common/Avatar';
import { useChatStore } from '../../stores/chatStore';

export default function ConversationItem({ conversation, isActive, onClick }) {
  const { onlineMap } = useChatStore();
  const isGroup = conversation.type === 'group';

  // For 1-on-1, check other user's online presence
  let isOnline = false;
  if (!isGroup && conversation.other_user) {
    isOnline = !!onlineMap[conversation.other_user.id];
  }

  // Format timestamp nicely
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const lastMsg = conversation.last_message;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        cursor: 'pointer',
        backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
        borderBottom: '1px solid var(--border-subtle)',
        transition: 'background-color 0.15s ease',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* Avatar */}
      <div style={{ position: 'relative', marginRight: '14px' }}>
        <Avatar
          src={conversation.avatar_url}
          name={conversation.title}
          size="md"
          isOnline={isOnline}
          showOnlineBadge={!isGroup}
        />
        {isGroup && (
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              backgroundColor: 'var(--bg-panel)',
              borderRadius: '50%',
              padding: '2px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
            }}
          >
            <Users size={12} color="var(--accent-primary)" />
          </div>
        )}
      </div>

      {/* Info & Last message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <h4
            style={{
              fontSize: '15px',
              fontWeight: conversation.unread_count > 0 ? 700 : 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {conversation.title}
          </h4>
          <span style={{ fontSize: '12px', color: conversation.unread_count > 0 ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }}>
            {formatTime(lastMsg?.created_at || conversation.updated_at)}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              color: conversation.unread_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '220px',
            }}
          >
            {lastMsg ? (
              <>
                {lastMsg.message_type === 'attachment' ? (
                  <>
                    <ImageIcon size={14} color="var(--text-muted)" />
                    <span>Photo / File</span>
                  </>
                ) : (
                  <span>
                    {isGroup && lastMsg.sender_name ? `${lastMsg.sender_name.split(' ')[0]}: ` : ''}
                    {lastMsg.text}
                  </span>
                )}
              </>
            ) : (
              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No messages yet</span>
            )}
          </div>

          {conversation.unread_count > 0 && (
            <span
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '12px',
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
