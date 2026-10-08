import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { taskApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  Trash2,
  RotateCcw,
  Search,
  Building,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Paperclip,
  FolderTree
} from 'lucide-react';

export default function TrashView({ onTasksUpdated }) {
  const { t, lang } = useLanguage();

  const [trashedTasks, setTrashedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState('All'); // 'All' | 'Personal' | 'Team'
  const [actionMessage, setActionMessage] = useState(null);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taskApi.getTrash();
      setTrashedTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load trash tasks:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrash();
    const handleSync = () => loadTrash();
    window.addEventListener('tasker_data_changed', handleSync);
    return () => window.removeEventListener('tasker_data_changed', handleSync);
  }, [loadTrash]);

  const showToast = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Restore Single Task
  const handleRestore = async (taskId, taskTitle) => {
    try {
      await taskApi.restore(taskId);
      setTrashedTasks(prev => prev.filter(item => item._id !== taskId));
      showToast(lang === 'bn' ? `"${taskTitle}" সফলভাবে পুনরুদ্ধার করা হয়েছে!` : `"${taskTitle}" restored successfully!`);
      onTasksUpdated && onTasksUpdated();
    } catch (e) {
      console.error(e);
      alert(lang === 'bn' ? 'টাস্ক পুনরুদ্ধার করা সম্ভব হয়নি।' : 'Failed to restore task.');
    }
  };

  // Restore All Tasks
  const handleRestoreAll = async () => {
    if (trashedTasks.length === 0) return;
    const confirmMsg = lang === 'bn'
      ? `আপনি কি ট্র্যাশের সব (${trashedTasks.length} টি) টাস্ক পুনরুদ্ধার করতে চান?`
      : `Are you sure you want to restore all ${trashedTasks.length} tasks?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      for (const tsk of trashedTasks) {
        await taskApi.restore(tsk._id);
      }
      setTrashedTasks([]);
      showToast(lang === 'bn' ? 'সবগুলো টাস্ক পুনরুদ্ধার করা হয়েছে!' : 'All tasks restored successfully!');
      onTasksUpdated && onTasksUpdated();
    } catch (e) {
      console.error(e);
      loadTrash();
      onTasksUpdated && onTasksUpdated();
    }
  };

  // Permanent Delete Single Task
  const handleDeletePermanent = async (taskId, taskTitle) => {
    const confirmMsg = lang === 'bn'
      ? `আপনি কি নিশ্চিত যে "${taskTitle}" টাস্কটি স্থায়ীভাবে মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।`
      : `Are you sure you want to permanently delete "${taskTitle}"? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await taskApi.deletePermanent(taskId);
      setTrashedTasks(prev => prev.filter(item => item._id !== taskId));
      showToast(lang === 'bn' ? `টাস্কটি স্থায়ীভাবে মুছে ফেলা হয়েছে।` : `Task permanently deleted.`);
      onTasksUpdated && onTasksUpdated();
    } catch (e) {
      console.error(e);
      alert(lang === 'bn' ? 'টাস্কটি মোছা সম্ভব হয়নি।' : 'Failed to delete task.');
    }
  };

  // Empty Entire Trash
  const handleEmptyTrash = async () => {
    if (trashedTasks.length === 0) return;
    const confirmMsg = lang === 'bn'
      ? `সতর্কতা: আপনি কি নিশ্চিত যে ট্র্যাশ খালি করতে চান? সব (${trashedTasks.length} টি) টাস্ক স্থায়ীভাবে মুছে যাবে এবং পুনরুদ্ধার করা যাবে না!`
      : `Warning: Are you sure you want to empty the trash? All ${trashedTasks.length} tasks will be permanently deleted and cannot be recovered!`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await taskApi.emptyTrash();
      setTrashedTasks([]);
      showToast(lang === 'bn' ? 'ট্র্যাশ সম্পূর্ণ খালি করা হয়েছে!' : 'Trash emptied successfully!');
      onTasksUpdated && onTasksUpdated();
    } catch (e) {
      console.error(e);
      alert(lang === 'bn' ? 'ট্র্যাশ খালি করা সম্ভব হয়নি।' : 'Failed to empty trash.');
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return trashedTasks.filter(item => {
      // Workspace filter
      if (workspaceFilter !== 'All' && item.workspaceType !== workspaceFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const briefMatch = (item.brief || '').toLowerCase().includes(q);
        const clientMatch = (item.clientId?.name || '').toLowerCase().includes(q);
        if (!titleMatch && !briefMatch && !clientMatch) return false;
      }
      return true;
    });
  }, [trashedTasks, workspaceFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Trash2 size={22} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
              {lang === 'bn' ? 'ট্র্যাশ বিন' : 'Trash Bin'}
            </h2>
            <span
              style={{
                fontSize: '0.75rem',
                background: 'var(--bg-input)',
                color: 'var(--text-muted)',
                padding: '2px 10px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700
              }}
            >
              {trashedTasks.length} {lang === 'bn' ? 'টি আইটেম' : 'items'}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {lang === 'bn'
              ? 'মুছে ফেলা টাস্কগুলো এখানে নিরাপদে জমা থাকে। প্রয়োজনে পুনরুদ্ধার করুন বা সম্পূর্ণ মুছে ফেলুন।'
              : 'Deleted tasks are safely stored here. Restore them back to your workspace or permanently delete.'}
          </p>
        </div>

        {/* Global Trash Controls: Restore All & Empty Trash */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleRestoreAll}
            disabled={trashedTasks.length === 0}
            className="btn btn-secondary"
            style={{
              padding: '8px 14px',
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: trashedTasks.length === 0 ? 0.5 : 1,
              cursor: trashedTasks.length === 0 ? 'not-allowed' : 'pointer'
            }}
            title={lang === 'bn' ? 'সবগুলো টাস্ক পুনরুদ্ধার করুন' : 'Restore all tasks'}
          >
            <RotateCcw size={15} />
            <span>{lang === 'bn' ? 'সব পুনরুদ্ধার করুন' : 'Restore All'}</span>
          </button>

          <button
            type="button"
            onClick={handleEmptyTrash}
            disabled={trashedTasks.length === 0}
            className="btn"
            style={{
              padding: '8px 14px',
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              opacity: trashedTasks.length === 0 ? 0.5 : 1,
              cursor: trashedTasks.length === 0 ? 'not-allowed' : 'pointer'
            }}
            title={lang === 'bn' ? 'ট্র্যাশ খালি করুন' : 'Empty Trash'}
          >
            <Trash2 size={15} />
            <span>{lang === 'bn' ? 'ট্র্যাশ খালি করুন' : 'Empty Trash'}</span>
          </button>
        </div>
      </div>

      {/* Floating Action Toast Alert */}
      {actionMessage && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: 'var(--success-bg)',
            border: '1px solid var(--success)',
            color: 'var(--success)',
            fontSize: '0.86rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar Card */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'bn' ? 'মুছে ফেলা টাস্ক খুঁজুন...' : 'Search deleted tasks...'}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Workspace Filter Segment */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-input)', padding: 4, borderRadius: 10 }}>
          {['All', 'Personal', 'Team'].map((ws) => (
            <button
              key={ws}
              type="button"
              onClick={() => setWorkspaceFilter(ws)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                background: workspaceFilter === ws ? 'var(--bg-card)' : 'transparent',
                color: workspaceFilter === ws ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: workspaceFilter === ws ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {ws === 'All' ? (lang === 'bn' ? 'সব' : 'All') : ws}
            </button>
          ))}
        </div>
      </div>

      {/* Main Trash Content */}
      {loading ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{lang === 'bn' ? 'ট্র্যাশ লোড হচ্ছে...' : 'Loading trash...'}</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '70px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'var(--bg-input)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              opacity: 0.6
            }}
          >
            <Trash2 size={28} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-main)' }}>
            {searchQuery || workspaceFilter !== 'All'
              ? (lang === 'bn' ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No matching deleted tasks')
              : (lang === 'bn' ? 'ট্র্যাশ সম্পূর্ণ খালি' : 'Trash is Empty')}
          </h3>
          <p style={{ fontSize: '0.82rem', margin: 0, maxWidth: 380, lineHeight: 1.5 }}>
            {searchQuery || workspaceFilter !== 'All'
              ? (lang === 'bn' ? 'অনুগ্রহ করে ভিন্ন কোনো শব্দ বা ফিল্টার দিয়ে চেষ্টা করুন।' : 'Try changing your search term or workspace filter.')
              : (lang === 'bn'
                  ? 'ক্যালেন্ডার ভিউ বা ড্যাশবোর্ড থেকে মুছে ফেলা টাস্কগুলো এখানে জমা হবে।'
                  : 'Tasks deleted from Calendar View or Work Dashboard will appear here.')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredTasks.map((taskItem) => {
            const deletedTimeStr = taskItem.deletedAt
              ? new Date(taskItem.deletedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
              : (taskItem.updatedAt ? new Date(taskItem.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently');

            return (
              <div
                key={taskItem._id}
                className="card"
                style={{
                  padding: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                  borderLeft: '4px solid #ef4444',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <div style={{ flex: 1, minWidth: 260 }}>
                  {/* Task Header Details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: taskItem.workspaceType === 'Team' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-input)',
                        color: taskItem.workspaceType === 'Team' ? '#6366f1' : 'var(--text-secondary)'
                      }}
                    >
                      {taskItem.workspaceType === 'Team' ? '👥 Team' : '👤 Personal'}
                    </span>

                    {taskItem.priority && (
                      <span
                        className={`badge ${taskItem.priority === 'Urgent' ? 'badge-urgent' : taskItem.priority === 'High' ? 'badge-progress' : 'badge-todo'}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {taskItem.priority}
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: '#ef4444',
                        background: 'rgba(239, 68, 68, 0.1)',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Trash2 size={11} /> {lang === 'bn' ? `মুছে ফেলা হয়েছে: ${deletedTimeStr}` : `Deleted: ${deletedTimeStr}`}
                    </span>
                  </div>

                  {/* Task Title */}
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-main)' }}>
                    {taskItem.title}
                  </h4>

                  {/* Task Brief */}
                  {taskItem.brief && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.4 }}>
                      {taskItem.brief}
                    </p>
                  )}

                  {/* Metadata Chips: Client, Scheduled Date, Files */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {taskItem.scheduledDate && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={13} />
                        {new Date(taskItem.scheduledDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}

                    {taskItem.clientId && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Building size={13} />
                        {taskItem.clientId.name || 'Client'}
                      </span>
                    )}

                    {taskItem.localFileAttachments?.length > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Paperclip size={13} />
                        {taskItem.localFileAttachments.length} {lang === 'bn' ? 'সংযুক্তি' : 'files'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleRestore(taskItem._id, taskItem.title)}
                    className="btn btn-secondary"
                    style={{
                      padding: '7px 12px',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    title={lang === 'bn' ? 'আগের জায়গায় পুনরুদ্ধার করুন' : 'Restore task'}
                  >
                    <RotateCcw size={14} color="var(--primary)" />
                    <span>{lang === 'bn' ? 'পুনরুদ্ধার' : 'Restore'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeletePermanent(taskItem._id, taskItem.title)}
                    className="btn-ghost"
                    style={{
                      padding: '7px 10px',
                      fontSize: '0.8rem',
                      borderRadius: 8,
                      color: '#ef4444',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title={lang === 'bn' ? 'স্থায়ীভাবে মুছে ফেলুন' : 'Delete permanently'}
                  >
                    <Trash2 size={15} />
                    <span className="desktop-only">{lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
