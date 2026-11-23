import api from '../api/client';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimeout = null;
    this.listeners = new Map();
    this.isConnecting = false;
  }

  getWsBaseUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = '8000';
    return `${protocol}//${host}:${port}/ws/chat/`;
  }

  async connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      // 1. Request secure one-time ticket from backend
      const res = await api.post('/auth/ws-ticket/');
      const ticket = res.data.ticket;

      const wsUrl = `${this.getWsBaseUrl()}?ticket=${ticket}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.emit('connection.open', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type) {
            this.emit(data.type, data);
            this.emit('*', data);
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.emit('connection.close', { code: event.code, reason: event.reason });
        if (event.code !== 4001) {
          // Reconnect with backoff unless explicitly unauthorized
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        this.isConnecting = false;
        this.emit('connection.error', err);
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;

    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close(1000, 'User logged out');
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in WS listener for ${event}:`, e);
        }
      });
    }
  }

  // Helper send methods
  sendMessage(conversationId, text, idempotencyKey = null, attachmentIds = []) {
    return this.send({
      type: 'message.send',
      conversation_id: conversationId,
      text,
      idempotency_key: idempotencyKey,
      attachment_ids: attachmentIds,
    });
  }

  sendDelivered(messageId, conversationId) {
    return this.send({
      type: 'message.delivered',
      message_id: messageId,
      conversation_id: conversationId,
    });
  }

  sendRead(messageId, conversationId) {
    return this.send({
      type: 'message.read',
      message_id: messageId,
      conversation_id: conversationId,
    });
  }

  startTyping(conversationId) {
    return this.send({
      type: 'typing.start',
      conversation_id: conversationId,
    });
  }

  stopTyping(conversationId) {
    return this.send({
      type: 'typing.stop',
      conversation_id: conversationId,
    });
  }
}

export const wsService = new WebSocketService();
export default wsService;
