import React from 'react';
import {
  LayoutDashboard,
  Users,
  Plus,
  MessageSquare,
  Calendar
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenNewTask,
  isChatOpen = false,
  onToggleChat,
  teamRequestsCount = 0,
  hasChatUnread = false
}) {
  const { t, lang } = useLanguage();

  return (
    <nav className="mobile-bottom-nav mobile-only" aria-label="Quick Access Navigation">
      {/* 1. Work Dashboard */}
      <button
        type="button"
        onClick={() => {
          if (isChatOpen && onToggleChat) onToggleChat();
          onTabChange('dashboard');
        }}
        className={`mobile-nav-btn ${activeTab === 'dashboard' && !isChatOpen ? 'active' : ''}`}
        aria-label={t.workDashboard || 'Work Dashboard'}
        title={t.workDashboard || 'Work Dashboard'}
      >
        <div className="mobile-nav-icon-wrapper">
          <LayoutDashboard size={21} strokeWidth={activeTab === 'dashboard' && !isChatOpen ? 2.5 : 2} />
        </div>
        <span className="mobile-nav-indicator" />
      </button>

      {/* 2. My Team */}
      <button
        type="button"
        onClick={() => {
          if (isChatOpen && onToggleChat) onToggleChat();
          onTabChange('team');
        }}
        className={`mobile-nav-btn ${activeTab === 'team' && !isChatOpen ? 'active' : ''}`}
        aria-label={t.myTeam || 'My Team'}
        title={t.myTeam || 'My Team'}
      >
        <div className="mobile-nav-icon-wrapper">
          <Users size={21} strokeWidth={activeTab === 'team' && !isChatOpen ? 2.5 : 2} />
          {teamRequestsCount > 0 && (
            <span className="mobile-nav-badge">
              {teamRequestsCount > 9 ? '9+' : teamRequestsCount}
            </span>
          )}
        </div>
        <span className="mobile-nav-indicator" />
      </button>

      {/* 3. Center Elevated Plus Icon (Add New Task) */}
      <div className="mobile-nav-fab-slot">
        <button
          type="button"
          onClick={onOpenNewTask}
          className="mobile-nav-fab-btn"
          aria-label={lang === 'bn' ? 'নতুন টাস্ক তৈরি করুন' : 'Add New Task'}
          title={lang === 'bn' ? 'নতুন টাস্ক তৈরি করুন' : 'Add New Task'}
        >
          <Plus size={26} strokeWidth={2.7} />
        </button>
      </div>

      {/* 4. Chat (Team & Individual Chat Drawer) */}
      <button
        type="button"
        onClick={onToggleChat}
        className={`mobile-nav-btn ${isChatOpen ? 'active' : ''}`}
        aria-label={lang === 'bn' ? 'টিম ও সরাসরি চ্যাট' : 'Team & Direct Chat'}
        title={lang === 'bn' ? 'টিম ও সরাসরি চ্যাট' : 'Team & Direct Chat'}
      >
        <div className="mobile-nav-icon-wrapper">
          <MessageSquare size={21} strokeWidth={isChatOpen ? 2.5 : 2} />
          {hasChatUnread && (
            <span className="mobile-nav-badge unread-dot" />
          )}
        </div>
        <span className="mobile-nav-indicator" />
      </button>

      {/* 5. Calendar */}
      <button
        type="button"
        onClick={() => {
          if (isChatOpen && onToggleChat) onToggleChat();
          onTabChange('calendar');
        }}
        className={`mobile-nav-btn ${activeTab === 'calendar' && !isChatOpen ? 'active' : ''}`}
        aria-label={t.calendarView || 'Calendar'}
        title={t.calendarView || 'Calendar'}
      >
        <div className="mobile-nav-icon-wrapper">
          <Calendar size={21} strokeWidth={activeTab === 'calendar' && !isChatOpen ? 2.5 : 2} />
        </div>
        <span className="mobile-nav-indicator" />
      </button>
    </nav>
  );
}
