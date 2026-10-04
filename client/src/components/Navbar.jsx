import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
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
  Languages
} from 'lucide-react';

export default function Navbar({ onOpenAiChat, onOpenSettings }) {
  const { user, logout, theme, setTheme } = useAuth();
  const { lang, toggleLanguage, setLanguage, t } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 4px 14px var(--primary-glow)'
          }}
        >
          <Sparkles size={22} color="#ffffff" />
        </div>
        <div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {t.appName}
          </span>
          <span
            style={{
              marginLeft: 8,
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
              background: 'var(--primary-glow)',
              color: 'var(--primary)',
              textTransform: 'uppercase'
            }}
          >
            {t.appBadge}
          </span>
        </div>
      </div>

      {/* Right Actions: Language Switcher + Gemini AI Button + Profile Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

        {/* Gemini AI Reasoning Assistant Trigger */}
        <button
          type="button"
          onClick={onOpenAiChat}
          className="btn btn-primary"
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.85rem',
            position: 'relative',
            overflow: 'hidden'
          }}
          title="Gemini AI Reasoning"
        >
          <Bot size={18} />
          <span style={{ fontWeight: 700 }}>{t.aiChat}</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e'
            }}
          />
        </button>

        {/* Profile Avatar & Dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
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
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
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
                          background: theme === item.key ? 'var(--primary)' : 'var(--bg-input)',
                          color: theme === item.key ? '#fff' : 'var(--text-secondary)',
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

              {/* Language Toggle in Dropdown */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Language:</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => setLanguage('bn')}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: lang === 'bn' ? 'var(--primary)' : 'var(--bg-input)',
                        color: lang === 'bn' ? '#fff' : 'var(--text-secondary)'
                      }}
                    >
                      বাংলা
                    </button>
                    <button
                      onClick={() => setLanguage('en')}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: lang === 'en' ? 'var(--primary)' : 'var(--bg-input)',
                        color: lang === 'en' ? '#fff' : 'var(--text-secondary)'
                      }}
                    >
                      EN
                    </button>
                  </div>
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
