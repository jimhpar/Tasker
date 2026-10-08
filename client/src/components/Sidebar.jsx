import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  UserCheck,
  Users,
  Globe,
  BookUser,
  FolderTree,
  Trash2,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  X,
  Sliders,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import { getGeminiKey } from '../services/gemini';

export default function Sidebar({
  activeTab,
  setActiveTab,
  teamRequestsCount = 0,
  pendingConnectionRequestsCount = 0,
  hasGlobalUnread = false,
  mobileOpen = false,
  onCloseMobile,
  onOpenAiChat,
  onOpenSettings
}) {
  const { t, lang } = useLanguage();
  const { user, logout, theme, setTheme } = useAuth();
  const hasGeminiKey = !!getGeminiKey(user?.username || user?._id);
  const usernameLower = user?.username?.toLowerCase() || '';
  const isAdmin = user?.role === 'admin' ||
    usernameLower === 'zim' ||
    usernameLower === 'zim_founder' ||
    usernameLower === 'admin';

  const menuItems = [
    {
      id: 'dashboard',
      label: t.workDashboard,
      sublabel: t.currentWorkspace,
      icon: LayoutDashboard,
      isQuickAccess: true
    },
    {
      id: 'calendar',
      label: t.calendarView,
      sublabel: t.calendarSub,
      icon: Calendar,
      isQuickAccess: true
    },
    {
      id: 'people',
      label: t.people || 'People',
      sublabel: t.peopleSub || 'Contacts & Network',
      icon: UserCheck,
      badge: pendingConnectionRequestsCount > 0 ? pendingConnectionRequestsCount : null
    },
    {
      id: 'team',
      label: t.myTeam,
      sublabel: t.teamSub,
      icon: Users,
      badge: teamRequestsCount > 0 ? teamRequestsCount : null,
      isQuickAccess: true
    },
    {
      id: 'community',
      label: t.community,
      sublabel: t.communitySub,
      icon: Globe,
      hasDot: hasGlobalUnread
    },
    {
      id: 'clients',
      label: t.clientDictionary,
      sublabel: t.clientSub,
      icon: BookUser
    },
    {
      id: 'task-directory',
      label: t.taskDirectory,
      sublabel: t.taskDirectorySub,
      icon: FolderTree
    },
    {
      id: 'trash',
      label: t.trash || 'Trash',
      sublabel: t.trashSub || 'Deleted tasks & restore',
      icon: Trash2
    }
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop mobile-only"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`app-sidebar ${mobileOpen ? 'sidebar-open' : 'sidebar-closed'}`}
        style={{
          width: 260,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px 12px',
          userSelect: 'none',
          flexShrink: 0
        }}
      >
        <div>
          {/* Mobile Top Panel: User Profile & AI Planner (Shown only on mobile) */}
          <div
            className="mobile-only"
            style={{
              flexDirection: 'column',
              gap: 12,
              padding: '12px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 14
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    flexShrink: 0
                  }}
                >
                  {user?.profile?.avatar && user.profile.avatar.length > 4 ? (
                    <img src={user.profile.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                  ) : (
                    (user?.username?.[0] || 'U').toUpperCase()
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.profile?.fullName || user?.username}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    @{user?.username} • <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{user?.role || 'user'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)'
                }}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            {/* AI Planner Trigger Button for Mobile */}
            <button
              type="button"
              onClick={onOpenAiChat}
              className={hasGeminiKey ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: hasGeminiKey ? '0 2px 10px rgba(99, 102, 241, 0.25)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color={hasGeminiKey ? 'currentColor' : 'var(--text-muted)'} />
                <span>{lang === 'bn' ? 'AI প্ল্যানার' : 'AI Planner'}</span>
              </div>
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

            {/* Quick Settings & Theme Switcher on Mobile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={onOpenSettings}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem', gap: 6 }}
              >
                <Sliders size={14} />
                <span>{t.settings || 'Settings'}</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme(theme === 'Dark' ? 'Light' : 'Dark', true)}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                title="Toggle Theme"
              >
                {theme === 'Dark' ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} color="var(--primary)" />}
              </button>
            </div>
          </div>

          <div style={{ padding: '4px 10px 10px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {t.mainNavigation || 'Main Menu'}
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--active-btn-bg)' : 'transparent',
                  color: isActive ? 'var(--active-btn-text)' : 'var(--text-secondary)',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
                className={`${isActive ? '' : 'btn-ghost'}${item.isQuickAccess ? ' sidebar-quick-access-item' : ''}`}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: isActive ? 'var(--active-btn-icon-bg)' : 'var(--bg-input)',
                    color: isActive ? 'var(--active-btn-text)' : 'var(--text-main)',
                    flexShrink: 0
                  }}
                >
                  <Icon size={17} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--active-btn-text)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: isActive ? 'var(--active-btn-subtext)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.sublabel}
                  </div>
                </div>

                {item.badge && (
                  <span
                    style={{
                      background: 'var(--danger)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    {item.badge}
                  </span>
                )}

                {item.hasDot && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#ef4444',
                      boxShadow: '0 0 6px rgba(239, 68, 68, 0.7)',
                      flexShrink: 0
                    }}
                    title="New messages in Community"
                  />
                )}

                {isActive && (
                  <ChevronRight size={15} color="rgba(255, 255, 255, 0.7)" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Dedicated Admin Menu (Visible only for admin accounts) */}
        {isAdmin && (
          <div style={{ marginTop: 18 }}>
            <div style={{ padding: '8px 12px 8px', fontSize: '0.72rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={13} color="#ef4444" />
              <span>Admin Menu</span>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                {
                  id: 'admin-users',
                  label: 'Users',
                  sublabel: 'Manage & Assign Plans',
                  icon: Users
                },
                {
                  id: 'admin-plans',
                  label: 'Manage Plans',
                  sublabel: 'SaaS Tiers & Privileges',
                  icon: Layers
                }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'var(--active-btn-bg)' : 'transparent',
                      color: isActive ? 'var(--active-btn-text)' : 'var(--text-secondary)',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                    className={isActive ? '' : 'btn-ghost'}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: isActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.08)',
                        color: isActive ? 'var(--active-btn-text)' : '#ef4444',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={17} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--active-btn-text)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: isActive ? 'var(--active-btn-subtext)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.sublabel}
                      </div>
                    </div>

                    {isActive && (
                      <ChevronRight size={15} color="rgba(255, 255, 255, 0.7)" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Storage and System Info Footer */}
      <div
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          fontSize: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{t.storageMode || 'Storage Mode'}</span>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>• Local & P2P</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: 1.4 }}>
          Files are saved securely on your device, not on public cloud servers.
        </p>
      </div>

      {/* Logout Button at bottom of sidebar */}
      <button
        type="button"
        onClick={() => {
          if (onCloseMobile) onCloseMobile();
          logout();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ef4444',
          fontWeight: 600,
          fontSize: '0.85rem',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        className="btn-ghost mobile-only"
      >
        <LogOut size={16} />
        <span>{t.logout || 'Log Out'}</span>
      </button>
    </aside>
  </>
  );
}
