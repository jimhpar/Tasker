import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { planDailyTasks, formatTime12h } from '../services/aiPlannerEngine';
import { executeAgentChat } from '../services/aiAgentService';
import { taskApi } from '../services/api';
import { playAlertChime, addNotification } from '../services/notificationService';
import {
  queryGeminiReasoning,
  getGeminiKey,
  setGeminiKey,
  removeGeminiKey,
  getActiveGeminiModelLabel,
  verifyGeminiKey,
  fetchLatestGeminiModel
} from '../services/gemini';
import {
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Zap,
  Check,
  ChevronRight,
  Bot,
  Layers,
  ArrowRight,
  Edit2,
  RefreshCw,
  Bell,
  Key,
  ExternalLink,
  ShieldCheck,
  Lock
} from 'lucide-react';

export default function AiPlannerModal({ onClose, onTasksCreated }) {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const userKey = user?.username || user?._id;

  // Gemini API Key Connection States
  const [hasApiKey, setHasApiKey] = useState(() => !!getGeminiKey(userKey));
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [inputKey, setInputKey] = useState(() => getGeminiKey(userKey));
  const [keyError, setKeyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [activeTab, setActiveTab] = useState('planner'); // 'planner' | 'assistant'
  const [plannerInput, setPlannerInput] = useState('');
  const [revisionInput, setRevisionInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [plannedTasks, setPlannedTasks] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [modelLabel, setModelLabel] = useState(getActiveGeminiModelLabel());

  useEffect(() => {
    const active = !!getGeminiKey(userKey);
    setHasApiKey(active);
    if (active) setInputKey(getGeminiKey(userKey));
    else setInputKey('');
  }, [userKey]);

  useEffect(() => {
    const handleModelUpdate = (e) => {
      setModelLabel(e?.detail?.label || getActiveGeminiModelLabel());
    };
    const handleKeyUpdate = (e) => {
      const active = !!getGeminiKey(userKey);
      setHasApiKey(active);
      if (active) setInputKey(getGeminiKey(userKey));
      else setInputKey('');
    };
    window.addEventListener('tasker_gemini_model_updated', handleModelUpdate);
    window.addEventListener('tasker_gemini_key_updated', handleKeyUpdate);
    return () => {
      window.removeEventListener('tasker_gemini_model_updated', handleModelUpdate);
      window.removeEventListener('tasker_gemini_key_updated', handleKeyUpdate);
    };
  }, [userKey]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleConnectKey = async (e) => {
    if (e) e.preventDefault();
    const cleanKey = inputKey.trim();
    if (!cleanKey) {
      setKeyError(lang === 'bn' ? 'অনুগ্রহ করে একটি API Key লিখুন' : 'Please provide an API key');
      return;
    }

    setIsVerifying(true);
    setKeyError('');

    try {
      const verifyRes = await verifyGeminiKey(cleanKey);
      if (verifyRes.valid) {
        setGeminiKey(cleanKey, userKey);
        setHasApiKey(true);
        setShowKeyConfig(false);

        // Auto discover latest model
        fetchLatestGeminiModel(cleanKey).then(res => {
          if (res?.label) setModelLabel(res.label);
        }).catch(() => {});
      } else {
        setKeyError(verifyRes.message || (lang === 'bn' ? 'API কী টি সঠিক নয়, অনুগ্রহ করে যাচাই করুন' : 'Invalid API key, please recheck'));
      }
    } catch (err) {
      setKeyError(err.message || 'Verification error');
    } finally {
      setIsVerifying(false);
    }
  };

  // Assistant Chat State
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'msg_welcome',
      sender: 'ai',
      text: lang === 'bn'
        ? 'নমস্কার! আমি আপনার Tasker Autonomous AI Agent 🤖।\n\nআপনি আমার সাথে স্বাভাবিকভাবে যেকোনো বিষয়ে কথা বলতে পারেন এবং আমাকে সফটওয়্যারের কাজ করতে বলতে পারেন—যেমন:\n• "বিকাল ৫টায় ক্লায়েন্ট মিটিং টাস্ক যুক্ত করো"\n• "আজকের কাজের তালিকা দেখাও"\n• "মিটিং টাস্ক ডান করো"\n\nআজ আপনাকে কীভাবে সাহায্য করতে পারি?'
        : 'Hello! I am your Tasker Autonomous AI Agent 🤖.\n\nYou can chat with me naturally and command me to manage your tasks—such as:\n• "Add client meeting task at 5pm"\n• "Show my tasks for today"\n• "Mark meeting task as completed"\n\nHow can I help you today?'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle Initial Plan Generation
  const handleGeneratePlan = async (e) => {
    if (e) e.preventDefault();
    if (!plannerInput.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const tasks = await planDailyTasks(plannerInput.trim());
      setPlannedTasks(tasks);
      playAlertChime();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  };

  // Handle Conversational Revision (e.g., "meeting ta 4 tay daw")
  const handleRevisePlan = async (e) => {
    e.preventDefault();
    if (!revisionInput.trim() || !plannedTasks) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const revised = await planDailyTasks(revisionInput.trim(), plannedTasks);
      setPlannedTasks(revised);
      setRevisionInput('');
      playAlertChime();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to revise schedule');
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection of individual task
  const handleToggleSelectTask = (taskId) => {
    setPlannedTasks(prev => prev.map(t => t.id === taskId ? { ...t, selected: !t.selected } : t));
  };

  // Manual inline time change
  const handleTimeChange = (taskId, field, value) => {
    setPlannedTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  // User Approval & Batch Creation
  const handleApprovePlan = async () => {
    if (!plannedTasks || plannedTasks.length === 0) return;
    const selectedTasks = plannedTasks.filter(t => t.selected);
    if (selectedTasks.length === 0) {
      setErrorMsg(lang === 'bn' ? 'অনুগ্রহ করে অন্তত একটি কাজ সিলেক্ট করুন' : 'Please select at least one task');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const todayDate = new Date().toISOString().split('T')[0];

      for (const t of selectedTasks) {
        await taskApi.create({
          title: t.title,
          brief: t.brief,
          status: 'To Do',
          priority: t.priority || 'Medium',
          category: t.category || 'General',
          dueDate: todayDate,
          scheduledStartTime: t.startTime,
          scheduledEndTime: t.endTime,
          engageAI: true
        });
      }

      playAlertChime();
      addNotification({
        title: lang === 'bn' ? '🤖 AI Planner: শিডিউল যুক্ত হয়েছে' : '🤖 AI Planner: Schedule Approved',
        message: lang === 'bn'
          ? `${selectedTasks.length}টি কাজ আপনার আজকের শিডিউলে যুক্ত হয়েছে। AI টাইম ট্র্যাকিং সক্রিয় রয়েছে।`
          : `${selectedTasks.length} tasks scheduled for today with active AI time tracking.`
      });

      setSuccessMsg(lang === 'bn' ? '🎉 চমৎকার! পরিকল্পনা অনুমোদিত হয়েছে এবং To-Do লিস্টে যুক্ত হয়েছে।' : '🎉 Plan approved! Tasks added to your schedule with AI tracking.');
      if (typeof onTasksCreated === 'function') {
        onTasksCreated();
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add tasks');
    } finally {
      setLoading(false);
    }
  };

  // Autonomous Agent Chat Handler
  const handleSendChat = async (e) => {
    e.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt) return;

    if (!hasApiKey) {
      setShowKeyConfig(true);
      return;
    }

    const userMsg = { id: 'msg_' + Date.now(), sender: 'user', text: prompt };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await executeAgentChat({
        message: prompt,
        history: chatMessages,
        lang,
        onTasksChanged: () => {
          if (typeof onTasksCreated === 'function') onTasksCreated();
        }
      });

      const replyText = (res && (res.text || res.message))
        ? String(res.text || res.message).trim()
        : (lang === 'bn' ? '✅ আপনার অনুরোধ অনুযায়ী কাজটি সম্পন্ন হয়েছে।' : '✅ Task action executed successfully.');

      setChatMessages(prev => [
        ...prev,
        {
          id: 'msg_' + Date.now(),
          sender: 'ai',
          text: replyText,
          actionExecuted: res?.actionExecuted
        }
      ]);
    } catch (err) {
      console.error('AI Agent chat error:', err);
      setChatMessages(prev => [
        ...prev,
        {
          id: 'msg_' + Date.now(),
          sender: 'ai',
          text: lang === 'bn'
            ? 'দুঃখিত, সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আপনার Gemini API কী সঠিক কিনা যাচাই করুন।'
            : 'Sorry, connection failed. Please check your Gemini API key.'
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 720,
          width: '92vw',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            background: 'var(--header-bg)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #090a0f, #2a2d3d)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <Sparkles size={20} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  AI Planner & Time Suite
                </h3>
                <span style={{ fontSize: '0.65rem', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>
                  {modelLabel}
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                {lang === 'bn' ? 'স্বয়ংক্রিয় সময় ব্যবস্থাপনা ও স্মার্ট দৈনিক শিডিউলিং' : 'Autonomous daily scheduling & time management'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hasApiKey ? (
              <>
                {/* Tab switch buttons */}
                <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 10, padding: 3 }}>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('planner'); setShowKeyConfig(false); }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: activeTab === 'planner' && !showKeyConfig ? 'var(--bg-card)' : 'transparent',
                      color: activeTab === 'planner' && !showKeyConfig ? 'var(--text-main)' : 'var(--text-muted)',
                      boxShadow: activeTab === 'planner' && !showKeyConfig ? '0 2px 6px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    📅 {lang === 'bn' ? 'AI প্ল্যানার' : 'AI Planner'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('assistant'); setShowKeyConfig(false); }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: activeTab === 'assistant' && !showKeyConfig ? 'var(--bg-card)' : 'transparent',
                      color: activeTab === 'assistant' && !showKeyConfig ? 'var(--text-main)' : 'var(--text-muted)',
                      boxShadow: activeTab === 'assistant' && !showKeyConfig ? '0 2px 6px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    💬 {lang === 'bn' ? 'অ্যাসিস্ট্যান্ট' : 'Assistant'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowKeyConfig(!showKeyConfig)}
                  className="btn-ghost"
                  style={{
                    padding: 6,
                    borderRadius: '50%',
                    color: showKeyConfig ? 'var(--primary)' : 'var(--text-muted)'
                  }}
                  title={lang === 'bn' ? 'Gemini API কী কনফিগার' : 'Configure Gemini API Key'}
                >
                  <Key size={17} />
                </button>
              </>
            ) : (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--warning)',
                  fontWeight: 700,
                  background: 'rgba(234, 179, 8, 0.1)',
                  padding: '4px 10px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <Key size={13} />
                {lang === 'bn' ? 'API কী প্রয়োজন' : 'API Key Required'}
              </span>
            )}

            <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: 6 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column' }}>
          {errorMsg && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '12px 16px', borderRadius: 10, fontSize: '0.9rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <CheckCircle2 size={18} />
              {successMsg}
            </div>
          )}

          {!hasApiKey ? (
            /* First-time API Key Connection Screen */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 16px', textAlign: 'center', maxWidth: 480, margin: 'auto' }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, #090a0f, #312e81)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)',
                  marginBottom: 16
                }}
              >
                <Key size={28} color="#818cf8" />
              </div>

              <h3 style={{ fontSize: '1.22rem', fontWeight: 800, marginBottom: 8 }}>
                {lang === 'bn' ? 'Google Gemini API Key সংযুক্ত করুন' : 'Connect Google Gemini API Key'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                {lang === 'bn'
                  ? 'AI প্ল্যানার ও স্বয়ংক্রিয় পার্সোনাল অ্যাসিস্ট্যান্ট ব্যবহার করতে আপনার Google AI Studio থেকে ফ্রি Gemini API কী প্রয়োজন। এটি ১-ক্লিক এ সম্পূর্ণ বিনামূল্যে পেয়ে যাবেন:'
                  : 'To activate the autonomous AI Planner & Assistant, connect your free Gemini API key from Google AI Studio. Generate one in seconds:'}
              </p>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{
                  fontSize: '0.82rem',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  marginBottom: 22,
                  textDecoration: 'none',
                  fontWeight: 700
                }}
              >
                <span>{lang === 'bn' ? 'Google AI Studio থেকে API Key নিন ↗' : 'Get Free Key from Google AI Studio ↗'}</span>
                <ExternalLink size={14} />
              </a>

              <form
                onSubmit={handleConnectKey}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  padding: '16px 18px',
                  borderRadius: 14,
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => {
                      setInputKey(e.target.value);
                      if (keyError) setKeyError('');
                    }}
                    placeholder="AIzaSy..."
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      fontSize: '0.88rem',
                      fontFamily: 'var(--font-code)',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="btn btn-primary"
                    style={{ padding: '10px 18px', fontSize: '0.88rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                  >
                    {isVerifying ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={14} style={{ animation: 'spin 1.2s linear infinite' }} />
                        {lang === 'bn' ? 'যাচাই হচ্ছে...' : 'Verifying...'}
                      </span>
                    ) : (
                      lang === 'bn' ? 'কানেক্ট করুন' : 'Connect Key'
                    )}
                  </button>
                </div>

                {keyError && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={14} />
                    <span>{keyError}</span>
                  </div>
                )}
              </form>
            </div>
          ) : (
            <>
              {/* Optional Config Bar when user clicked Key icon */}
              {showKeyConfig && (
                <div style={{ background: 'var(--bg-input)', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Key size={14} color="var(--primary)" />
                      {lang === 'bn' ? 'সংযুক্ত Gemini API Key' : 'Connected Gemini API Key'}
                    </span>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none' }}>
                      Google AI Studio ↗
                    </a>
                  </div>
                  <form onSubmit={handleConnectKey} style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="password"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder="AIzaSy..."
                      style={{ flex: 1, padding: '7px 12px', fontSize: '0.82rem', borderRadius: 8, fontFamily: 'var(--font-code)' }}
                    />
                    <button type="submit" disabled={isVerifying} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem' }}>
                      {isVerifying ? (lang === 'bn' ? 'যাচাই হচ্ছে...' : 'Verifying...') : (lang === 'bn' ? 'আপডেট করুন' : 'Update')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeGeminiKey(userKey);
                        setHasApiKey(false);
                        setInputKey('');
                        setShowKeyConfig(false);
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '7px 12px', fontSize: '0.8rem', color: 'var(--danger)' }}
                      title="Disconnect Key"
                    >
                      {lang === 'bn' ? 'ডিসকানেক্ট' : 'Disconnect'}
                    </button>
                  </form>
                  {keyError && <p style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: 6 }}>{keyError}</p>}
                </div>
              )}

              {activeTab === 'planner' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Step 1: Input text area */}
              <div style={{ background: 'var(--bg-input)', padding: 18, borderRadius: 14, border: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: 8 }}>
                  ✍️ {lang === 'bn' ? 'আজকের সারাদিনের পরিকল্পনা বা কাজের তালিকা লিখুন:' : 'Describe your full day\'s agenda or tasks:'}
                </label>
                <textarea
                  rows={3}
                  value={plannerInput}
                  onChange={(e) => setPlannerInput(e.target.value)}
                  placeholder={lang === 'bn'
                    ? 'উদাহরণ: বাজার করতে হবে, ক্লায়েন্ট মিটিং আছে, দুপুরে ৩টায় কোডিং এবং বিকালে জিম (সময় না দিলেও AI সময় ঠিক করে দেবে)...'
                    : 'Example: Finish client proposal, 10am standup call, gym in evening, and code review (AI suggests times even if omitted)...'}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '0.9rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    resize: 'vertical'
                  }}
                />

                {/* Example Quick Prompts */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                    {lang === 'bn' ? 'আইডিয়া:' : 'Quick ideas:'}
                  </span>
                  {[
                    lang === 'bn' ? 'সকাল ১০টায় ক্লায়েন্ট কল, ২টায় প্রজেক্ট কোডিং, বিকাল ৫টায় জিম' : '10am client call, 2pm coding, 5pm gym',
                    lang === 'bn' ? 'বাজার করা, ল্যান্ডিং পেজ ডিজাইন, ইনভয়েস পাঠানো, বই পড়া' : 'Groceries, design landing page, send invoices, reading'
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPlannerInput(chip)}
                      className="btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={handleGeneratePlan}
                    disabled={loading || !plannerInput.trim()}
                    className="btn btn-primary"
                    style={{ padding: '9px 18px', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {loading ? <RefreshCw size={15} className="spin" /> : <Sparkles size={15} />}
                    <span>{loading ? (lang === 'bn' ? 'প্ল্যান তৈরি হচ্ছে...' : 'Generating Plan...') : (lang === 'bn' ? 'পরিকল্পনা তৈরি করুন' : 'Generate Daily Plan')}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Interactive Plan Review & Approval Panel */}
              {plannedTasks && plannedTasks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeIn 0.25s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={18} color="var(--primary)" />
                        {lang === 'bn' ? 'প্রস্তাবিত শিডিউল ও প্রিভিউ (অনুমোদনের জন্য):' : 'Proposed Schedule & Approval Preview:'}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        {lang === 'bn'
                          ? 'সময় প্রয়োজনে পরিবর্তন করতে পারেন, অথবা চ্যাটে লিখে দিলে AI টাইম স্লট পরিবর্তন করে দেবে।'
                          : 'You can adjust time slots below, or write in the revision box to shift times.'}
                      </p>
                    </div>

                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-glow)', padding: '4px 10px', borderRadius: 8 }}>
                      {plannedTasks.filter(t => t.selected).length} {lang === 'bn' ? 'টি কাজ সিলেক্টেড' : 'tasks selected'}
                    </span>
                  </div>

                  {/* Task Cards List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                    {plannedTasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          background: task.selected ? 'var(--bg-input)' : 'rgba(0,0,0,0.02)',
                          opacity: task.selected ? 1 : 0.6,
                          borderRadius: 12,
                          border: task.selected ? '1px solid var(--border-subtle)' : '1px dashed var(--border-subtle)',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          transition: 'all 0.15s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={task.selected}
                          onChange={() => handleToggleSelectTask(task.id)}
                          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />

                        {/* Title and details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                              {task.title}
                            </span>
                            <span className={`badge ${task.priority === 'Urgent' ? 'badge-urgent' : task.priority === 'High' ? 'badge-progress' : 'badge-todo'}`} style={{ fontSize: '0.65rem' }}>
                              {task.priority}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--primary)', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                              🤖 AI Engaged
                            </span>
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                            {task.brief}
                          </p>
                        </div>

                        {/* Time Slot Selectors (Start - End) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <Clock size={14} color="var(--text-muted)" />
                          <input
                            type="time"
                            value={task.startTime}
                            onChange={(e) => handleTimeChange(task.id, 'startTime', e.target.value)}
                            style={{ padding: '4px 6px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>-</span>
                          <input
                            type="time"
                            value={task.endTime}
                            onChange={(e) => handleTimeChange(task.id, 'endTime', e.target.value)}
                            style={{ padding: '4px 6px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Step 3: Conversational Revision Input */}
                  <form onSubmit={handleRevisePlan} style={{ display: 'flex', gap: 8, background: 'var(--bg-input)', padding: 8, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                    <input
                      type="text"
                      value={revisionInput}
                      onChange={(e) => setRevisionInput(e.target.value)}
                      placeholder={lang === 'bn' ? 'চ্যাটে সময় পরিবর্তন করুন: যেমন "মিটিংটা বিকাল ৪টায় দাও" বা "জিম রাত ৮টায় করো"...' : 'Revise times via chat: e.g. "Move meeting to 4pm" or "gym at 8pm"...'}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)' }}
                    />
                    <button
                      type="submit"
                      disabled={loading || !revisionInput.trim()}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    >
                      {lang === 'bn' ? 'রিভাইজ করুন' : 'Revise'}
                    </button>
                  </form>

                  {/* Step 4: Big Approval Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      type="button"
                      onClick={() => setPlannedTasks(null)}
                      className="btn btn-secondary"
                    >
                      {lang === 'bn' ? 'নতুন করে লিখুন' : 'Reset'}
                    </button>
                    <button
                      type="button"
                      onClick={handleApprovePlan}
                      disabled={loading}
                      className="btn btn-primary"
                      style={{ padding: '10px 22px', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8, background: '#090a0f', color: '#fff' }}
                    >
                      <Check size={16} />
                      <span>{lang === 'bn' ? 'অনুমোদন দিন ও To-Do তে যুক্ত করুন' : 'Approve & Add to Schedule'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assistant' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 380 }}>
              {/* Chat Messages */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '84%',
                      background: m.sender === 'user' ? 'var(--primary)' : 'var(--bg-input)',
                      color: m.sender === 'user' ? '#fff' : 'var(--text-main)',
                      padding: '12px 16px',
                      borderRadius: 14,
                      fontSize: '0.88rem',
                      lineHeight: 1.55,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {typeof m.text === 'object'
                        ? (m.text?.textResponse || JSON.stringify(m.text))
                        : String(m.text || (lang === 'bn' ? '✅ কাজটি সফলভাবে প্রসেস করা হয়েছে।' : '✅ Action completed.'))}
                    </div>

                    {m.actionExecuted && (
                      <div
                        style={{
                          marginTop: 8,
                          paddingTop: 6,
                          borderTop: '1px solid rgba(255,255,255,0.1)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: '0.73rem',
                          color: '#10b981',
                          fontWeight: 700
                        }}
                      >
                        <Zap size={13} />
                        <span>{lang === 'bn' ? 'সফটওয়্যার অ্যাকশন সম্পন্ন হয়েছে' : 'Executed on Tasker Board'}</span>
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ alignSelf: 'flex-start', background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 14, fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={13} style={{ animation: 'spin 1.2s linear infinite' }} />
                    <span>{lang === 'bn' ? 'AI এজেন্ট ভাবছে...' : 'AI Agent thinking & executing...'}</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick Action Suggestion Chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid var(--border-subtle)' }}>
                {[
                  lang === 'bn' ? '📋 আজকের কাজের তালিকা দেখাও' : '📋 Show my tasks',
                  lang === 'bn' ? '➕ বিকাল ৫টায় জিম টাস্ক যুক্ত করো' : '➕ Add gym task at 5pm',
                  lang === 'bn' ? '💡 কাজের গতি বাড়ানোর টিপস দাও' : '💡 Productivity tips'
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setChatInput(chip.replace(/^[^\s]+\s/, ''));
                    }}
                    className="btn-ghost"
                    style={{
                      fontSize: '0.74rem',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 10, marginTop: 4, paddingTop: 6 }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={lang === 'bn' ? 'কথা বলুন বা নির্দেশ দিন (যেমন: "আজকের কাজের তালিকা দেখাও")...' : 'Chat or command agent (e.g. "Add client meeting at 4pm")...'}
                  style={{ flex: 1, padding: '10px 14px', fontSize: '0.9rem', borderRadius: 10 }}
                />
                <button type="submit" disabled={chatLoading || !chatInput.trim()} className="btn btn-primary" style={{ padding: '0 16px' }}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
