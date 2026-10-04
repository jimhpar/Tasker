import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Globe,
  BookUser,
  FolderTree,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, teamRequestsCount = 0 }) {
  const { t } = useLanguage();

  const menuItems = [
    {
      id: 'dashboard',
      label: t.workDashboard,
      sublabel: t.currentWorkspace,
      icon: LayoutDashboard,
      color: '#6366f1'
    },
    {
      id: 'calendar',
      label: t.calendarView,
      sublabel: t.calendarSub,
      icon: Calendar,
      color: '#06b6d4'
    },
    {
      id: 'team',
      label: t.myTeam,
      sublabel: t.teamSub,
      icon: Users,
      color: '#10b981',
      badge: teamRequestsCount > 0 ? teamRequestsCount : null
    },
    {
      id: 'community',
      label: t.community,
      sublabel: t.communitySub,
      icon: Globe,
      color: '#8b5cf6'
    },
    {
      id: 'clients',
      label: t.clientDictionary,
      sublabel: t.clientSub,
      icon: BookUser,
      color: '#f59e0b'
    },
    {
      id: 'task-directory',
      label: t.taskDirectory,
      sublabel: t.taskDirectorySub,
      icon: FolderTree,
      color: '#ec4899'
    }
  ];

  return (
    <aside
      style={{
        width: 260,
        background: 'var(--bg-surface)',
        borderRight: 'var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 12px',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      <div>
        <div style={{ padding: '8px 12px 14px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          {t.mainNavigation}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--primary-glow)' : 'transparent',
                  border: isActive ? '1px solid var(--border-focus)' : '1px solid transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  textAlign: 'left',
                  transition: 'all 0.2s',
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
                    background: isActive ? 'var(--primary)' : 'var(--bg-card)',
                    color: isActive ? '#ffffff' : item.color,
                    flexShrink: 0
                  }}
                >
                  <Icon size={18} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--text-main)' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    {item.badge}
                  </span>
                )}

                {isActive && (
                  <ChevronRight size={16} color="var(--primary)" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Storage and System Info Footer */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          fontSize: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{t.storageMode}</span>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>{t.zeroCostStorage}</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: 1.4 }}>
          {t.storageDesc}
        </p>
      </div>
    </aside>
  );
}
