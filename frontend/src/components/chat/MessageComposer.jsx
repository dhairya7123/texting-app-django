import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import api from '../../api/client';
import wsService from '../../services/websocket';
import { useChatStore } from '../../stores/chatStore';

export default function MessageComposer({
  conversationId,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { sendMessage } = useChatStore();

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
      textareaRef.current?.focus();
    } else {
      setText('');
    }
  }, [editingMessage]);

  const handleTextChange = (e) => {
    setText(e.target.value);

    // Emit typing indicator
    if (!editingMessage && conversationId) {
      wsService.startTyping(conversationId);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        wsService.stopTyping(conversationId);
      }, 1800);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploadError('');
    setIsUploading(true);

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`File ${file.name} exceeds 10MB limit.`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversation_id', conversationId);

      try {
        const res = await api.post('/attachments/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setAttachments((prev) => [...prev, res.data]);
      } catch (err) {
        console.error('File upload failed:', err);
        setUploadError(err.response?.data?.error || 'Failed to upload file.');
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    if (isUploading) return;

    if (editingMessage) {
      if (text.trim()) {
        onSaveEdit(editingMessage.id, text.trim());
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    const attachmentIds = attachments.map((a) => a.id);
    sendMessage(trimmed, attachmentIds);

    // Clear state
    setText('');
    setAttachments([]);
    setUploadError('');

    // Stop typing immediately on send
    if (conversationId) {
      clearTimeout(typingTimeoutRef.current);
      wsService.stopTyping(conversationId);
    }

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0,
      }}
    >
      {/* Editing Banner */}
      {editingMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-panel)',
            padding: '6px 12px',
            borderRadius: '6px',
            borderLeft: '4px solid var(--accent-primary)',
            fontSize: '12px',
          }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>
            Editing message: <span style={{ color: 'var(--text-primary)' }}>"{editingMessage.text}"</span>
          </div>
          <button
            onClick={onCancelEdit}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0' }}>
          {attachments.map((att) => (
            <div
              key={att.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--bg-panel)',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {att.is_image ? <ImageIcon size={14} color="var(--accent-primary)" /> : <FileText size={14} />}
              <span style={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {att.original_name}
              </span>
              <button
                onClick={() => removeAttachment(att.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <div style={{ fontSize: '12px', color: 'var(--danger)', padding: '2px 4px' }}>
          {uploadError}
        </div>
      )}

      {/* Input Row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        {/* Paperclip */}
        {!editingMessage && (
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Attach document or photo"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.zip"
              style={{ display: 'none' }}
            />
          </div>
        )}

        {/* Text Input */}
        <div
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-panel)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={editingMessage ? 'Update message...' : 'Type a message...'}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'inherit',
              maxHeight: '120px',
              lineHeight: 1.4,
            }}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={(!text.trim() && attachments.length === 0) || isUploading}
          title="Send"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: (!text.trim() && attachments.length === 0) || isUploading ? 'default' : 'pointer',
            opacity: (!text.trim() && attachments.length === 0) || isUploading ? 0.6 : 1,
            transition: 'background-color 0.15s, opacity 0.15s',
            flexShrink: 0,
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
