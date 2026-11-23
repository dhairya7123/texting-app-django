import { create } from 'zustand';
import api from '../api/client';
import wsService from '../services/websocket';

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {}, // { [conversationId]: [ ...messages ] }
  hasMoreMessages: {}, // { [conversationId]: boolean }
  isLoadingConversations: false,
  isLoadingMessages: false,
  typingMap: {}, // { [conversationId]: { [userId]: username } }
  onlineMap: {}, // { [userId]: boolean }
  lastSeenMap: {}, // { [userId]: string }
  isSidebarOpen: true, // For responsive mobile view

  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

  loadConversations: async () => {
    set({ isLoadingConversations: true });
    try {
      const res = await api.get('/conversations/');
      const convs = res.data;
      
      // Update online status map from loaded members
      const onlineMap = { ...get().onlineMap };
      const lastSeenMap = { ...get().lastSeenMap };
      convs.forEach(c => {
        c.members?.forEach(m => {
          if (m.user) {
            onlineMap[m.user.id] = m.user.is_online;
            lastSeenMap[m.user.id] = m.user.last_seen;
          }
        });
      });

      set({
        conversations: convs,
        onlineMap,
        lastSeenMap,
        isLoadingConversations: false,
      });
    } catch (err) {
      console.error('Failed to load conversations:', err);
      set({ isLoadingConversations: false });
    }
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id, isSidebarOpen: false });
    if (id) {
      get().loadMessages(id);
      get().markConversationRead(id);
    }
  },

  loadMessages: async (conversationId, loadMore = false) => {
    if (!conversationId) return;
    const currentMsgs = get().messages[conversationId] || [];
    let before = null;

    if (loadMore && currentMsgs.length > 0) {
      before = currentMsgs[0].created_at;
    }

    set({ isLoadingMessages: true });
    try {
      const params = { limit: 40 };
      if (before) params.before = before;

      const res = await api.get(`/conversations/${conversationId}/messages/`, { params });
      const newBatch = res.data.results || [];
      const hasMore = res.data.has_more;

      set((state) => {
        const merged = loadMore ? [...newBatch, ...currentMsgs] : newBatch;
        return {
          messages: {
            ...state.messages,
            [conversationId]: merged,
          },
          hasMoreMessages: {
            ...state.hasMoreMessages,
            [conversationId]: hasMore,
          },
          isLoadingMessages: false,
        };
      });
    } catch (err) {
      console.error('Failed to load messages:', err);
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (text, attachmentIds = []) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    const idempotencyKey = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Try sending through WebSocket for lowest latency
    const wsSent = wsService.sendMessage(
      activeConversationId,
      text,
      idempotencyKey,
      attachmentIds
    );

    // Fallback to REST API if WS not open
    if (!wsSent) {
      try {
        const res = await api.post(`/conversations/${activeConversationId}/messages/`, {
          text,
          idempotency_key: idempotencyKey,
          message_type: attachmentIds.length > 0 ? 'attachment' : 'text',
        });
        get().handleIncomingMessage(res.data);
      } catch (err) {
        console.error('Failed to send message via REST:', err);
      }
    }
  },

  editMessage: async (messageId, newText) => {
    try {
      const res = await api.patch(`/messages/${messageId}/`, { text: newText });
      const updated = res.data;
      const convId = updated.conversation;

      set((state) => {
        const convMsgs = state.messages[convId] || [];
        return {
          messages: {
            ...state.messages,
            [convId]: convMsgs.map((m) => (m.id === updated.id ? updated : m)),
          },
        };
      });
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  },

  deleteMessage: async (messageId) => {
    try {
      const res = await api.delete(`/messages/${messageId}/`);
      const deleted = res.data;
      const convId = deleted.conversation;

      set((state) => {
        const convMsgs = state.messages[convId] || [];
        return {
          messages: {
            ...state.messages,
            [convId]: convMsgs.map((m) => (m.id === deleted.id ? deleted : m)),
          },
        };
      });
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  },

  markConversationRead: async (conversationId) => {
    try {
      wsService.sendRead(null, conversationId);
      // Also update local unread count
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        ),
      }));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  },

  createDirectConversation: async (recipientId) => {
    try {
      const res = await api.post('/conversations/', {
        type: 'direct',
        recipient_id: recipientId,
      });
      const conv = res.data;
      set((state) => {
        const exists = state.conversations.some((c) => c.id === conv.id);
        const nextConvs = exists
          ? state.conversations
          : [conv, ...state.conversations];
        return {
          conversations: nextConvs,
          activeConversationId: conv.id,
          isSidebarOpen: false,
        };
      });
      get().loadMessages(conv.id);
      return conv;
    } catch (err) {
      console.error('Failed to create direct conversation:', err);
      return null;
    }
  },

  createGroupConversation: async (name, memberIds) => {
    try {
      const res = await api.post('/conversations/', {
        type: 'group',
        name,
        member_ids: memberIds,
      });
      const conv = res.data;
      set((state) => ({
        conversations: [conv, ...state.conversations],
        activeConversationId: conv.id,
        isSidebarOpen: false,
      }));
      get().loadMessages(conv.id);
      return conv;
    } catch (err) {
      console.error('Failed to create group:', err);
      return null;
    }
  },

  // Real-time Event Handlers
  handleIncomingMessage: (msg) => {
    const convId = msg.conversation;
    set((state) => {
      const convMsgs = state.messages[convId] || [];
      // Prevent duplicates by ID or idempotency key
      const exists = convMsgs.some(
        (m) => m.id === msg.id || (msg.idempotency_key && m.idempotency_key === msg.idempotency_key)
      );
      const nextMsgs = exists
        ? convMsgs.map((m) => (m.id === msg.id || m.idempotency_key === msg.idempotency_key ? msg : m))
        : [...convMsgs, msg];

      // Update conversations list order and last message
      const nextConvs = state.conversations.map((c) => {
        if (c.id === convId) {
          const isCurrentActive = state.activeConversationId === convId;
          return {
            ...c,
            last_message: {
              id: msg.id,
              sender_id: msg.sender.id,
              sender_name: msg.sender.display_name || msg.sender.username,
              text: msg.text,
              message_type: msg.message_type,
              created_at: msg.created_at,
            },
            updated_at: msg.created_at,
            unread_count: isCurrentActive ? 0 : (c.unread_count || 0) + 1,
          };
        }
        return c;
      });

      // Sort conversations so the one with newest message is at top
      nextConvs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      return {
        messages: {
          ...state.messages,
          [convId]: nextMsgs,
        },
        conversations: nextConvs,
      };
    });

    // If this conversation is currently open, notify server that we read it
    const { activeConversationId } = get();
    if (activeConversationId === convId) {
      wsService.sendRead(msg.id, convId);
    } else {
      // Send delivered notification
      wsService.sendDelivered(msg.id, convId);
    }
  },

  handleMessageDelivered: (receipt) => {
    const { message_id, conversation_id } = receipt;
    set((state) => {
      const convMsgs = state.messages[conversation_id];
      if (!convMsgs) return state;

      return {
        messages: {
          ...state.messages,
          [conversation_id]: convMsgs.map((m) => {
            if (m.id === message_id && m.overall_status !== 'read') {
              return { ...m, overall_status: 'delivered' };
            }
            return m;
          }),
        },
      };
    });
  },

  handleMessageRead: (receipt) => {
    const { message_id, conversation_id } = receipt;
    set((state) => {
      const convMsgs = state.messages[conversation_id];
      if (!convMsgs) return state;

      return {
        messages: {
          ...state.messages,
          [conversation_id]: convMsgs.map((m) => {
            if (!message_id || m.id === message_id) {
              return { ...m, overall_status: 'read' };
            }
            return m;
          }),
        },
      };
    });
  },

  handleTypingUpdate: ({ conversation_id, user_id, username, is_typing }) => {
    set((state) => {
      const convTyping = { ...(state.typingMap[conversation_id] || {}) };
      if (is_typing) {
        convTyping[user_id] = username;
      } else {
        delete convTyping[user_id];
      }
      return {
        typingMap: {
          ...state.typingMap,
          [conversation_id]: convTyping,
        },
      };
    });
  },

  handlePresenceUpdate: ({ user_id, is_online, last_seen }) => {
    set((state) => ({
      onlineMap: {
        ...state.onlineMap,
        [user_id]: is_online,
      },
      lastSeenMap: {
        ...state.lastSeenMap,
        [user_id]: last_seen,
      },
    }));
  },
}));
