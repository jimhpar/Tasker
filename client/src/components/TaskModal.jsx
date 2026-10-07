import React, { useState, useEffect, useRef } from 'react';
import { taskApi, clientApi, taskTypeApi, teamApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  X,
  Plus,
  Mic,
  MicOff,
  Paperclip,
  Calendar,
  Link,
  Tag,
  Building,
  Users,
  Trash2,
  Check,
  AlertCircle,
  Bot,
  Clock,
  Sparkles
} from 'lucide-react';

import MediaViewerModal from './MediaViewerModal';

export default function TaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  initialDate = null,
  initialWorkspaceType = 'Personal',
  initialTeamId = null,
  taskToEdit = null
}) {
  const { t, lang } = useLanguage();

  const [clients, setClients] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [teams, setTeams] = useState([]);

  // Form fields
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [status, setStatus] = useState('To Do');
  const [priority, setPriority] = useState('Medium');
  const [workspaceType, setWorkspaceType] = useState('Personal');
  const [teamId, setTeamId] = useState('');
  const [clientId, setClientId] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [localFiles, setLocalFiles] = useState([]);

  // Media preview modal state
  const [previewFile, setPreviewFile] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Voice recording (Press & Hold or Tap to Record)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [dragStartX, setDragStartX] = useState(null);
  const [cancelSlideTriggered, setCancelSlideTriggered] = useState(false);
  const touchHandledRef = useRef(false);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // AI & Time Tracking fields
  const [engageAI, setEngageAI] = useState(true);
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [scheduledEndTime, setScheduledEndTime] = useState('');

  // Synchronize state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        setTitle(taskToEdit.title || '');
        setBrief(taskToEdit.brief || '');
        setSourceLink(taskToEdit.sourceLink || '');
        setStatus(taskToEdit.status || 'To Do');
        setPriority(taskToEdit.priority || 'Medium');
        setWorkspaceType(taskToEdit.workspaceType || 'Personal');
        setTeamId(taskToEdit.teamId?._id || taskToEdit.teamId || '');
        setClientId(taskToEdit.clientId?._id || taskToEdit.clientId || '');
        setTaskTypeId(taskToEdit.taskTypeId?._id || taskToEdit.taskTypeId || '');
        setEngageAI(taskToEdit.engageAI ?? true);
        setScheduledStartTime(taskToEdit.scheduledStartTime || '');
        setScheduledEndTime(taskToEdit.scheduledEndTime || '');
        setScheduledDate(
          taskToEdit.scheduledDate
            ? new Date(taskToEdit.scheduledDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
        );
        setDueDate(
          taskToEdit.dueDate
            ? new Date(taskToEdit.dueDate).toISOString().split('T')[0]
            : ''
        );
        setLocalFiles(taskToEdit.localFileAttachments || []);
      } else {
        setTitle('');
        setBrief('');
        setSourceLink('');
        setStatus('To Do');
        setPriority('Medium');
        setWorkspaceType(initialWorkspaceType || 'Personal');
        setTeamId(initialTeamId || teamApi.getActiveTeamId() || '');
        setClientId('');
        setEngageAI(true);
        setScheduledStartTime('');
        setScheduledEndTime('');
        setScheduledDate(
          initialDate
            ? new Date(initialDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
        );
        setDueDate('');
        setLocalFiles([]);
      }
    }
  }, [isOpen, taskToEdit, initialDate, initialWorkspaceType, initialTeamId]);

  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      const [cList, tList, tmList] = await Promise.all([
        clientApi.getAll(),
        taskTypeApi.getAll(),
        teamApi.getTeams()
      ]);
      setClients(cList || []);
      setTaskTypes(tList || []);
      setTeams(tmList || []);
      if (!taskToEdit && tList && tList.length > 0 && !taskTypeId) {
        setTaskTypeId(tList[0]._id);
      }
      if (!taskToEdit && tmList && tmList.length > 0 && !teamId) {
        setTeamId(initialTeamId || tmList[0]._id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Timer for voice recording
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Voice Recording Start
  const startRecording = () => {
    setCancelSlideTriggered(false);
    setIsRecording(true);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
        rec.continuous = true;
        rec.interimResults = true;

        rec.onresult = (ev) => {
          const transcript = Array.from(ev.results)
            .map(r => r[0].transcript)
            .join(' ');
          setVoiceTranscript(transcript);
        };

        rec.onerror = () => stopRecording(false);

        recognitionRef.current = rec;
        rec.start();
      } catch {
        // Fallback simulation
      }
    } else {
      setVoiceTranscript(lang === 'bn' ? 'জরুরি কোড রিভিউ এবং টেস্ট সম্পন্ন করা' : 'Review code and run unit tests');
    }
  };

  // Voice Recording Stop
  const stopRecording = (save = true) => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }

    if (save && voiceTranscript.trim()) {
      setTitle((prev) => prev ? `${prev} ${voiceTranscript.trim()}` : voiceTranscript.trim());
    }
    setVoiceTranscript('');
  };

  const cancelRecording = () => {
    setVoiceTranscript('');
    stopRecording(false);
  };

  // Press & Hold and Touch Handlers
  const handleMouseDown = (e) => {
    setDragStartX(e.clientX);
    startRecording();
  };

  const handleMouseUp = () => {
    if (isRecording) {
      stopRecording(!cancelSlideTriggered);
    }
  };

  const handleTouchStart = (e) => {
    touchHandledRef.current = true;
    setDragStartX(e.touches?.[0]?.clientX);
    startRecording();
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording(!cancelSlideTriggered);
    }
    setTimeout(() => {
      touchHandledRef.current = false;
    }, 300);
  };

  const handleClickMic = () => {
    if (touchHandledRef.current) return;
    if (isRecording) {
      stopRecording(true);
    } else {
      startRecording();
    }
  };

  const handleMouseMove = (e) => {
    if (!isRecording || dragStartX === null) return;
    const currentX = e.clientX || e.touches?.[0]?.clientX;
    if (dragStartX - currentX > 75) {
      setCancelSlideTriggered(true);
    }
  };

  // Local file attachment with Data URL conversion for local viewing and downloads
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const item = {
          name: file.name,
          fileName: file.name,
          size: file.size,
          fileSize: file.size,
          type: file.type,
          fileType: file.type,
          dataUrl: event.target.result,
        };
        setLocalFiles((prev) => [...prev, item]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = (index) => {
    setLocalFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenFileModal = (file) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(lang === 'bn' ? 'টাস্কের শিরোনাম দেওয়া আবশ্যক' : 'Task title is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        title: title.trim(),
        brief: brief.trim(),
        sourceLink: sourceLink.trim(),
        status,
        priority,
        workspaceType,
        teamId: workspaceType === 'Team' ? (teamId || null) : null,
        clientId: clientId || null,
        taskTypeId: taskTypeId || null,
        scheduledDate: new Date(scheduledDate).toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        scheduledStartTime: scheduledStartTime || null,
        scheduledEndTime: scheduledEndTime || null,
        engageAI,
        localFileAttachments: localFiles
      };

      if (taskToEdit) {
        await taskApi.update(taskToEdit._id, payload);
      } else {
        await taskApi.create(payload);
      }

      onTaskCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const formatSec = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-content no-scrollbar" style={{ maxWidth: 580, maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            {taskToEdit ? t.editTaskModalTitle : t.createTaskModalTitle}
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body - Unified Pro Mode */}
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Task Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
              {t.taskTitleLabel}
            </label>
            <input
              type="text"
              placeholder={t.taskTitlePlaceholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
              required
            />
          </div>

          {/* Scheduled Date & Workspace */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <Calendar size={14} style={{ display: 'inline', marginRight: 4 }} />
                {t.scheduledDateLabel}
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                {t.workspaceLabel}
              </label>
              <select
                value={workspaceType}
                onChange={(e) => setWorkspaceType(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="Personal">👤 {t.personal}</option>
                <option value="Team">👥 {t.team}</option>
              </select>
            </div>
          </div>

          {/* Scheduled Time Slots (Start & End Time) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <Clock size={14} style={{ display: 'inline', marginRight: 4 }} />
                {lang === 'bn' ? 'শুরুর সময় (Start Time)' : 'Start Time'}
              </label>
              <input
                type="time"
                value={scheduledStartTime}
                onChange={(e) => setScheduledStartTime(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <Clock size={14} style={{ display: 'inline', marginRight: 4 }} />
                {lang === 'bn' ? 'শেষের সময় (End Time)' : 'End Time'}
              </label>
              <input
                type="time"
                value={scheduledEndTime}
                onChange={(e) => setScheduledEndTime(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Engage AI Assistant Toggle Card */}
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: engageAI ? 'var(--primary-glow)' : 'var(--bg-input)',
              border: engageAI ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: engageAI ? 'var(--primary)' : 'var(--border-subtle)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {lang === 'bn' ? 'Engage AI (স্মার্ট টাইম ম্যানেজমেন্ট)' : 'Engage AI (Time Management & Alerts)'}
                  </span>
                  {engageAI && (
                    <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.3 }}>
                  {lang === 'bn'
                    ? 'কাজ শুরু না হলে অ্যালার্ট, আটকে থাকলে রিমাইন্ডার এবং সাউন্ড নোটিফিকেশন পাঠাবে।'
                    : 'AI monitors timeline, alerts if not started, and sounds alert when deadline nears.'}
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={engageAI}
              onChange={(e) => setEngageAI(e.target.checked)}
              style={{ width: 20, height: 20, cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Team Selection if Team Workspace is active */}
          {workspaceType === 'Team' && teams.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <Users size={14} style={{ display: 'inline', marginRight: 4 }} />
                {t.teamLabel || 'Select Team'} *
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                required
              >
                <option value="">{t.selectTeamPrompt || '-- Select Team --'}</option>
                {teams.map(tm => (
                  <option key={tm._id} value={tm._id}>{tm.name} ({tm.members?.length || 1} members)</option>
                ))}
              </select>
            </div>
          )}

          {/* Brief Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
              {t.briefLabel}
            </label>
            <textarea
              rows={2}
              placeholder={t.briefPlaceholder}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>

          {/* Source Link & Client Tagging */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <Link size={14} style={{ display: 'inline', marginRight: 4 }} />
                {t.sourceLinkLabel}
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={sourceLink}
                onChange={(e) => setSourceLink(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <Building size={14} style={{ display: 'inline', marginRight: 4 }} />
                {t.clientTagLabel}
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="">{t.noClientOption}</option>
                {clients.map(c => (
                  <option key={c._id} value={c._id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Task Type & Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <Tag size={14} style={{ display: 'inline', marginRight: 4 }} />
                {t.taskTypeLabel || t.categoryLabel || 'Task Type'}
              </label>
              <select
                value={taskTypeId}
                onChange={(e) => setTaskTypeId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="">{t.noTaskTypeOption || t.noCategoryOption || '-- General / None --'}</option>
                {taskTypes.map(typeItem => (
                  <option key={typeItem._id} value={typeItem._id}>{typeItem.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                {t.priorityLabel}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="Low">{t.priorityLow}</option>
                <option value="Medium">{t.priorityMedium}</option>
                <option value="High">{t.priorityHigh}</option>
                <option value="Urgent">{t.priorityUrgent}</option>
              </select>
            </div>
          </div>

          {/* Local File Attachment */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
              <Paperclip size={14} style={{ display: 'inline', marginRight: 4 }} />
              {t.fileAttachLabel}
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              style={{ width: '100%', padding: '8px', fontSize: '0.8rem', background: 'var(--bg-input)' }}
            />
            {localFiles.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {localFiles.map((f, i) => (
                  <div
                    key={i}
                    className="badge badge-todo"
                    style={{
                      fontSize: '0.75rem',
                      textTransform: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px'
                    }}
                  >
                    <span
                      onClick={() => handleOpenFileModal(f)}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      title="Click to view or download"
                    >
                      📎 {f.name || f.fileName} ({((f.size || f.fileSize || 0) / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(i);
                      }}
                      className="btn-ghost"
                      style={{ padding: 1, color: 'var(--danger)', borderRadius: '50%' }}
                      title="Remove file"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Voice Recording Status Drawer (when active) */}
          {isRecording && (
            <div
              style={{
                background: cancelSlideTriggered ? 'var(--danger-bg)' : 'var(--primary-glow)',
                border: `1.5px solid ${cancelSlideTriggered ? 'var(--danger)' : 'var(--primary)'}`,
                borderRadius: 14,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                animation: 'pulse 1.2s infinite'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'var(--font-code)' }}>
                  {formatSec(recordingSeconds)}
                </span>
                <span style={{ fontSize: '0.82rem', color: cancelSlideTriggered ? 'var(--danger)' : 'var(--text-main)' }}>
                  {cancelSlideTriggered
                    ? (lang === 'bn' ? 'ছেড়ে দিলে বাতিল হবে!' : 'Release to cancel!')
                    : (voiceTranscript || (lang === 'bn' ? 'কথা বলুন...' : 'Listening...'))}
                </span>
              </div>
              <button
                type="button"
                onClick={cancelRecording}
                className="btn-ghost"
                style={{ padding: 4, color: 'var(--danger)' }}
                title="Discard recording"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {/* Modal Footer: Voice Record in Bottom-Left + Cancel/Save in Bottom-Right */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
              marginTop: 4
            }}
          >
            {/* Circular Voice Record Button (Icon Only, No text) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={handleClickMic}
                className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isRecording ? '0 0 16px rgba(239,68,68,0.55)' : 'none',
                  border: isRecording ? '2px solid var(--danger)' : '1px solid var(--border-subtle)',
                  animation: isRecording ? 'pulse 1.2s infinite' : 'none',
                  flexShrink: 0
                }}
                title={lang === 'bn' ? 'ট্যাপ বা চেপে ধরে কথা বলুন' : 'Tap or hold to speak'}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} color="var(--primary)" />}
              </button>
              {isRecording && (
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--font-code)' }}>
                  {formatSec(recordingSeconds)}
                </span>
              )}
            </div>

            {/* Cancel & Save Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                {t.cancel}
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Plus size={16} />
                {loading
                  ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                  : (taskToEdit ? t.updateTask : t.saveTask)}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Universal Media & Attachment Lightbox Viewer */}
      <MediaViewerModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
      />
    </div>
  );
}
