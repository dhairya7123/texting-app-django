import React, { useState, useEffect } from 'react';
import { X, Users, Shield, UserMinus, UserPlus, LogOut, Loader2 } from 'lucide-react';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import Avatar from '../common/Avatar';

export default function GroupInfoModal({ isOpen, onClose, conversation }) {
  const { user } = useAuthStore();
  const { loadConversations, setActiveConversation } = useChatStore();
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [potentialUsers, setPotentialUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  const currentMember = conversation?.members?.find((m) => String(m.user?.id) === String(user?.id));
  const isAdmin = currentMember?.role === 'admin';

  useEffect(() => {
    if (!isOpen || !conversation?.id) return;

    const fetchMembers = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/conversations/${conversation.id}/members/`);
        setMembers(res.data);
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [isOpen, conversation?.id]);

  if (!isOpen || !conversation) return null;

  const handleOpenAddMember = async () => {
    setIsAddingMember(true);
    try {
      const res = await api.get('/users/search/');
      // Filter out users already in the group
      const existingIds = new Set(members.map((m) => m.user?.id));
      const filtered = res.data.filter((u) => !existingIds.has(u.id));
      setPotentialUsers(filtered);
      if (filtered.length > 0) setSelectedUserId(filtered[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      await api.post(`/conversations/${conversation.id}/members/`, {
        user_ids: [selectedUserId],
      });
      // Refresh members
      const res = await api.get(`/conversations/${conversation.id}/members/`);
      setMembers(res.data);
      setIsAddingMember(false);
      loadConversations();
    } catch (err) {
      console.error('Failed to add member:', err);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.delete(`/conversations/${conversation.id}/members/${userId}/`);
      setMembers((prev) => prev.filter((m) => m.user?.id !== userId));
      loadConversations();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await api.delete(`/conversations/${conversation.id}/`);
      setActiveConversation(null);
      loadConversations();
      onClose();
    } catch (err) {
      console.error('Failed to leave group:', err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '85vh',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-subtle)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Group Info
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Group Details */}
        <div
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-panel)',
          }}
        >
          <Avatar src={conversation.avatar_url} name={conversation.title} size="xl" />
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: '12px', color: 'var(--text-primary)' }}>
            {conversation.title}
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Group • {members.length} members
          </span>
        </div>

        {/* Members Header & Add Action */}
        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Members ({members.length})
          </span>

          {isAdmin && (
            <button
              onClick={handleOpenAddMember}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <UserPlus size={16} />
              <span>Add Member</span>
            </button>
          )}
        </div>

        {/* Inline Add Member Picker */}
        {isAddingMember && (
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'var(--bg-panel)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              {potentialUsers.length === 0 ? (
                <option value="">No other contacts to add</option>
              ) : (
                potentialUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name || u.username} (@{u.username})
                  </option>
                ))
              )}
            </select>
            <button
              onClick={handleAddMember}
              disabled={!selectedUserId}
              style={{
                padding: '8px 14px',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: selectedUserId ? 'pointer' : 'not-allowed',
              }}
            >
              Add
            </button>
            <button
              onClick={() => setIsAddingMember(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Member List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0', minHeight: '160px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
              <Loader2 size={24} color="var(--accent-primary)" className="animate-spin" />
            </div>
          ) : (
            members.map((m) => {
              const u = m.user;
              const isUserAdmin = m.role === 'admin';
              const isCurrent = String(u?.id) === String(user?.id);

              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar
                      src={u?.profile_picture_url}
                      name={u?.display_name || u?.username}
                      size="sm"
                      isOnline={u?.is_online}
                      showOnlineBadge={true}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {u?.display_name || u?.username} {isCurrent && '(You)'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        @{u?.username}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isUserAdmin && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--accent-primary)',
                          backgroundColor: 'rgba(0, 168, 132, 0.12)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Shield size={11} /> Admin
                      </span>
                    )}

                    {isAdmin && !isCurrent && (
                      <button
                        onClick={() => handleRemoveMember(u?.id)}
                        title="Remove member"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          borderRadius: '4px',
                        }}
                      >
                        <UserMinus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Leave Group */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={handleLeaveGroup}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: 'var(--danger)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <LogOut size={16} />
            <span>Leave Group</span>
          </button>
        </div>
      </div>
    </div>
  );
}
