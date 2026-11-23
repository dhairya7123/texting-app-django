import React, { useState } from 'react';
import {
  MessageSquarePlus,
  Users,
  Settings,
  LogOut,
  Search,
  X,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import ConversationItem from './ConversationItem';
import UserSearchModal from './UserSearchModal';
import NewGroupModal from './NewGroupModal';
import ProfileModal from './ProfileModal';
import Avatar from '../common/Avatar';
import ThemeToggle from '../common/ThemeToggle';

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    isLoadingConversations,
    isSidebarOpen,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const filteredConversations = conversations.filter((c) =>
    c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div
        className={`sidebar-container ${isSidebarOpen ? 'open' : 'closed'}`}
        style={{
          width: '100%',
          maxWidth: '400px',
          height: '100vh',
          backgroundColor: 'var(--bg-primary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* User Profile Header */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            onClick={() => setIsProfileModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: '8px',
              transition: 'background-color 0.15s',
            }}
            title="Edit profile"
          >
            <Avatar
              src={user?.profile_picture_url}
              name={user?.display_name || user?.username}
              size="md"
              isOnline={true}
              showOnlineBadge={true}
            />
            <div style={{ maxWidth: '140px' }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.display_name || user?.username}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--online-dot)' }}>Online</div>
            </div>
          </div>

          {/* Action Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ThemeToggle />

            <button
              onClick={() => setIsSearchModalOpen(true)}
              title="New Chat"
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
              <MessageSquarePlus size={20} />
            </button>

            <button
              onClick={() => setIsGroupModalOpen(true)}
              title="New Group"
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
              <Users size={20} />
            </button>

            <button
              onClick={() => setIsProfileModalOpen(true)}
              title="Settings"
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
              <Settings size={20} />
            </button>

            <button
              onClick={logout}
              title="Logout"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '8px 14px', backgroundColor: 'var(--bg-primary)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-panel)',
              borderRadius: '8px',
              padding: '7px 12px',
              gap: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or start new chat"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '13px',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoadingConversations && conversations.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 size={24} color="var(--accent-primary)" className="animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {searchQuery ? 'No matching conversations.' : 'No conversations yet.'}
              </p>
              <button
                onClick={() => setIsSearchModalOpen(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Start a Chat
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onClick={() => setActiveConversation(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <UserSearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
      <NewGroupModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </>
  );
}
