import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  FileText,
  Download,
  MoreVertical,
  Edit2,
  Trash2,
  Ban,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function MessageItem({
  message,
  isGroup,
  onStartEdit,
  onDelete,
}) {
  const { user } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const isMine = String(message.sender?.id) === String(user?.id);

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const renderStatus = () => {
    if (!isMine) return null;
    const status = message.overall_status || 'sent';
    if (status === 'read') {
      return <CheckCheck size={14} color="var(--status-read)" />;
    } else if (status === 'delivered') {
      return <CheckCheck size={14} color="var(--status-delivered)" />;
    } else {
      return <Check size={14} color="var(--status-sent)" />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        marginBottom: '6px',
        padding: '0 8px',
        position: 'relative',
      }}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div
        style={{
          maxWidth: '75%',
          minWidth: '120px',
          backgroundColor: isMine ? 'var(--bubble-outgoing)' : 'var(--bubble-incoming)',
          color: isMine ? 'var(--bubble-outgoing-text)' : 'var(--bubble-incoming-text)',
          borderRadius: '8px',
          padding: '6px 10px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          wordBreak: 'break-word',
        }}
      >

        {!isMine && isGroup && message.sender && (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent-primary)',
              marginBottom: '3px',
            }}
          >
            {message.sender.display_name || message.sender.username}
          </div>
        )}


        {isMine && !message.is_deleted && (
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              opacity: 0.7,
            }}
          >
            <MoreVertical size={14} />
          </button>
        )}


        {showMenu && (
          <div
            style={{
              position: 'absolute',
              top: '24px',
              right: '4px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border-subtle)',
              zIndex: 20,
              overflow: 'hidden',
              minWidth: '130px',
            }}
          >
            {message.message_type === 'text' && (
              <div
                onClick={() => {
                  setShowMenu(false);
                  onStartEdit(message);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Edit2 size={13} />
                <span>Edit</span>
              </div>
            )}
            <div
              onClick={() => {
                setShowMenu(false);
                onDelete(message.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                color: 'var(--danger)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </div>
          </div>
        )}


        {message.attachments && message.attachments.length > 0 && !message.is_deleted && (
          <div style={{ marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {message.attachments.map((att) => (
              <div key={att.id}>
                {att.is_image ? (
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', borderRadius: '6px', overflow: 'hidden' }}
                  >
                    <img
                      src={att.file_url}
                      alt={att.original_name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '260px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        display: 'block',
                      }}
                    />
                  </a>
                ) : (
                  <a
                    href={att.file_url}
                    download={att.original_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      backgroundColor: 'rgba(0, 0, 0, 0.06)',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        padding: '6px',
                        backgroundColor: 'var(--accent-primary)',
                        borderRadius: '4px',
                        color: '#ffffff',
                        display: 'flex',
                      }}
                    >
                      <FileText size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {att.original_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatFileSize(att.file_size)}
                      </div>
                    </div>
                    <Download size={16} color="var(--text-muted)" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}


        {message.is_deleted ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontStyle: 'italic',
              fontSize: '13px',
              color: 'var(--text-muted)',
              padding: '2px 0',
            }}
          >
            <Ban size={14} />
            <span>This message was deleted</span>
          </div>
        ) : (
          message.text && (
            <div style={{ fontSize: '14px', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
              {message.text}
            </div>
          )
        )}


        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '4px',
            fontSize: '11px',
            color: 'var(--bubble-meta)',
            marginTop: '3px',
            float: 'right',
            marginLeft: '12px',
          }}
        >
          {message.is_edited && !message.is_deleted && (
            <span style={{ fontSize: '10px', fontStyle: 'italic', opacity: 0.8 }}>edited</span>
          )}
          <span>{formatTime(message.created_at)}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
}
