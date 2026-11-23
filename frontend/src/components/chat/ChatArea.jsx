import React, { useState } from 'react';
import { MessageSquare, Lock, ShieldCheck } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';
import GroupInfoModal from './GroupInfoModal';

export default function ChatArea() {
  const {
    conversations,
    activeConversationId,
    messages,
    hasMoreMessages,
    isLoadingMessages,
    loadMessages,
    editMessage,
    deleteMessage,
  } = useChatStore();

  const [editingMessage, setEditingMessage] = useState(null);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const currentMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const hasMore = activeConversationId ? !!hasMoreMessages[activeConversationId] : false;

  const handleStartEdit = (msg) => {
    setEditingMessage(msg);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleSaveEdit = async (messageId, newText) => {
    await editMessage(messageId, newText);
    setEditingMessage(null);
  };

  const handleDelete = async (messageId) => {
    if (window.confirm('Delete this message for everyone?')) {
      await deleteMessage(messageId);
    }
  };

  if (!activeConversation) {
    return (
      <div
        className="chat-area-empty"
        style={{
          flex: 1,
          height: '100vh',
          backgroundColor: 'var(--bg-panel)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          borderBottom: '6px solid var(--accent-primary)',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 168, 132, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            marginBottom: '20px',
          }}
        >
          <MessageSquare size={36} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          TextingApp Web
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.5, marginBottom: '28px' }}>
          Send and receive messages in real time with individual contacts and groups. Clean, private, and fast.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <Lock size={13} />
          <span>Real-time WebSocket connection enabled</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="chat-area-container"
      style={{
        flex: 1,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-chat)',
        position: 'relative',
        minWidth: 0,
      }}
    >
      <ChatHeader
        conversation={activeConversation}
        onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
      />

      <MessageList
        conversation={activeConversation}
        messages={currentMessages}
        hasMore={hasMore}
        isLoading={isLoadingMessages}
        onLoadMore={() => loadMessages(activeConversation.id, true)}
        onStartEdit={handleStartEdit}
        onDelete={handleDelete}
      />

      <MessageComposer
        conversationId={activeConversation.id}
        editingMessage={editingMessage}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
      />

      {activeConversation.type === 'group' && (
        <GroupInfoModal
          isOpen={isGroupInfoOpen}
          onClose={() => setIsGroupInfoOpen(false)}
          conversation={activeConversation}
        />
      )}
    </div>
  );
}
