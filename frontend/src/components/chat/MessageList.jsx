import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import MessageItem from './MessageItem';
import { useChatStore } from '../../stores/chatStore';

export default function MessageList({
  conversation,
  messages,
  hasMore,
  isLoading,
  onLoadMore,
  onStartEdit,
  onDelete,
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const { typingMap } = useChatStore();

  const isGroup = conversation.type === 'group';


  const convTyping = typingMap[conversation.id] || {};
  const typingUsernames = Object.values(convTyping);
  const isSomeoneTyping = typingUsernames.length > 0;


  useEffect(() => {
    if (!bottomRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 250;

    if (isNearBottom || messages.length <= 40) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isSomeoneTyping]);


  const handleScroll = () => {
    if (!containerRef.current || isLoading || !hasMore) return;
    if (containerRef.current.scrollTop === 0) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
      onLoadMore();
    }
  };


  useEffect(() => {
    if (containerRef.current && prevScrollHeightRef.current > 0) {
      const addedHeight = containerRef.current.scrollHeight - prevScrollHeightRef.current;
      containerRef.current.scrollTop = addedHeight;
      prevScrollHeightRef.current = 0;
    }
  }, [messages]);


  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let currentDate = null;

    msgs.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ type: 'date', date: msg.created_at });
      }
      groups.push({ type: 'message', message: msg });
    });
    return groups;
  };

  const formatDateDivider = (isoDate) => {
    const date = new Date(isoDate);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const grouped = groupMessagesByDate(messages);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        backgroundColor: 'var(--bg-chat)',
        backgroundImage: 'var(--bg-chat-pattern)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          {isLoading ? (
            <Loader2 size={18} color="var(--accent-primary)" className="animate-spin" />
          ) : (
            <span
              onClick={onLoadMore}
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-primary)',
                padding: '4px 12px',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              Scroll up for older messages
            </span>
          )}
        </div>
      )}

      {grouped.map((item, idx) => {
        if (item.type === 'date') {
          return (
            <div
              key={`date-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'center',
                margin: '12px 0 8px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-primary)',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-sm)',
                  textTransform: 'uppercase',
                }}
              >
                {formatDateDivider(item.date)}
              </span>
            </div>
          );
        }

        return (
          <MessageItem
            key={item.message.id}
            message={item.message}
            isGroup={isGroup}
            onStartEdit={onStartEdit}
            onDelete={onDelete}
          />
        );
      })}


      {isSomeoneTyping && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bubble-incoming)',
            borderRadius: '12px',
            padding: '8px 12px',
            width: 'fit-content',
            boxShadow: 'var(--shadow-sm)',
            margin: '4px 8px',
          }}
        >
          <div style={{ display: 'flex', gap: '3px' }}>
            <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />
            <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-primary)', animationDelay: '0.2s' }} />
            <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-primary)', animationDelay: '0.4s' }} />
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {typingUsernames.join(', ')} typing...
          </span>
        </div>
      )}

      <div ref={bottomRef} style={{ height: '4px' }} />
    </div>
  );
}
