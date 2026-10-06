import React, { useState, useEffect, useRef } from 'react';
import { taskTypeApi, teamApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  Plus,
  Trash2,
  Edit2,
  Tag,
  X,
  Users,
  User,
  AlertTriangle
} from 'lucide-react';

export default function TaskDirectory() {
  const { t, lang } = useLanguage();
  const inputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('Personal'); // 'Personal' | 'Team'
  const [types, setTypes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(() => teamApi.getActiveTeamId());
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState(null);

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('tasker_task_types_updated', handleSync);
    return () => window.removeEventListener('tasker_task_types_updated', handleSync);
  }, []);

  const loadData = async () => {
    try {
      const [typeList, teamList] = await Promise.all([
        taskTypeApi.getAll(),
        teamApi.getTeams()
      ]);
      setTypes(typeList || []);
      setTeams(teamList || []);

      const activeId = teamApi.getActiveTeamId();
      if (activeId) {
        setSelectedTeamId(activeId);
      } else if (teamList && teamList.length > 0) {
        setSelectedTeamId(teamList[0]._id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartEdit = (typeItem) => {
    setEditingId(typeItem._id);
    setName(typeItem.name);
    const ws = typeItem.workspaceType || 'Personal';
    setActiveTab(ws);
    if (typeItem.teamId) {
      const tId = typeItem.teamId?._id || typeItem.teamId;
      setSelectedTeamId(tId);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const submittedName = name.trim();
    const isEditing = !!editingId;
    const currentEditId = editingId;
    const payload = {
      name: submittedName,
      workspaceType: activeTab,
      teamId: activeTab === 'Team' ? selectedTeamId : null
    };

    // Instant reset & focus so user never feels UI lag
    setName('');
    setEditingId(null);
    setLoading(true);

    try {
      if (isEditing) {
        // Optimistic in-place update
        setTypes((prev) =>
          prev.map((item) =>
            item._id === currentEditId ? { ...item, ...payload } : item
          )
        );
        taskTypeApi.update(currentEditId, payload).then((updated) => {
          if (updated) {
            setTypes((prev) =>
              prev.map((item) =>
                item._id === currentEditId ? { ...item, ...payload, ...updated } : item
              )
            );
          }
        }).catch((err) => {
          console.error(err);
          loadData();
        });
      } else {
        const tempId = 'type_' + Date.now();
        const optimisticItem = {
          _id: tempId,
          ...payload
        };
        // Instantly add to list in 0ms
        setTypes((prev) => [...prev, optimisticItem]);

        taskTypeApi.create(payload).then((created) => {
          if (created && created._id) {
            setTypes((prev) =>
              prev.map((item) => (item._id === tempId ? created : item))
            );
          }
        }).catch((err) => {
          console.error('Failed to create task type in backend:', err);
        });
      }
    } catch (e) {
      console.error(e);
      loadData();
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleDelete = (typeItem) => {
    // In-app modal avoids Electron confirm() keyboard focus desync bug
    setTypeToDelete(typeItem);
  };

  const confirmDelete = async () => {
    if (!typeToDelete) return;
    const id = typeToDelete._id;
    setTypeToDelete(null);

    // Instant 0ms optimistic removal
    setTypes((prev) => prev.filter((item) => item._id !== id));
    if (editingId === id) handleCancelEdit();

    try {
      await taskTypeApi.delete(id);
    } catch (e) {
      console.error('Delete failed:', e);
      loadData();
    } finally {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Filter task types based on active tab and selected team
  const displayedTypes = types.filter((typeItem) => {
    const ws = typeItem.workspaceType || 'Personal';
    if (ws !== activeTab) return false;
    if (activeTab === 'Team' && selectedTeamId) {
      const tId = typeItem.teamId?._id || typeItem.teamId;
      if (tId && tId !== selectedTeamId) return false;
      // If legacy task type has no teamId assigned, show only for default team
      if (!tId && teams.length > 0 && selectedTeamId !== teams[0]._id) return false;
    }
    return true;
  });

  const personalCount = types.filter(t => (t.workspaceType || 'Personal') === 'Personal').length;
  const currentTeamObj = teams.find(tm => tm._id === selectedTeamId);
  const teamCount = types.filter(t => {
    if (t.workspaceType !== 'Team') return false;
    const tId = t.teamId?._id || t.teamId;
    return !tId || tId === selectedTeamId;
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>📁 {t.taskDirectoryTitle}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t.taskDirectorySubtitle}
          </p>
        </div>

        {/* Right side: Workspace Switcher - Pinned and fixed so buttons never jump or shift */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
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
              type="button"
              onClick={() => {
                setActiveTab('Personal');
                if (editingId) handleCancelEdit();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: activeTab === 'Personal' ? 'var(--active-btn-text)' : 'var(--text-secondary)',
                background: activeTab === 'Personal' ? 'var(--active-btn-bg)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              <User size={15} />
              <span>{t.personalTaskTypes || (lang === 'bn' ? 'ব্যক্তিগত টাস্ক টাইপ' : 'Personal Task Types')}</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-full)',
                  background: activeTab === 'Personal' ? 'var(--active-btn-icon-bg)' : 'var(--bg-input)',
                  color: activeTab === 'Personal' ? 'var(--active-btn-text)' : 'var(--text-muted)'
                }}
              >
                {personalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('Team');
                if (editingId) handleCancelEdit();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: activeTab === 'Team' ? 'var(--active-btn-text)' : 'var(--text-secondary)',
                background: activeTab === 'Team' ? 'var(--active-btn-bg)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              <Users size={15} />
              <span>{t.teamTaskTypes || (lang === 'bn' ? 'টিম টাস্ক টাইপ' : 'Team Task Types')}</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-full)',
                  background: activeTab === 'Team' ? 'var(--active-btn-icon-bg)' : 'var(--bg-input)',
                  color: activeTab === 'Team' ? 'var(--active-btn-text)' : 'var(--text-muted)'
                }}
              >
                {teamCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(360px, 1.4fr)', gap: 20 }}>
        {/* Create / Edit Task Type Card (Workspace Scope removed completely as requested) */}
        <div className="card" style={{ padding: 22, height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            {editingId ? (
              <>
                <Edit2 size={18} color="var(--primary)" /> {t.editTaskTypeTitle || (lang === 'bn' ? 'টাস্ক টাইপ এডিট করুন' : 'Edit Task Type')}
              </>
            ) : (
              <>
                <Plus size={18} color="var(--primary)" /> {t.addTaskTypeTitle || (lang === 'bn' ? 'নতুন টাস্ক টাইপ যোগ করুন' : 'Add New Task Type')}
              </>
            )}
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Task Type Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                {t.taskTypeNameLabel || (lang === 'bn' ? 'টাস্ক টাইপের নাম *' : 'Task Type Name *')}
              </label>
              <input
                ref={inputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.taskTypeNamePlaceholder || (lang === 'bn' ? 'যেমন: ইউআই ডিজাইন, বাগ ফিক্স, খামার কাজ...' : 'e.g. Code Review, UI Design, Farming...')}
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
              />
            </div>

            {/* Current Target Info Pill instead of redundant scope dropdown */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--bg-input)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)'
              }}
            >
              <span>{lang === 'bn' ? 'তৈরি হবে:' : 'Scope:'}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                {activeTab === 'Personal'
                  ? '👤 ' + (t.personal || 'Personal')
                  : `👥 ${currentTeamObj?.name || 'Team'}`}
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  <X size={15} /> {t.cancelEdit}
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ flex: editingId ? 1 : 'none' }}
              >
                {loading
                  ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                  : (editingId
                      ? (t.updateTaskTypeBtn || 'Update Task Type')
                      : (t.saveTaskTypeBtn || 'Save Task Type')
                    )
                }
              </button>
            </div>
          </form>
        </div>

        {/* Existing Task Types List (Partitioned by Tab and Team) */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              {activeTab === 'Personal'
                ? (t.personalTaskTypes || (lang === 'bn' ? 'ব্যক্তিগত টাস্ক টাইপ' : 'Personal Task Types'))
                : (lang === 'bn' ? `টিম টাস্ক টাইপ` : `Team Task Types`)} ({displayedTypes.length})
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {activeTab === 'Team' && teams.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--bg-input)',
                    padding: '3px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <Users size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{lang === 'bn' ? 'টিম:' : 'Team:'}</span>
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
                      fontSize: '0.82rem',
                      color: 'var(--text-main)',
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
              <span className="badge badge-todo" style={{ fontSize: '0.72rem' }}>
                {activeTab === 'Personal' ? '👤 Personal' : `👥 ${currentTeamObj?.name || 'Team'}`}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 520, overflowY: 'auto' }}>
            {displayedTypes.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border-subtle)', borderRadius: 12 }}>
                {t.noTaskTypesYet || (lang === 'bn' ? 'এই সেকশনে কোনো টাস্ক টাইপ তৈরি করা হয়নি।' : 'No task types created in this section yet.')}
              </div>
            ) : (
              displayedTypes.map((typeItem) => {
                const isBeingEdited = editingId === typeItem._id;
                return (
                  <div
                    key={typeItem._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: isBeingEdited ? 'var(--bg-hover)' : 'var(--bg-input)',
                      border: isBeingEdited ? '1.5px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Tag size={15} color="var(--text-main)" />
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          {typeItem.name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                          {typeItem.workspaceType === 'Team' ? `👥 ${currentTeamObj?.name || 'Team'}` : '👤 Personal'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(typeItem)}
                        className="btn-ghost"
                        style={{ padding: 6, color: 'var(--text-main)' }}
                        title={lang === 'bn' ? 'টাস্ক টাইপ এডিট করুন' : 'Edit Task Type'}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(typeItem)}
                        className="btn-ghost"
                        style={{ padding: 6, color: 'var(--danger)' }}
                        title={lang === 'bn' ? 'টাস্ক টাইপ মুছুন' : 'Delete Task Type'}
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
      </div>

      {/* In-app Delete Confirmation Modal (avoids Electron native dialog focus lock) */}
      {typeToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: 380, padding: 24, textAlign: 'center' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}
            >
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>
              {lang === 'bn' ? 'টাস্ক টাইপ মুছে ফেলবেন?' : 'Delete Task Type?'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              {lang === 'bn'
                ? `আপনি কি নিশ্চিত যে "${typeToDelete.name}" টাস্ক টাইপটি মুছে ফেলতে চান?`
                : `Are you sure you want to delete "${typeToDelete.name}"?`}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setTypeToDelete(null);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                {lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
