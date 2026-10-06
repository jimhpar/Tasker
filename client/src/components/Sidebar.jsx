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
  ChevronRight,
  Shield,
  Layers
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  teamRequestsCount = 0,
  pendingConnectionRequestsCount = 0,
  hasGlobalUnread = false
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
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
      icon: LayoutDashboard
    },
    {
      id: 'calendar',
      label: t.calendarView,
      sublabel: t.calendarSub,
      icon: Calendar
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
      badge: teamRequestsCount > 0 ? teamRequestsCount : null
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
    }
  ];

  return (
    <aside
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
        <div style={{ padding: '8px 12px 14px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {t.mainNavigation || 'Main Menu'}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
    </aside>
  );
}
