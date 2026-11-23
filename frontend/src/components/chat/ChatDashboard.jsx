import React, { useEffect } from 'react';
import Sidebar from '../sidebar/Sidebar';
import ChatArea from './ChatArea';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import wsService from '../../services/websocket';

export default function ChatDashboard() {
  const { user } = useAuthStore();
  const {
    loadConversations,
    handleIncomingMessage,
    handleMessageDelivered,
    handleMessageRead,
    handleTypingUpdate,
    handlePresenceUpdate,
  } = useChatStore();

  useEffect(() => {
    if (!user) return;

    // 1. Load initial conversations list
    loadConversations();

    // 2. Connect WebSocket
    wsService.connect();

    // 3. Register real-time event handlers
    const unsubMsgNew = wsService.on('message.new', (data) => {
      if (data.message) {
        handleIncomingMessage(data.message);
      }
    });

    const unsubMsgDelivered = wsService.on('message.delivered', (data) => {
      if (data.receipt) {
        handleMessageDelivered(data.receipt);
      }
    });

    const unsubMsgRead = wsService.on('message.read', (data) => {
      if (data.receipt) {
        handleMessageRead(data.receipt);
      }
    });

    const unsubTyping = wsService.on('typing.update', (data) => {
      handleTypingUpdate(data);
    });

    const unsubPresence = wsService.on('presence.update', (data) => {
      handlePresenceUpdate(data);
    });

    return () => {
      unsubMsgNew();
      unsubMsgDelivered();
      unsubMsgRead();
      unsubTyping();
      unsubPresence();
      wsService.disconnect();
    };
  }, [user]);

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <Sidebar />
      <ChatArea />
    </div>
  );
}
