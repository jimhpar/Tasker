import React, { useState, useEffect, useRef } from 'react';
import { taskApi, clientApi, taskTypeApi } from '../services/api';
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
  Trash2,
  Check,
  AlertCircle
} from 'lucide-react';

export default function TaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  initialDate = null,
  taskToEdit = null
}) {
  if (!isOpen) return null;

  const { t, lang } = useLanguage();

  const [clients, setClients] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);

  // Form fields
  const [title, setTitle] = useState(taskToEdit?.title || '');
  const [brief, setBrief] = useState(taskToEdit?.brief || '');
  const [sourceLink, setSourceLink] = useState(taskToEdit?.sourceLink || '');
  const [status, setStatus] = useState(taskToEdit?.status || 'To Do');
  const [priority, setPriority] = useState(taskToEdit?.priority || 'Medium');
  const [workspaceType, setWorkspaceType] = useState(taskToEdit?.workspaceType || 'Personal');
  const [clientId, setClientId] = useState(taskToEdit?.clientId?._id || taskToEdit?.clientId || '');
  const [taskTypeId, setTaskTypeId] = useState(taskToEdit?.taskTypeId?._id || taskToEdit?.taskTypeId || '');
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (taskToEdit?.scheduledDate) {
      return new Date(taskToEdit.scheduledDate).toISOString().split('T')[0];
    }
    return initialDate ? new Date(initialDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  });
  const [dueDate, setDueDate] = useState(() => {
    return taskToEdit?.dueDate ? new Date(taskToEdit.dueDate).toISOString().split('T')[0] : '';
  });
  const [localFiles, setLocalFiles] = useState(taskToEdit?.localFileAttachments || []);

  // Voice recording (Press & Hold or Click to Record)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [dragStartX, setDragStartX] = useState(null);
  const [cancelSlideTriggered, setCancelSlideTriggered] = useState(false);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      const [cList, tList] = await Promise.all([clientApi.getAll(), taskTypeApi.getAll()]);
      setClients(cList);
      setTaskTypes(tList);
      if (!taskToEdit && tList.length > 0 && !taskTypeId) {
        setTaskTypeId(tList[0]._id);
      }
    } catch (e) {
      console.error(e);
    }
  };

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

  // Press & Hold Handlers
  const handleMouseDown = (e) => {
    setDragStartX(e.clientX || e.touches?.[0]?.clientX);
    startRecording();
  };

  const handleMouseUp = () => {
    if (isRecording) {
      stopRecording(!cancelSlideTriggered);
    }
  };

  const handleMouseMove = (e) => {
    if (!isRecording || dragStartX === null) return;
    const currentX = e.clientX || e.touches?.[0]?.clientX;
    if (dragStartX - currentX > 75) {
      setCancelSlideTriggered(true);
    }
  };

  // Local file attachment
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newAttachments = files.map(f => ({
      fileName: f.name,
      fileSize: f.size,
      fileType: f.type,
      localPath: `C:/TaskerFiles/${f.name}`
    }));
    setLocalFiles(prev => [...prev, ...newAttachments]);
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
        clientId: clientId || null,
        taskTypeId: taskTypeId || null,
        scheduledDate: new Date(scheduledDate).toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
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

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 580 }}>
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
                <option value="Personal">{t.personal}</option>
                <option value="Team">{t.team}</option>
              </select>
            </div>
          </div>

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

          {/* Category & Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <Tag size={14} style={{ display: 'inline', marginRight: 4 }} />
                {t.categoryLabel}
              </label>
              <select
                value={taskTypeId}
                onChange={(e) => setTaskTypeId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="">{t.noCategoryOption}</option>
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
                  <span key={i} className="badge badge-todo" style={{ fontSize: '0.75rem', textTransform: 'none' }}>
                    📎 {f.fileName} ({(f.fileSize / 1024).toFixed(1)} KB)
                  </span>
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
            {/* WhatsApp-Style Voice Record Button in Bottom-Left Corner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchEnd={handleMouseUp}
                onMouseMove={handleMouseMove}
                onTouchMove={handleMouseMove}
                onClick={() => {
                  if (isRecording) {
                    stopRecording(true);
                  } else {
                    startRecording();
                  }
                }}
                className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: '8px 14px',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: isRecording ? '0 0 16px rgba(239,68,68,0.4)' : 'none',
                  userSelect: 'none'
                }}
                title={lang === 'bn' ? 'ক্লিক বা চেপে ধরে কথা বলুন' : 'Click or hold to speak'}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} color="var(--primary)" />}
                <span style={{ fontWeight: 600 }}>
                  {isRecording
                    ? (cancelSlideTriggered ? (lang === 'bn' ? 'বাতিল' : 'Cancel') : formatSec(recordingSeconds))
                    : t.voiceHoldText}
                </span>
              </button>

              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {isRecording
                  ? (lang === 'bn' ? '← বামে টানলে বাতিল' : '← Slide left to cancel')
                  : (lang === 'bn' ? 'ভয়েস ইনপুট' : 'Voice input')}
              </span>
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
    </div>
  );
}
