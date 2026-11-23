import React from 'react';

const COLORS = [
  '#00a884', '#128c7e', '#25d366', '#34b7f1',
  '#6b52ae', '#e542a3', '#ff8b00', '#d83a56'
];

export default function Avatar({
  src,
  name = 'User',
  size = 'md',
  isOnline = false,
  showOnlineBadge = false,
  className = ''
}) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const getInitials = (str) => {
    if (!str) return '?';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.substring(0, 2).toUpperCase();
  };

  const getColorIndex = (str) => {
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % COLORS.length;
  };

  const bgColor = COLORS[getColorIndex(name)];

  return (
    <div className={`relative inline-block select-none ${className}`} style={{ flexShrink: 0 }}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeClasses[size] || sizeClasses.md} rounded-full object-cover border border-[var(--border-subtle)]`}
          style={{
            width: size === 'sm' ? 32 : size === 'md' ? 40 : size === 'lg' ? 48 : 64,
            height: size === 'sm' ? 32 : size === 'md' ? 40 : size === 'lg' ? 48 : 64,
            borderRadius: '50%',
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div
          style={{
            width: size === 'sm' ? 32 : size === 'md' ? 40 : size === 'lg' ? 48 : 64,
            height: size === 'sm' ? 32 : size === 'md' ? 40 : size === 'lg' ? 48 : 64,
            borderRadius: '50%',
            backgroundColor: bgColor,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: size === 'sm' ? 12 : size === 'md' ? 14 : size === 'lg' ? 16 : 20,
          }}
        >
          {getInitials(name)}
        </div>
      )}

      {showOnlineBadge && isOnline && (
        <span
          title="Online"
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: size === 'sm' ? 9 : 12,
            height: size === 'sm' ? 9 : 12,
            borderRadius: '50%',
            backgroundColor: 'var(--online-dot)',
            border: '2px solid var(--bg-primary)',
          }}
        />
      )}
    </div>
  );
}
