import React, { useState, useEffect, useRef } from 'react';
import { taskApi, clientApi, taskTypeApi, teamApi, getStoredUser, isTaskOwnedByCurrentUser } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Kanban,
  List,
  Filter,
  Search,
  CheckCircle2,
  Circle,
  Play,
  Check,
  CalendarClock,
  MoreVertical,
  Edit2,
  RotateCcw,
  ArrowRightLeft,
  Trash2,
  ExternalLink,
  Paperclip,
  Building,
  Calendar,
  Tag,
  Users,
  X
} from 'lucide-react';

export default function WorkDashboard({
  tasks,
  setTasks,
  user: propUser,
  onOpenNewTask,
  onEditTask
}) {
  const { t, lang } = useLanguage();
  const authContext = useAuth();
  const currentUser = propUser || authContext?.user || getStoredUser();

  const [activeWorkspace, setActiveWorkspace] = useState('Personal'); // 'Personal' | 'Team'
  const [activeView, setActiveView] = useState('kanban'); // 'kanban' | 'list'
  const [activeMobileColumn, setActiveMobileColumn] = useState('To Do');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [clients, setClients] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(() => teamApi.getActiveTeamId());

  // Listen for real-time task updates
  useEffect(() => {
    const handleSync = () => {
      taskApi.getAll().then(res => {
        if (Array.isArray(res)) setTasks(res);
      }).catch(() => {});
    };
    window.addEventListener('tasker_tasks_updated', handleSync);
    return () => window.removeEventListener('tasker_tasks_updated', handleSync);
  }, [setTasks]);

  // Active 3-dot dropdown menu tracker
  const [openMenuTaskId, setOpenMenuTaskId] = useState(null);

  // Carry forward date picker modal
  const [carryForwardTask, setCarryForwardTask] = useState(null);
  const [newCarryDate, setNewCarryDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  useEffect(() => {
    loadFilters();
  }, []);

  // Close 3-dot dropdown on window click
  useEffect(() => {
    const handleCloseMenu = () => setOpenMenuTaskId(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const loadFilters = async () => {
    try {
      const [cList, tList, tmList] = await Promise.all([
        clientApi.getAll(),
        taskTypeApi.getAll(),
        teamApi.getTeams()
      ]);
      setClients(cList);
      setTaskTypes(tList);
      setTeams(tmList || []);
      const activeId = teamApi.getActiveTeamId();
      if (activeId) {
        setSelectedTeamId(activeId);
      } else if (tmList && tmList.length > 0) {
        setSelectedTeamId(tmList[0]._id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const currentTeamObj = teams.find(t => t._id === selectedTeamId) || teams[0];
  const activeTeamMembers = currentTeamObj?.members || [];

  const getTaskTypeName = (taskItem) => {
    if (taskItem.taskTypeId && typeof taskItem.taskTypeId === 'object' && taskItem.taskTypeId.name) {
      return taskItem.taskTypeId.name;
    }
    if (taskItem.taskTypeId) {
      const found = taskTypes.find((t) => t._id === taskItem.taskTypeId);
      if (found) return found.name;
    }
    return null;
  };

  // Filter tasks based on workspace, selected team, member, search query, client, and task type
  const filteredTasks = tasks.filter((taskItem) => {
    if (taskItem.workspaceType !== activeWorkspace) return false;

    // Filter personal tasks strictly by user ownership so Elias Sunny doesn't see Zim's personal tasks!
    if (activeWorkspace === 'Personal') {
      if (!isTaskOwnedByCurrentUser(taskItem, currentUser)) return false;
    }

    // Filter out future scheduled tasks from today's Work Dashboard (user requirement: future date tasks show in calendar view)
    const taskDateStr = (taskItem.dueDate || taskItem.scheduledDate || '').split('T')[0];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (taskDateStr && taskDateStr > todayStr) {
      return false;
    }

    if (activeWorkspace === 'Team' && selectedTeamId) {
      const itemTeamId = taskItem.teamId?._id || taskItem.teamId;
      if (itemTeamId && itemTeamId !== selectedTeamId) return false;
      if (!itemTeamId && teams.length > 0 && selectedTeamId !== teams[0]._id) return false;

      // Filter by Member in Team Dashboard
      if (selectedMember) {
        const assignedId = taskItem.assignedTo?._id || taskItem.assignedTo?.username || taskItem.assignedTo;
        if (assignedId !== selectedMember) return false;
      }
    }
    if (selectedClient && taskItem.clientId?._id !== selectedClient && taskItem.clientId !== selectedClient) return false;
    if (selectedType && taskItem.taskTypeId?._id !== selectedType && taskItem.taskTypeId !== selectedType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = taskItem.title?.toLowerCase().includes(q);
      const matchBrief = taskItem.brief?.toLowerCase().includes(q);
      if (!matchTitle && !matchBrief) return false;
    }
    return true;
  });

  // Change task status
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const updated = await taskApi.update(taskId, { status: newStatus });
      setTasks((prev) => prev.map((item) => (item._id === taskId ? { ...item, ...updated, status: newStatus } : item)));
    } catch (e) {
      console.error(e);
    }
  };

  // Carry forward task to new date
  const handleCarryForwardSubmit = async (e) => {
    e.preventDefault();
    if (!carryForwardTask || !newCarryDate) return;
    try {
      const updated = await taskApi.update(carryForwardTask._id, {
        scheduledDate: new Date(newCarryDate).toISOString()
      });
      setTasks((prev) => prev.map((item) => (item._id === carryForwardTask._id ? { ...item, ...updated } : item)));
      setCarryForwardTask(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Quick carry forward (+1 Day shortcut)
  const handleQuickCarryTomorrow = async (taskItem) => {
    const current = new Date(taskItem.scheduledDate || new Date());
    current.setDate(current.getDate() + 1);
    const nextDate = current.toISOString();
    try {
      const updated = await taskApi.update(taskItem._id, { scheduledDate: nextDate });
      setTasks((prev) => prev.map((item) => (item._id === taskItem._id ? { ...item, ...updated } : item)));
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle workspace (Personal <-> Team)
  const handleToggleWorkspace = async (taskId) => {
    try {
      const res = await taskApi.toggleWorkspace(taskId);
      setTasks((prev) => prev.map((item) => (item._id === taskId ? { ...item, workspaceType: res.workspaceType } : item)));
    } catch (e) {
      console.error(e);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    const confirmMsg = lang === 'bn' ? 'আপনি কি নিশ্চিত যে এই টাস্কটি মুছতে চান?' : 'Are you sure you want to delete this task?';
    if (confirm(confirmMsg)) {
      try {
        await taskApi.delete(taskId);
        setTasks((prev) => prev.filter((item) => item._id !== taskId));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Personal View Columns: To Do, In Progress, Done
  const personalColumns = [
    { id: 'To Do', title: t.todo, color: 'badge-todo', tasks: filteredTasks.filter(t => t.status === 'To Do') },
    { id: 'In Progress', title: t.inProgress, color: 'badge-progress', tasks: filteredTasks.filter(t => t.status === 'In Progress') },
    { id: 'Done', title: t.done, color: 'badge-done', tasks: filteredTasks.filter(t => t.status === 'Done') }
  ];

  // Team View Columns (Requested 4 boards: To Do, In Progress, Submit for Review, Approved)
  const teamColumns = [
    { id: 'To Do', title: t.todo, color: 'badge-todo', tasks: filteredTasks.filter(t => t.status === 'To Do') },
    { id: 'In Progress', title: t.inProgress, color: 'badge-progress', tasks: filteredTasks.filter(t => t.status === 'In Progress') },
    { id: 'Submit for Review', title: t.submitForReview, color: 'badge-urgent', tasks: filteredTasks.filter(t => t.status === 'Submit for Review') },
    { id: 'Approved', title: t.approved, color: 'badge-done', tasks: filteredTasks.filter(t => t.status === 'Approved' || t.status === 'Done') }
  ];

  const activeColumns = activeWorkspace === 'Personal' ? personalColumns : teamColumns;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Workspace Header & Views Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 16
        }}
      >
        {/* Workspace Switcher: Personal vs Team + Team Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-card)',
              padding: 4,
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <button
              onClick={() => setActiveWorkspace('Personal')}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: activeWorkspace === 'Personal' ? 'var(--active-btn-text)' : 'var(--text-secondary)',
                background: activeWorkspace === 'Personal' ? 'var(--active-btn-bg)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              👤 {t.personal}
            </button>
            <button
              onClick={() => setActiveWorkspace('Team')}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: activeWorkspace === 'Team' ? 'var(--active-btn-text)' : 'var(--text-secondary)',
                background: activeWorkspace === 'Team' ? 'var(--active-btn-bg)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              👥 {t.team}
            </button>
          </div>

          {/* Team Workspace: Dedicated Team Selector Dropdown */}
          {activeWorkspace === 'Team' && teams.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-card)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <Users size={15} color="var(--text-muted)" />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {t.selectTeam || (lang === 'bn' ? 'টিম:' : 'Team:')}
              </span>
              <select
                value={selectedTeamId}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  teamApi.setActiveTeamId(e.target.value);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  padding: '4px 4px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {teams.map((tm) => (
                  <option key={tm._id} value={tm._id} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                    {tm.name} ({tm.members?.length || 1} {lang === 'bn' ? 'সদস্য' : 'members'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* View Switchers (Kanban | List) + Add Task Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              padding: 3
            }}
          >
            <button
              onClick={() => setActiveView('kanban')}
              className="btn btn-ghost"
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                borderRadius: 8,
                background: activeView === 'kanban' ? 'var(--bg-input)' : 'transparent',
                color: activeView === 'kanban' ? 'var(--primary)' : 'inherit',
                fontWeight: activeView === 'kanban' ? 700 : 500
              }}
              title="Kanban Board"
            >
              <Kanban size={16} /> {t.kanban}
            </button>
            <button
              onClick={() => setActiveView('list')}
              className="btn btn-ghost"
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                borderRadius: 8,
                background: activeView === 'list' ? 'var(--bg-input)' : 'transparent',
                color: activeView === 'list' ? 'var(--primary)' : 'inherit',
                fontWeight: activeView === 'list' ? 700 : 500
              }}
              title="List View"
            >
              <List size={16} /> {t.list}
            </button>
          </div>

          <button
            onClick={() => onOpenNewTask({ workspaceType: activeWorkspace, teamId: selectedTeamId })}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Plus size={18} /> {t.newTask}
          </button>
        </div>
      </div>

      {/* Filter Row: Search Bar on the LEFT, Filter Dropdowns shifted to the RIGHT */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14
        }}
      >
        {/* Left Side: Search Bar */}
        <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-card)'
            }}
          />
        </div>

        {/* Right Side: Filters (Client, Task Type, Reset) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Filter size={15} /> {t.filterBy}
          </div>

          {/* Team Member Filter (Requested for Team Dashboard) */}
          {activeWorkspace === 'Team' && (
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              style={{ padding: '7px 12px', fontSize: '0.8rem', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}
            >
              <option value="">{lang === 'bn' ? 'সকল মেম্বার (All Members)' : 'All Members'}</option>
              {activeTeamMembers.map((m) => {
                const mId = m._id || m.id || m.username;
                const mName = m.fullName || m.profile?.fullName || m.username;
                return (
                  <option key={mId} value={mId}>{mName}</option>
                );
              })}
            </select>
          )}

          {/* Client Filter */}
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            style={{ padding: '7px 12px', fontSize: '0.8rem', background: 'var(--bg-card)', borderRadius: 8 }}
          >
            <option value="">{t.allClients}</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          {/* Task Type Filter (formerly Category) */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ padding: '7px 12px', fontSize: '0.8rem', background: 'var(--bg-card)', borderRadius: 8 }}
          >
            <option value="">{t.allTaskTypes || t.allCategories || (lang === 'bn' ? 'সকল টাস্ক টাইপ' : 'All Task Types')}</option>
            {taskTypes.map((typeItem) => (
              <option key={typeItem._id} value={typeItem._id}>{typeItem.name}</option>
            ))}
          </select>

          {(selectedClient || selectedType || searchQuery) && (
            <button
              onClick={() => { setSelectedClient(''); setSelectedType(''); setSearchQuery(''); }}
              className="btn-ghost"
              style={{ fontSize: '0.78rem', color: 'var(--danger)', padding: '4px 8px' }}
            >
              {t.reset}
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: KANBAN BOARD */}
      {activeView === 'kanban' && (
        <>
          {/* Mobile Column Tabs Switcher */}
          <div className="mobile-only kanban-mobile-tabs" style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              padding: '4px 2px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}>
              {activeColumns.map((col) => {
                const isActive = activeMobileColumn === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setActiveMobileColumn(col.id)}
                    className={`btn-ghost ${isActive ? 'active' : ''}`}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '999px',
                      fontSize: '0.8rem',
                      fontWeight: isActive ? 700 : 500,
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: isActive ? 'var(--primary)' : 'var(--bg-surface)',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      border: isActive ? '1px solid var(--primary)' : 'var(--glass-border)',
                      boxShadow: isActive ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
                      flexShrink: 0
                    }}
                  >
                    <span>{col.title}</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--border-subtle)',
                        color: isActive ? '#ffffff' : 'var(--text-muted)'
                      }}
                    >
                      {col.tasks.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="kanban-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${activeColumns.length}, minmax(280px, 1fr))`,
              gap: 18,
              alignItems: 'start',
              overflowX: 'auto',
              paddingBottom: 16
            }}
          >
            {activeColumns.map((col) => (
              <div
                key={col.id}
                className={`kanban-column ${activeMobileColumn === col.id ? 'mobile-active-column' : 'mobile-hidden-column'}`}
                style={{
                  background: 'var(--bg-surface)',
                  border: 'var(--glass-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  minHeight: 480
                }}
              >
              {/* Column Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{col.title}</span>
                  <span className={`badge ${col.color}`}>{col.tasks.length}</span>
                </div>
              </div>

              {/* Column Tasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                {col.tasks.length === 0 ? (
                  <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border-subtle)', borderRadius: 12 }}>
                    {t.noTasksInCol}
                  </div>
                ) : (
                  col.tasks.map((taskItem) => {
                    const isDoneOrApproved = taskItem.status === 'Done' || taskItem.status === 'Approved';
                    const isMenuOpen = openMenuTaskId === taskItem._id;
                    const taskTypeName = getTaskTypeName(taskItem);

                    return (
                      <div
                        key={taskItem._id}
                        className="card"
                        style={{
                          padding: 14,
                          background: 'var(--bg-card)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          position: 'relative'
                        }}
                      >
                        {/* Top Bar: Task Type Badge & 3-Dot Menu */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          {taskTypeName ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-subtle)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: 'var(--text-main)'
                              }}
                            >
                              <Tag size={11} color="var(--text-muted)" />
                              {taskTypeName}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {taskItem.workspaceType === 'Team' ? '👥 Team' : '👤 Personal'}
                            </span>
                          )}

                          {/* 3-Dot Menu Button */}
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuTaskId(isMenuOpen ? null : taskItem._id);
                              }}
                              className="btn-ghost"
                              style={{ padding: 4, borderRadius: 6 }}
                              title="More options"
                            >
                              <MoreVertical size={16} color="var(--text-secondary)" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 'calc(100% + 4px)',
                                  width: 220,
                                  background: 'var(--bg-dropdown)',
                                  border: 'var(--glass-border)',
                                  borderRadius: 10,
                                  boxShadow: 'var(--shadow-lg)',
                                  padding: 6,
                                  zIndex: 100,
                                  animation: 'scaleUp 0.12s ease-out'
                                }}
                              >
                                {/* Edit Task */}
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuTaskId(null); onEditTask(taskItem); }}
                                  className="btn-ghost"
                                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                                >
                                  <Edit2 size={14} color="var(--primary)" /> {t.editTask}
                                </button>

                                {/* Carry Forward */}
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuTaskId(null); setCarryForwardTask(taskItem); }}
                                  className="btn-ghost"
                                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                                >
                                  <CalendarClock size={14} color="var(--accent)" /> {t.carryForward}
                                </button>

                                {/* Send back to To Do */}
                                {taskItem.status !== 'To Do' && (
                                  <button
                                    type="button"
                                    onClick={() => { setOpenMenuTaskId(null); handleStatusChange(taskItem._id, 'To Do'); }}
                                    className="btn-ghost"
                                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                                  >
                                    <RotateCcw size={14} color="var(--warning)" /> {t.sendBackTodo}
                                  </button>
                                )}

                                {/* Send back to In Progress (if in Review or Done) */}
                                {(taskItem.status === 'Submit for Review' || taskItem.status === 'Done' || taskItem.status === 'Approved') && (
                                  <button
                                    type="button"
                                    onClick={() => { setOpenMenuTaskId(null); handleStatusChange(taskItem._id, 'In Progress'); }}
                                    className="btn-ghost"
                                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                                  >
                                    <RotateCcw size={14} color="var(--warning)" /> {t.sendBackInProgress}
                                  </button>
                                )}

                                {/* Move between Personal and Team */}
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuTaskId(null); handleToggleWorkspace(taskItem._id); }}
                                  className="btn-ghost"
                                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                                >
                                  <ArrowRightLeft size={14} /> {taskItem.workspaceType === 'Personal' ? t.moveToTeam : t.moveToPersonal}
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuTaskId(null); handleDeleteTask(taskItem._id); }}
                                  className="btn-ghost"
                                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}
                                >
                                  <Trash2 size={14} /> {t.deleteTask}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Task Title */}
                        <h4 style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.4, margin: '2px 0 0' }}>
                          {taskItem.title}
                        </h4>

                        {taskItem.brief && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {taskItem.brief}
                          </p>
                        )}

                        {/* Tags & Metadata */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {taskItem.priority && (
                            <span className={`badge ${taskItem.priority === 'Urgent' ? 'badge-urgent' : taskItem.priority === 'High' ? 'badge-progress' : 'badge-todo'}`} style={{ fontSize: '0.65rem' }}>
                              {taskItem.priority}
                            </span>
                          )}

                          {taskItem.clientId && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--primary)' }}>
                              <Building size={12} /> {taskItem.clientId.name || 'Client'}
                            </span>
                          )}

                          {taskItem.sourceLink && (
                            <a
                              href={taskItem.sourceLink}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--accent)', textDecoration: 'none' }}
                            >
                              <ExternalLink size={12} /> Link
                            </a>
                          )}

                          {taskItem.localFileAttachments?.length > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Paperclip size={12} /> {taskItem.localFileAttachments.length}
                            </span>
                          )}
                        </div>

                        {/* Professional Action Buttons (Arrows removed!) */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
                          {/* Left: Prominent State Transition Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                            {/* TO DO CARD: Prominent "Start Work" Button */}
                            {taskItem.status === 'To Do' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(taskItem._id, 'In Progress')}
                                className="btn btn-primary"
                                style={{
                                  padding: '7px 16px',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  flex: 1
                                }}
                              >
                                <Play size={14} fill="currentColor" /> {t.startWork}
                              </button>
                            )}

                            {/* IN PROGRESS CARD: Prominent "Done" (or "Submit Review") + "Carry Forward" */}
                            {taskItem.status === 'In Progress' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(taskItem._id, activeWorkspace === 'Team' ? 'Submit for Review' : 'Done')}
                                  className="btn btn-primary"
                                  style={{
                                    padding: '7px 14px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    borderRadius: 8,
                                    flex: 1
                                  }}
                                >
                                  <Check size={14} /> {activeWorkspace === 'Team' ? t.submitReviewBtn : t.markDone}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCarryForwardTask(taskItem)}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: '7px 10px',
                                    fontSize: '0.78rem',
                                    borderRadius: 8
                                  }}
                                  title={t.carryForward}
                                >
                                  <CalendarClock size={15} color="var(--primary)" />
                                </button>
                              </>
                            )}

                            {/* SUBMIT FOR REVIEW (Team view): Prominent "Approve" Button */}
                            {taskItem.status === 'Submit for Review' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(taskItem._id, 'Approved')}
                                className="btn btn-primary"
                                style={{
                                  padding: '7px 16px',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  flex: 1,
                                  background: 'linear-gradient(135deg, #10b981, #059669)'
                                }}
                              >
                                <Check size={14} /> {t.approveBtn}
                              </button>
                            )}

                            {/* APPROVED / DONE: Completed badge */}
                            {isDoneOrApproved && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CheckCircle2 size={16} /> {taskItem.status === 'Approved' ? t.approved : t.done}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    )}

      {/* VIEW 2: LIST VIEW */}
      {activeView === 'list' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1.5fr 1fr 1fr 140px 100px', padding: '12px 16px', background: 'var(--bg-input)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div></div>
            <div>{t.taskTitleCol}</div>
            <div>{t.clientTaskTypeCol || t.clientCategoryCol || 'Client / Task Type'}</div>
            <div>{t.dateCol}</div>
            <div>{t.priorityCol}</div>
            <div style={{ textAlign: 'right' }}>{t.actionsCol}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredTasks.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {t.noTasksFound}
              </div>
            ) : (
              filteredTasks.map((taskItem) => {
                const isDone = taskItem.status === 'Done' || taskItem.status === 'Approved';
                const taskTypeName = getTaskTypeName(taskItem);
                return (
                  <div
                    key={taskItem._id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1.5fr 1fr 1fr 140px 100px',
                      padding: '14px 16px',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isDone ? 'rgba(16,185,129,0.03)' : 'transparent'
                    }}
                  >
                    <button
                      onClick={() => handleStatusChange(taskItem._id, isDone ? 'To Do' : 'Done')}
                      style={{ color: isDone ? 'var(--success)' : 'var(--text-muted)' }}
                    >
                      {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>

                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', textDecoration: isDone ? 'line-through' : 'none' }}>
                        {taskItem.title}
                      </span>
                      {taskItem.brief && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {taskItem.brief}
                        </p>
                      )}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {taskItem.clientId?.name || '—'}
                      </div>
                      {taskTypeName && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          <Tag size={10} /> {taskTypeName}
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(taskItem.scheduledDate || taskItem.createdAt).toLocaleDateString()}
                    </div>

                    <div>
                      <span className={`badge ${taskItem.priority === 'Urgent' ? 'badge-urgent' : taskItem.priority === 'High' ? 'badge-progress' : 'badge-todo'}`}>
                        {taskItem.priority}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        onClick={() => onEditTask(taskItem)}
                        className="btn-ghost"
                        style={{ padding: 4 }}
                        title={t.editTask}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => setCarryForwardTask(taskItem)}
                        className="btn-ghost"
                        style={{ padding: 4 }}
                        title={t.carryForward}
                      >
                        <CalendarClock size={15} color="var(--primary)" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(taskItem._id)}
                        className="btn-ghost"
                        style={{ padding: 4, color: 'var(--danger)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Carry Forward Date Selection Modal */}
      {carryForwardTask && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarClock size={18} color="var(--primary)" />
                {t.carryForward}
              </h3>
              <button onClick={() => setCarryForwardTask(null)} className="btn-ghost" style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCarryForwardSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>"{carryForwardTask.title}"</strong> {t.selectCarryForwardDate}
              </p>

              <div>
                <input
                  type="date"
                  required
                  value={newCarryDate}
                  onChange={(e) => setNewCarryDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                />
              </div>

              {/* Quick shortcut buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    const tom = new Date();
                    tom.setDate(tom.getDate() + 1);
                    setNewCarryDate(tom.toISOString().split('T')[0]);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '0.78rem' }}
                >
                  আগামীকাল (+1 Day)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextW = new Date();
                    nextW.setDate(nextW.getDate() + 7);
                    setNewCarryDate(nextW.toISOString().split('T')[0]);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '0.78rem' }}
                >
                  পরের সপ্তাহ (+7 Days)
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setCarryForwardTask(null)} className="btn btn-secondary">
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t.carryForward}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
