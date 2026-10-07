import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { taskApi, peopleApi } from './services/api';
import { checkForUpdates } from './services/updateChecker';
import { Sparkles, Download } from 'lucide-react';

import AuthModal from './components/AuthModal';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import WorkDashboard from './components/WorkDashboard';
import CalendarView from './components/CalendarView';
import People from './components/People';
import MyTeam from './components/MyTeam';
import CommunityChat from './components/CommunityChat';
import ClientDictionary from './components/ClientDictionary';
import TaskDirectory from './components/TaskDirectory';
import TaskModal from './components/TaskModal';
import AiPlannerModal from './components/AiPlannerModal';
import SettingsModal from './components/SettingsModal';
import ChatDrawer from './components/ChatDrawer';
import AdminUsers from './components/admin/AdminUsers';
import AdminPlans from './components/admin/AdminPlans';
import { startTaskTimeMonitoring, stopTaskTimeMonitoring } from './services/notificationService';

function MainApp() {
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'calendar' | 'team' | 'community' | 'clients' | 'task-directory'
  const usernameLower = user?.username?.toLowerCase() || '';
  const isAdmin = user?.role === 'admin' ||
    usernameLower === 'zim' ||
    usernameLower === 'zim_founder' ||
    usernameLower === 'admin';

  // Guard: If non-admin user is on an admin tab, redirect to dashboard
  useEffect(() => {
    if (!isAdmin && (activeTab === 'admin-users' || activeTab === 'admin-plans')) {
      setActiveTab('dashboard');
    }
  }, [isAdmin, activeTab]);

  const [tasks, setTasks] = useState([]);
  const [teamRequestsCount, setTeamRequestsCount] = useState(0);
  const [pendingConnectionRequestsCount, setPendingConnectionRequestsCount] = useState(0);
  const [hasGlobalUnread, setHasGlobalUnread] = useState(() => {
    return localStorage.getItem('tasker_global_unread') === 'true';
  });

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [initialTaskDate, setInitialTaskDate] = useState(null);
  const [initialTaskWorkspace, setInitialTaskWorkspace] = useState('Personal');
  const [initialTaskTeamId, setInitialTaskTeamId] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tasksRef = useRef([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const loadPendingConnectionRequests = async () => {
    if (!user) return;
    try {
      const myId = user._id || user.id;
      const allRequests = await peopleApi.getConnectionRequests();
      const pendingForMe = allRequests.filter(r => r.receiverId === myId && r.status === 'pending');
      setPendingConnectionRequestsCount(pendingForMe.length);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) {
      loadTasks();
      loadPendingConnectionRequests();
      // Start background task time alert monitoring
      startTaskTimeMonitoring(() => tasksRef.current);

      // Weekly background update check
      checkForUpdates(false).then((info) => {
        if (info?.hasUpdate) {
          setAvailableUpdate(info);
        }
      }).catch(() => {});
    }
    return () => {
      stopTaskTimeMonitoring();
    };
  }, [user]);

  useEffect(() => {
    const handleUnreadChanged = (e) => {
      setHasGlobalUnread(e?.detail?.unread ?? (localStorage.getItem('tasker_global_unread') === 'true'));
    };
    const handleRequestsChanged = () => {
      loadPendingConnectionRequests();
    };

    window.addEventListener('tasker_global_unread_changed', handleUnreadChanged);
    window.addEventListener('tasker_connection_requests_updated', handleRequestsChanged);

    return () => {
      window.removeEventListener('tasker_global_unread_changed', handleUnreadChanged);
      window.removeEventListener('tasker_connection_requests_updated', handleRequestsChanged);
    };
  }, [user]);

  // When switching to community tab, mark global as read
  useEffect(() => {
    if (activeTab === 'community') {
      setHasGlobalUnread(false);
      localStorage.setItem('tasker_global_unread', 'false');
      window.dispatchEvent(new CustomEvent('tasker_global_unread_changed', { detail: { unread: false } }));
    }
  }, [activeTab]);

  const loadTasks = async () => {
    try {
      const data = await taskApi.getAll();
      setTasks(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenTaskModal = (params = null) => {
    setTaskToEdit(null);
    if (typeof params === 'string') {
      setInitialTaskDate(params);
      setInitialTaskWorkspace('Personal');
      setInitialTaskTeamId(null);
    } else if (params && typeof params === 'object') {
      setInitialTaskDate(params.date || null);
      setInitialTaskWorkspace(params.workspaceType || 'Personal');
      setInitialTaskTeamId(params.teamId || null);
    } else {
      setInitialTaskDate(null);
      setInitialTaskWorkspace('Personal');
      setInitialTaskTeamId(null);
    }
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setTaskToEdit(task);
    setInitialTaskDate(null);
    setInitialTaskWorkspace(task.workspaceType || 'Personal');
    setInitialTaskTeamId(task.teamId?._id || task.teamId || null);
    setShowTaskModal(true);
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const updated = await taskApi.update(taskId, updates);
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, ...updated } : t));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-app)', color: 'var(--text-main)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 600 }}>Tasker লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show the Login/Signup screen immediately
  if (!user) {
    return <AuthModal />;
  }

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        onOpenAiChat={() => setShowAiModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
      />

      {/* Main Workspace Layout */}
      <div className="main-layout">
        {/* Left Sidebar (Desktop Static & Mobile Slide-over Drawer) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setMobileMenuOpen(false);
          }}
          teamRequestsCount={teamRequestsCount}
          pendingConnectionRequestsCount={pendingConnectionRequestsCount}
          hasGlobalUnread={hasGlobalUnread}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onOpenAiChat={() => {
            setMobileMenuOpen(false);
            setShowAiModal(true);
          }}
          onOpenSettings={() => {
            setMobileMenuOpen(false);
            setShowSettingsModal(true);
          }}
        />

        {/* Content Area - Kept mounted for instantaneous 0ms section switching */}
        <main className="content-area">
          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <WorkDashboard
              tasks={tasks}
              setTasks={setTasks}
              user={user}
              onOpenNewTask={handleOpenTaskModal}
              onEditTask={handleEditTask}
            />
          </div>

          <div style={{ display: activeTab === 'calendar' ? 'block' : 'none' }}>
            <CalendarView
              tasks={tasks}
              onUpdateTask={handleUpdateTask}
              onOpenNewTaskForDate={handleOpenTaskModal}
              onEditTask={handleEditTask}
            />
          </div>

          <div style={{ display: activeTab === 'people' ? 'block' : 'none' }}>
            <People />
          </div>

          <div style={{ display: activeTab === 'team' ? 'block' : 'none' }}>
            <MyTeam
              onRequestsUpdated={setTeamRequestsCount}
              onOpenNewTask={handleOpenTaskModal}
              onTasksUpdated={loadTasks}
              tasks={tasks}
            />
          </div>

          <div style={{ display: activeTab === 'community' ? 'block' : 'none' }}>
            <CommunityChat />
          </div>

          <div style={{ display: activeTab === 'clients' ? 'block' : 'none' }}>
            <ClientDictionary onTasksUpdated={loadTasks} />
          </div>

          <div style={{ display: activeTab === 'task-directory' ? 'block' : 'none' }}>
            <TaskDirectory />
          </div>

          {/* Admin Management Views */}
          {isAdmin && (
            <>
              <div style={{ display: activeTab === 'admin-users' ? 'block' : 'none' }}>
                <AdminUsers currentUserId={user?._id || user?.id} />
              </div>

              <div style={{ display: activeTab === 'admin-plans' ? 'block' : 'none' }}>
                <AdminPlans />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Floating Bottom-Right Team Chat Drawer (Hidden on community chat to avoid overlap) */}
      <ChatDrawer hideTrigger={activeTab === 'community' || activeTab === 'people'} />

      {/* Universal Task Creation & Edit Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskToEdit(null);
        }}
        onTaskCreated={loadTasks}
        initialDate={initialTaskDate}
        initialWorkspaceType={initialTaskWorkspace}
        initialTeamId={initialTaskTeamId}
        taskToEdit={taskToEdit}
      />

      {/* Dedicated AI Planner & Time Management Modal */}
      {showAiModal && (
        <AiPlannerModal
          onClose={() => setShowAiModal(false)}
          onTasksCreated={loadTasks}
        />
      )}

      {/* Settings & Profile Edit Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Weekly Auto-Update Notification Modal */}
      {availableUpdate && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 440, padding: 26, textAlign: 'center', animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'var(--bg-app)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
              }}
            >
              <Sparkles size={26} color="var(--bg-app)" />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 6 }}>
              New Update Available!
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
              <strong>{availableUpdate.releaseName}</strong> is now ready to download.
            </p>

            <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 10, textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-muted)', maxHeight: 110, overflowY: 'auto', marginBottom: 18 }}>
              {availableUpdate.releaseNotes || 'Includes exciting new productivity features, faster response times, and fixes.'}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setAvailableUpdate(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Remind Next Week
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = availableUpdate.downloadUrl || availableUpdate.releaseUrl;
                  if (window.electronAPI?.openExternal) {
                    window.electronAPI.openExternal(url);
                  } else {
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }
                  setAvailableUpdate(null);
                }}
                className="btn btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Download size={15} />
                <span>Download Update</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </LanguageProvider>
  );
}
