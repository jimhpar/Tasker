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
import { getUserMemory } from '../services/agentMemoryService';
import { speakHumanVoice, stopHumanVoice } from '../services/voiceService';
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
  ChevronDown,
  Bot,
  Layers,
  ArrowRight,
  Edit2,
  RefreshCw,
  Bell,
  Key,
  ExternalLink,
  ShieldCheck,
  Lock,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Brain,
  Wrench
} from 'lucide-react';

function renderFormattedMarkdown(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: 6 }} />;
        }
        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const isNumbered = /^\d+\.\s/.test(trimmed);
        const cleanLine = (isBullet || isNumbered) ? trimmed.replace(/^([•\-\*]|\d+\.)\s*/, '') : trimmed;

        // Parse **bold** parts
        const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
        const parsedContent = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} style={{ fontWeight: 700, color: 'inherit' }}>
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        if (isBullet || isNumbered) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingLeft: 4 }}>
              <span style={{ color: 'var(--primary, #6366f1)', fontWeight: 700, fontSize: '0.85rem', lineHeight: '1.4' }}>
                {isNumbered ? trimmed.match(/^\d+\./)[0] : '•'}
              </span>
              <div style={{ flex: 1, lineHeight: 1.5 }}>{parsedContent}</div>
            </div>
          );
        }

        return (
          <div key={idx} style={{ lineHeight: 1.55 }}>
            {parsedContent}
          </div>
        );
      })}
    </div>
  );
}

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

  // Assistant Chat State (Gemini 3.8 Flash & Autonomous Reasoning)
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'msg_welcome',
      sender: 'ai',
      text: lang === 'bn'
        ? 'নমস্কার! আমি আপনার **Tasker Autonomous AI Agent** 🤖 (Gemini 3.8 Flash)।\n\nআমি স্বয়ংক্রিয় চিন্তাভাবনা ও আপনার কাজের অভ্যাস মনে রেখে কাজ করি। আপনি স্বাভাবিকভাবে কথা বলতে পারেন কিংবা সফটওয়্যারের কাজ করতে বলতে পারেন:\n• *"কাল দুপুরে একটি ইকমার্স UI বানাতে হবে"* (লাঞ্চ টাইম বাদ দিয়ে শিডিউল করবে)\n• *"আজকের কাজের তালিকা দেখাও"*\n• *"মিটিং টাস্ক ডান করো"*\n\nআজ আপনাকে কীভাবে সহায়তা করতে পারি?'
        : 'Hello! I am your **Tasker Autonomous AI Agent** 🤖 (Powered by Gemini 3.8 Flash).\n\nI operate with autonomous reasoning and persistent habit memory. You can chat naturally or command board actions:\n• *"Schedule Ecommerce UI Design tomorrow afternoon"*\n• *"Show my pending tasks for today"*\n• *"Mark meeting as completed"*\n\nHow can I help boost your productivity today?'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [expandedThoughts, setExpandedThoughts] = useState({});
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const chatBottomRef = useRef(null);
  const recognitionRef = useRef(null);

  // Dynamic animated thinking step indicator
  useEffect(() => {
    let interval = null;
    if (chatLoading) {
      interval = setInterval(() => {
        setThinkingStep(prev => (prev + 1) % 3);
      }, 1400);
    } else {
      setThinkingStep(0);
    }
    return () => clearInterval(interval);
  }, [chatLoading]);

  const toggleThought = (msgId) => {
    setExpandedThoughts(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleToggleVoiceInput = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert(lang === 'bn' ? 'আপনার ব্রাউজারে স্পিচ রিকগনিশন সাপোর্ট নেই।' : 'Speech recognition not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        const recognition = new SpeechRec();
        recognition.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (e) => {
          const transcript = Array.from(e.results)
            .map(r => r[0].transcript)
            .join('');
          setChatInput(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.warn('Voice input error:', err);
        setIsListening(false);
      }
    }
  };

  // High-Quality Human Voice Playback using voiceService (Gemini Voice: Kore)
  const handleSpeakMessage = (msgId, text) => {
    if (speakingMsgId === msgId) {
      stopHumanVoice();
      setSpeakingMsgId(null);
      return;
    }

    setSpeakingMsgId(msgId);
    speakHumanVoice({
      text,
      lang,
      apiKey: getGeminiKey(userKey),
      voiceName: 'Kore',
      onStart: () => setSpeakingMsgId(msgId),
      onEnd: () => setSpeakingMsgId(null),
      onError: () => setSpeakingMsgId(null)
    });
  };

  useEffect(() => {
    return () => {
      stopHumanVoice();
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

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

  // Autonomous Agent Chat Handler (Gemini 3.8 Flash & Antigravity Agent ReAct)
  const handleSendChat = async (e) => {
    if (e) e.preventDefault();
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
        userKey,
        onTasksChanged: () => {
          if (typeof onTasksCreated === 'function') onTasksCreated();
        }
      });

      const replyText = (res && (res.reply || res.text || res.message))
        ? String(res.reply || res.text || res.message).trim()
        : (lang === 'bn' ? '✅ আপনার অনুরোধ অনুযায়ী কাজটি সম্পন্ন হয়েছে।' : '✅ Task action executed successfully.');

      const newMsgId = 'msg_' + Date.now();
      // Auto expand thoughts if available
      if (res?.thoughts && res.thoughts.length > 0) {
        setExpandedThoughts(prev => ({ ...prev, [newMsgId]: true }));
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: newMsgId,
          sender: 'ai',
          text: replyText,
          thoughts: res?.thoughts || [],
          tools: res?.tools || [],
          actionExecuted: res?.actionExecuted,
          learnedRule: res?.learnedRule
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
      <style>{`
        @keyframes wavePulse {
          0%, 100% { height: 6px; opacity: 0.5; }
          50% { height: 16px; opacity: 1; }
        }
        @keyframes shimmerGradient {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        .tasker-wave-bar {
          width: 3px;
          height: 8px;
          border-radius: 3px;
          background: linear-gradient(180deg, #6366f1, #a855f7);
          animation: wavePulse 1s ease-in-out infinite;
          display: inline-block;
        }
        .bar-1 { animation-delay: 0ms; }
        .bar-2 { animation-delay: 180ms; }
        .bar-3 { animation-delay: 360ms; }
        .bar-4 { animation-delay: 540ms; }
      `}</style>
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
            padding: '14px 18px',
            background: 'var(--header-bg)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 38,
                height: 38,
                minWidth: 38,
                minHeight: 38,
                maxWidth: 38,
                maxHeight: 38,
                flexShrink: 0,
                aspectRatio: '1 / 1',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #090a0f, #2a2d3d)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              <Bot size={20} color="#fff" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, whiteSpace: 'nowrap' }}>
                  {lang === 'bn' ? 'AI প্ল্যানার' : 'AI Planner'}
                </h3>
                <span style={{ fontSize: '0.65rem', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '2px 7px', borderRadius: 6, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {modelLabel}
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lang === 'bn' ? 'স্মার্ট দৈনিক শিডিউলিং ও পার্সোনাল অ্যাসিস্ট্যান্ট' : 'Autonomous scheduling & personal assistant'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {hasApiKey ? (
              <>
                {/* Tab switch buttons */}
                <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 10, padding: 3 }}>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('planner'); setShowKeyConfig(false); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: activeTab === 'planner' && !showKeyConfig ? 'var(--bg-card)' : 'transparent',
                      color: activeTab === 'planner' && !showKeyConfig ? 'var(--text-main)' : 'var(--text-muted)',
                      boxShadow: activeTab === 'planner' && !showKeyConfig ? '0 2px 6px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    📅 {lang === 'bn' ? 'প্ল্যানার' : 'Planner'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('assistant'); setShowKeyConfig(false); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: '0.78rem',
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
            ) : null}

            <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: 6, borderRadius: 8 }} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 12px', textAlign: 'center', maxWidth: 480, margin: 'auto', width: '100%', boxSizing: 'border-box' }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #090a0f, #312e81)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)',
                  marginBottom: 14
                }}
              >
                <Key size={26} color="#818cf8" />
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>
                {lang === 'bn' ? 'Google Gemini API Key সংযুক্ত করুন' : 'Connect Google Gemini API Key'}
              </h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 18 }}>
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
                  marginBottom: 20,
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
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  background: 'var(--bg-input)',
                  padding: '14px 14px',
                  borderRadius: 14,
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', gap: 8, width: '100%', boxSizing: 'border-box', flexWrap: 'wrap' }}>
                  <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => {
                      setInputKey(e.target.value);
                      if (keyError) setKeyError('');
                    }}
                    placeholder="AIzaSy..."
                    style={{
                      flex: '1 1 180px',
                      minWidth: 0,
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
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
                    style={{ flex: '0 0 auto', padding: '10px 18px', fontSize: '0.88rem', fontWeight: 700, whiteSpace: 'nowrap' }}
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
                  <form onSubmit={handleConnectKey} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                    <input
                      type="password"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder="AIzaSy..."
                      style={{ flex: '1 1 180px', minWidth: 0, padding: '7px 12px', fontSize: '0.82rem', borderRadius: 8, fontFamily: 'var(--font-code)', boxSizing: 'border-box' }}
                    />
                    <button type="submit" disabled={isVerifying} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
              {/* Context Memory & Learning Active Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 12px',
                  marginBottom: 10,
                  borderRadius: 10,
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  fontSize: '0.76rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Brain size={14} color="#6366f1" />
                  <span>
                    <strong>{lang === 'bn' ? 'কনটেক্সট মেমোরি ও লার্নিং সক্রিয়' : 'Context Memory & Habit Learning Active'}</strong>
                    {' • '}
                    {lang === 'bn' ? '১:৩০-২:৩০ লাঞ্চ টাইম ও ডিপ ফোকাস সংরক্ষিত' : 'Lunch break (1:30-2:30) & focus blocks respected'}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#6366f1',
                    fontWeight: 700,
                    background: 'rgba(99, 102, 241, 0.15)',
                    padding: '2px 7px',
                    borderRadius: 6
                  }}
                >
                  {modelLabel}
                </span>
              </div>

              {/* Chat Messages */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 16 }}>
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: m.sender === 'user' ? '82%' : '92%',
                      background: m.sender === 'user' ? 'var(--primary)' : 'var(--bg-input)',
                      color: m.sender === 'user' ? '#fff' : 'var(--text-main)',
                      padding: '12px 16px',
                      borderRadius: 16,
                      fontSize: '0.88rem',
                      lineHeight: 1.55,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: m.sender === 'user' ? 'none' : '1px solid var(--border-subtle)'
                    }}
                  >
                    {/* Antigravity Thinking Process Block (Accordion) */}
                    {m.sender === 'ai' && Array.isArray(m.thoughts) && m.thoughts.length > 0 && (
                      <div
                        style={{
                          marginBottom: 10,
                          borderRadius: 8,
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(0,0,0,0.18)',
                          overflow: 'hidden'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleThought(m.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.74rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 600
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Brain size={13} color="#818cf8" />
                            <span>{lang === 'bn' ? 'চিন্তাভাবনা ও বিশ্লেষণ' : 'Thinking Process'}</span>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                background: 'var(--bg-card)',
                                padding: '1px 6px',
                                borderRadius: 8,
                                color: 'var(--text-muted)'
                              }}
                            >
                              {m.thoughts.length} {lang === 'bn' ? 'ধাপ' : 'steps'}
                            </span>
                          </div>
                          {expandedThoughts[m.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>

                        {expandedThoughts[m.id] && (
                          <div
                            style={{
                              padding: '8px 12px',
                              borderTop: '1px solid var(--border-subtle)',
                              fontSize: '0.73rem',
                              color: 'var(--text-secondary)',
                              lineHeight: 1.55,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 5
                            }}
                          >
                            {m.thoughts.map((step, sIdx) => (
                              <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                <span style={{ color: '#818cf8', fontWeight: 700 }}>•</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Board Action Execution Badges */}
                    {m.sender === 'ai' && Array.isArray(m.tools) && m.tools.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        {m.tools.map((t, tIdx) => (
                          <div
                            key={tIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: 8,
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              fontSize: '0.74rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Wrench size={13} color="#10b981" />
                              <span style={{ fontWeight: 700, color: '#10b981' }}>
                                {t.tool || t.name}
                              </span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {t.message || (t.params?.title ? `"${t.params.title}"` : '')}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                color: t.status === 'success' ? '#10b981' : '#ef4444',
                                background: t.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                padding: '2px 6px',
                                borderRadius: 4
                              }}
                            >
                              {t.status === 'success' ? (lang === 'bn' ? '✅ সম্পন্ন' : '✅ Success') : '❌ Failed'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Formatted Markdown Content */}
                    <div style={{ wordBreak: 'break-word' }}>
                      {typeof m.text === 'object'
                        ? (m.text?.textResponse || JSON.stringify(m.text))
                        : renderFormattedMarkdown(m.text || (lang === 'bn' ? '✅ কাজটি সম্পন্ন হয়েছে।' : '✅ Action completed.'))}
                    </div>

                    {/* Footer Actions (Natural Human Voice Playback & Learned Habit Badge) */}
                    {m.sender === 'ai' && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 8,
                          paddingTop: 6,
                          borderTop: '1px solid var(--border-subtle)'
                        }}
                      >
                        {m.learnedRule ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.7rem',
                              color: '#eab308',
                              background: 'rgba(234, 179, 8, 0.12)',
                              padding: '2px 7px',
                              borderRadius: 6
                            }}
                          >
                            <span>💡 {lang === 'bn' ? 'নতুন নিয়ম সংরক্ষিত' : 'Rule Learned'}</span>
                          </div>
                        ) : <div />}

                        <button
                          type="button"
                          onClick={() => handleSpeakMessage(m.id, m.text)}
                          className="btn-ghost"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '0.74rem',
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: speakingMsgId === m.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                            color: speakingMsgId === m.id ? '#6366f1' : 'var(--text-muted)',
                            border: speakingMsgId === m.id ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                            cursor: 'pointer'
                          }}
                          title={lang === 'bn' ? 'অফিসিয়াল Gemini Voice (Kore) দিয়ে শুনুন' : 'Listen with Official Gemini Voice (Kore)'}
                        >
                          {speakingMsgId === m.id ? (
                            <>
                              <VolumeX size={14} color="#6366f1" />
                              <span style={{ color: '#6366f1', fontWeight: 700 }}>{lang === 'bn' ? 'থামুন' : 'Stop'}</span>
                              <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 12 }}>
                                <span className="tasker-wave-bar bar-1" />
                                <span className="tasker-wave-bar bar-2" />
                                <span className="tasker-wave-bar bar-3" />
                              </div>
                            </>
                          ) : (
                            <>
                              <Volume2 size={14} />
                              <span>{lang === 'bn' ? 'Gemini Voice' : 'Gemini Voice'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Animated Dynamic Thinking Process Indicator */}
                {chatLoading && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      maxWidth: '88%',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      padding: '12px 16px',
                      borderRadius: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      boxShadow: '0 4px 18px rgba(99, 102, 241, 0.08)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 12px rgba(99, 102, 241, 0.5)'
                        }}
                      >
                        <Sparkles size={14} color="#fff" />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 16 }}>
                        <span className="tasker-wave-bar bar-1" />
                        <span className="tasker-wave-bar bar-2" />
                        <span className="tasker-wave-bar bar-3" />
                        <span className="tasker-wave-bar bar-4" />
                      </div>

                      <span
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          background: 'linear-gradient(90deg, #6366f1, #a855f7, #6366f1)',
                          backgroundSize: '200% auto',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          animation: 'shimmerGradient 2.5s linear infinite'
                        }}
                      >
                        {lang === 'bn' ? 'Gemini 3.8 Flash চিন্তা করছে...' : 'Gemini 3.8 Flash is thinking...'}
                      </span>
                    </div>

                    <div
                      style={{
                        paddingLeft: 36,
                        fontSize: '0.76rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <span style={{ color: '#a855f7' }}>✦</span>
                      <span>
                        {lang === 'bn'
                          ? [
                              'কাজের শিডিউল ও অভ্যাস বিশ্লেষণ করা হচ্ছে...',
                              'বোর্ডের টাস্ক ও সময়ের সমন্বয় পরীক্ষা করা হচ্ছে...',
                              'সবচেয়ে ভালো পরিকল্পনা প্রস্তুত করা হচ্ছে...'
                            ][thinkingStep]
                          : [
                              'Analyzing your task schedule & focus habits...',
                              'Checking board conflicts & optimal time slots...',
                              'Synthesizing intelligent plan & response...'
                            ][thinkingStep]
                        }
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick Action Suggestion Chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid var(--border-subtle)' }}>
                {[
                  lang === 'bn' ? '📋 আজকের কাজের তালিকা দেখাও' : '📋 Show my tasks for today',
                  lang === 'bn' ? '➕ কাল বিকালে ইকমার্স UI ডিজাইন যুক্ত করো' : '➕ Add Ecommerce UI design tomorrow afternoon',
                  lang === 'bn' ? '🧠 আমার ডিপ ফোকাস ও লাঞ্চ অনুযায়ী শিডিউল সাজাও' : '🧠 Optimize schedule for deep focus & lunch break'
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

              {/* Chat Input with Speech-to-Text Mic */}
              <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 8, marginTop: 4, paddingTop: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    isListening
                      ? (lang === 'bn' ? '🎙️ আপনার কথা শুনছি, বলুন...' : '🎙️ Listening to your voice, speak now...')
                      : (lang === 'bn' ? 'কথা বলুন বা নির্দেশ দিন (যেমন: "কাল বিকালে ইকমার্স UI বানাতে হবে")...' : 'Chat or command agent (e.g. "Add client meeting tomorrow at 4pm")...')
                  }
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: '0.9rem',
                    borderRadius: 10,
                    borderColor: isListening ? '#ef4444' : undefined,
                    boxShadow: isListening ? '0 0 0 2px rgba(239, 68, 68, 0.25)' : undefined
                  }}
                />

                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={handleToggleVoiceInput}
                  className="btn btn-secondary"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    color: isListening ? '#ef4444' : 'var(--text-main)',
                    background: isListening ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-input)',
                    border: isListening ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title={isListening ? (lang === 'bn' ? 'রেকর্ডিং বন্ধ করুন' : 'Stop voice recording') : (lang === 'bn' ? 'মুখে বলুন (Voice Input)' : 'Speak via voice')}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="btn btn-primary"
                  style={{ padding: '10px 18px', borderRadius: 10 }}
                >
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
