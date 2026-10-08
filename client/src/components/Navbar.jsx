import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { peopleApi } from '../services/api';
import appLogo from '../assets/logo.svg';
import {
  Sparkles,
  Bot,
  User,
  Sliders,
  LogOut,
  Moon,
  Sun,
  Laptop,
  ChevronDown,
  Languages,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCheck,
  Trash2,
  Menu,
  X,
  MessageSquare
} from 'lucide-react';
import {
  getStoredNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications
} from '../services/notificationService';
import { getGeminiKey } from '../services/gemini';

export default function Navbar({ onOpenAiChat, onOpenSettings, onToggleChat, hasChatUnread = false, mobileMenuOpen = false, onToggleMobileMenu }) {
  const { user, logout, theme, setTheme } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Gemini Key status
  const [hasGeminiKey, setHasGeminiKey] = useState(() => !!getGeminiKey(user?.username || user?._id));

  useEffect(() => {
    setHasGeminiKey(!!getGeminiKey(user?.username || user?._id));
  }, [user]);

  // Notification states
  const [notifications, setNotifications] = useState(getStoredNotifications);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('tasker_sound_alerts_muted') === 'true');
  const notifRef = useRef(null);

  useEffect(() => {
    const handleUpdate = () => {
      setNotifications(getStoredNotifications());
    };
    const handleKeyUpdate = () => {
      setHasGeminiKey(!!getGeminiKey(user?.username || user?._id));
    };
    window.addEventListener('tasker_notifications_updated', handleUpdate);
    window.addEventListener('tasker_gemini_key_updated', handleKeyUpdate);
    return () => {
      window.removeEventListener('tasker_notifications_updated', handleUpdate);
      window.removeEventListener('tasker_gemini_key_updated', handleKeyUpdate);
    };
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleMute = () => {
    const nextVal = !isMuted;
    setIsMuted(nextVal);
    localStorage.setItem('tasker_sound_alerts_muted', String(nextVal));
  };

  return (
    <header
      className="app-navbar-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--header-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: 'var(--glass-border)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      {/* Brand & Workspace Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Mobile Hamburger Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="btn btn-secondary mobile-only"
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            padding: 0,
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36
          }}
        >
          <img
            src={appLogo}
            alt="Logo"
            style={{ width: '100%', height: '100%', display: 'block' }}
            onError={(e) => {
              e.target.style.display = 'none';
              if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
            }}
          />
          <Sparkles size={20} color="#ffffff" style={{ display: 'none' }} />
        </div>
        <div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {t.appName}
          </span>
        </div>
      </div>

      {/* Right Actions: Language + AI Planner + Notification Bell + Profile Menu */}
      <div className="navbar-right-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Language Switcher Pill (BN / EN) */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="btn btn-secondary"
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          title={lang === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}
        >
          <Languages size={15} color="var(--primary)" />
          <span>{lang === 'bn' ? 'বাংলা' : 'EN'}</span>
        </button>

        {/* AI Planner Trigger Button (Desktop Only - mobile gets prominent card in drawer) */}
        <button
          type="button"
          onClick={onOpenAiChat}
          className={hasGeminiKey ? 'btn btn-primary desktop-only' : 'btn desktop-only'}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.85rem',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            ...(hasGeminiKey
              ? {
                  boxShadow: '0 2px 10px rgba(99, 102, 241, 0.25)'
                }
              : {
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  opacity: 0.85
                })
          }}
          title={
            hasGeminiKey
              ? (lang === 'bn' ? 'AI প্ল্যানার ও শিডিউল অ্যাসিস্ট্যান্ট (Gemini সক্রিয়)' : 'AI Planner & Schedule Assistant (Gemini Connected)')
              : (lang === 'bn' ? 'AI প্ল্যানার (Gemini API Key যুক্ত করুন)' : 'AI Planner (Connect Gemini API Key)')
          }
        >
          <Sparkles size={16} color={hasGeminiKey ? 'currentColor' : 'var(--text-muted)'} />
          <span style={{ fontWeight: 800, color: hasGeminiKey ? 'inherit' : 'var(--text-secondary)' }}>
            {lang === 'bn' ? 'AI প্ল্যানার' : 'AI Planner'}
          </span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: hasGeminiKey ? '#22c55e' : '#94a3b8',
              boxShadow: hasGeminiKey ? '0 0 8px #22c55e' : 'none'
            }}
          />
        </button>

        {/* Desktop Chat Launcher */}
        <button
          type="button"
          onClick={onToggleChat}
          className="btn btn-secondary desktop-only"
          style={{
            position: 'relative',
            padding: '8px 14px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          title={lang === 'bn' ? 'টিম ও ডিরেক্ট চ্যাট' : 'Chat & Messages'}
        >
          <MessageSquare size={16} color="var(--primary)" />
          <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
            {lang === 'bn' ? 'চ্যাট' : 'Chat'}
          </span>
          {hasChatUnread && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                boxShadow: '0 0 6px rgba(239, 68, 68, 0.7)'
              }}
            />
          )}
        </button>

        {/* Notification Bell with Badge & Dropdown */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            className="btn btn-secondary"
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
            title="Notifications & Time Alerts"
          >
            {unreadCount > 0 ? (
              <BellRing size={18} color="var(--primary)" />
            ) : (
              <Bell size={18} />
            )}
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                  minWidth: 16,
                  textAlign: 'center',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {notifOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 10px)',
                width: 340,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
                zIndex: 100,
                overflow: 'hidden',
                animation: 'scaleUp 0.15s ease-out'
              }}
            >
              {/* Notification Header */}
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--header-bg)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bell size={16} color="var(--primary)" />
                  <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                    {lang === 'bn' ? 'নোটিফিকেশন ও অ্যালার্ট' : 'Notifications & Alerts'}
                  </span>
                  {unreadCount > 0 && (
                    <span style={{ fontSize: '0.7rem', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>
                      {unreadCount} new
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="btn-ghost"
                    style={{ padding: 4, borderRadius: 6 }}
                    title={isMuted ? 'Unmute alert sounds' : 'Mute alert sounds'}
                  >
                    {isMuted ? <VolumeX size={15} color="#ef4444" /> : <Volume2 size={15} color="var(--text-muted)" />}
                  </button>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearAllNotifications()}
                      className="btn-ghost"
                      style={{ padding: 4, borderRadius: 6, color: 'var(--text-muted)' }}
                      title="Clear all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Notification Items List */}
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Bell size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '0.85rem', margin: 0, fontWeight: 600 }}>
                      {lang === 'bn' ? 'কোনো নতুন নোটিফিকেশন নেই' : 'No notifications yet'}
                    </p>
                    <p style={{ fontSize: '0.72rem', margin: '4px 0 0', opacity: 0.8 }}>
                      {lang === 'bn' ? 'কাজের সময় হলে AI আপনাকে অ্যালার্ট দেবে' : 'AI will alert you when tasks need attention'}
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: n.read ? 'transparent' : 'var(--primary-glow)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        transition: 'background 0.15s'
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: n.type === 'not_started' ? 'rgba(239, 68, 68, 0.12)' : n.type === 'in_progress_stuck' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                          color: n.type === 'not_started' ? '#ef4444' : n.type === 'in_progress_stuck' ? '#f59e0b' : 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 2
                        }}
                      >
                        {n.type === 'not_started' ? <AlertCircle size={15} /> : n.type === 'in_progress_stuck' ? <Clock size={15} /> : <Sparkles size={15} />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {n.title}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                          {n.message}
                        </p>
                        {n.type === 'connection_request' && n.requestId && (
                          <div style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await peopleApi.acceptConnectionRequest(n.requestId);
                                markAsRead(n.id);
                              }}
                              className="btn btn-primary"
                              style={{ padding: '3px 12px', fontSize: '0.72rem', borderRadius: 6 }}
                            >
                              {lang === 'bn' ? 'গ্রহণ করুন' : 'Accept Request'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Notification Footer */}
              {notifications.length > 0 && (
                <div style={{ padding: '8px 16px', background: 'var(--header-bg)', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    className="btn-ghost"
                    style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700, padding: '4px 8px' }}
                  >
                    <CheckCheck size={14} style={{ display: 'inline', marginRight: 4 }} />
                    {lang === 'bn' ? 'সব পঠিত হিসেবে চিহ্নিত করুন' : 'Mark all as read'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Avatar & Dropdown (Desktop Only - mobile gets profile card in drawer) */}
        <div className="desktop-only" style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px 4px 6px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              {user?.profile?.avatar ? (
                user.profile.avatar.length <= 4 ? user.profile.avatar : <img src={user.profile.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              ) : (
                (user?.username?.[0] || 'U').toUpperCase()
              )}
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.profile?.fullName || user?.username}
            </span>
            <ChevronDown size={14} color="var(--text-muted)" />
          </button>

          {/* Profile Dropdown Menu */}
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                width: 250,
                background: 'var(--bg-dropdown)',
                border: 'var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '8px 0',
                zIndex: 100,
                animation: 'scaleUp 0.15s ease-out'
              }}
            >
              {/* User Bio Header */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user?.profile?.fullName || user?.username}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{user?.username}</p>
              </div>

              {/* Theme Quick Toggle */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {t.themeLabel}
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { key: 'Dark', icon: Moon },
                    { key: 'Gray', icon: Laptop },
                    { key: 'Light', icon: Sun }
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setTheme(item.key)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: 6,
                          background: theme === item.key ? 'var(--active-btn-bg)' : 'var(--bg-input)',
                          color: theme === item.key ? 'var(--active-btn-text)' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title={item.key}
                      >
                        <Icon size={14} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Settings / Edit Info Button */}
              <button
                onClick={() => { setDropdownOpen(false); onOpenSettings(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  textAlign: 'left'
                }}
                className="btn-ghost"
              >
                <Sliders size={16} color="var(--primary)" />
                {t.settingsAndProfile}
              </button>

              {/* Logout Button */}
              <button
                onClick={() => { setDropdownOpen(false); logout(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  color: 'var(--danger)',
                  textAlign: 'left',
                  borderTop: '1px solid var(--border-subtle)',
                  marginTop: 4
                }}
                className="btn-ghost"
              >
                <LogOut size={16} />
                {t.logout}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
