import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { taskApi } from './services/api';

import AuthModal from './components/AuthModal';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import WorkDashboard from './components/WorkDashboard';
import CalendarView from './components/CalendarView';
import MyTeam from './components/MyTeam';
import CommunityChat from './components/CommunityChat';
import ClientDictionary from './components/ClientDictionary';
import TaskDirectory from './components/TaskDirectory';
import TaskModal from './components/TaskModal';
import GeminiAiModal from './components/GeminiAiModal';
import SettingsModal from './components/SettingsModal';
import ChatDrawer from './components/ChatDrawer';

function MainApp() {
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'calendar' | 'team' | 'community' | 'clients' | 'task-directory'
  const [tasks, setTasks] = useState([]);
  const [teamRequestsCount, setTeamRequestsCount] = useState(0);

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [initialTaskDate, setInitialTaskDate] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const loadTasks = async () => {
    try {
      const data = await taskApi.getAll();
      setTasks(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenTaskModal = (date = null) => {
    setTaskToEdit(null);
    setInitialTaskDate(date);
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setTaskToEdit(task);
    setInitialTaskDate(null);
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
      {/* Top Navbar (Universal search removed as requested) */}
      <Navbar
        onOpenAiChat={() => setShowAiModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {/* Main Workspace Layout */}
      <div className="main-layout">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          teamRequestsCount={teamRequestsCount}
        />

        {/* Content Area */}
        <main className="content-area">
          {activeTab === 'dashboard' && (
            <WorkDashboard
              tasks={tasks}
              setTasks={setTasks}
              onOpenNewTask={handleOpenTaskModal}
              onEditTask={handleEditTask}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              tasks={tasks}
              onUpdateTask={handleUpdateTask}
              onOpenNewTaskForDate={handleOpenTaskModal}
            />
          )}

          {activeTab === 'team' && (
            <MyTeam onRequestsUpdated={setTeamRequestsCount} />
          )}

          {activeTab === 'community' && (
            <CommunityChat />
          )}

          {activeTab === 'clients' && (
            <ClientDictionary onTasksUpdated={loadTasks} />
          )}

          {activeTab === 'task-directory' && (
            <TaskDirectory />
          )}
        </main>
      </div>

      {/* Floating Bottom-Right Team Chat Drawer */}
      <ChatDrawer />

      {/* Universal Task Creation & Edit Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskToEdit(null);
        }}
        onTaskCreated={loadTasks}
        initialDate={initialTaskDate}
        taskToEdit={taskToEdit}
      />

      {/* Dedicated Gemini AI Reasoning Flyout (Beside Profile) */}
      {showAiModal && (
        <GeminiAiModal
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
