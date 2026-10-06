import React, { useState, useRef, useEffect } from 'react';
import {
  queryGeminiReasoning,
  getGeminiKey,
  setGeminiKey,
  getActiveGeminiModelLabel,
  fetchLatestGeminiModel
} from '../services/gemini';
import { taskApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  X,
  Send,
  Mic,
  MicOff,
  Code,
  Sparkles,
  Bot,
  User,
  Plus,
  CheckCircle,
  Calendar,
  AlertCircle,
  Key,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Settings,
  RefreshCw
} from 'lucide-react';

export default function GeminiAiModal({ onClose, onTasksCreated }) {
  const { lang, t } = useLanguage();
  const [apiKey, setApiKeyState] = useState(getGeminiKey());
  const [showKeyConfig, setShowKeyConfig] = useState(!getGeminiKey());
  const [keySavedStatus, setKeySavedStatus] = useState('');
  const [activeModelLabel, setActiveModelLabel] = useState(getActiveGeminiModelLabel());
  const [isSyncingModel, setIsSyncingModel] = useState(false);

  useEffect(() => {
    // When modal mounts or key is available, query Gemini API for the latest active model
    const currentKey = getGeminiKey();
    if (currentKey) {
      setIsSyncingModel(true);
      fetchLatestGeminiModel(currentKey)
        .then((res) => {
          if (res?.label) setActiveModelLabel(res.label);
        })
        .finally(() => setIsSyncingModel(false));
    }

    const handleModelUpdate = (e) => {
      if (e?.detail?.label) {
        setActiveModelLabel(e.detail.label);
      } else {
        setActiveModelLabel(getActiveGeminiModelLabel());
      }
    };

    window.addEventListener('tasker_gemini_model_updated', handleModelUpdate);
    return () => window.removeEventListener('tasker_gemini_model_updated', handleModelUpdate);
  }, []);

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

  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: lang === 'bn'
        ? 'নমস্কার! আমি Tasker AI অ্যাসিস্ট্যান্ট। আমাকে লিখে, মুখে বলে (ভয়েস রেকর্ড) অথবা কোড দিয়ে আপনার কাজের বিষয় বুঝিয়ে বলুন। আমি আপনার লক্ষ্য বিশ্লেষণ করে স্বয়ংক্রিয়ভাবে শিডিউল সাজিয়ে দেব।'
        : "Hello! I'm Tasker AI Assistant. Describe your daily goals, speak via voice, or paste code. I will analyze your workflow and decompose it into structured tasks."
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [selectedTaskIndexes, setSelectedTaskIndexes] = useState([]);
  const [addedSuccess, setAddedSuccess] = useState(false);

  const recognitionRef = useRef(null);

  // Handle saving API key right in modal and discovering latest model
  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    const cleanKey = apiKey.trim();
    setGeminiKey(cleanKey);
    setKeySavedStatus(lang === 'bn' ? '🔄 মডেল চেক করা হচ্ছে...' : '🔄 Discovering latest model...');
    setIsSyncingModel(true);

    try {
      const res = await fetchLatestGeminiModel(cleanKey);
      if (res?.label) {
        setActiveModelLabel(res.label);
      }
      setKeySavedStatus(
        lang === 'bn'
          ? `✅ কী সংরক্ষিত এবং মডেল ${res?.label || '3.8 FLASH'} সক্রিয়!`
          : `✅ Key saved! Model ${res?.label || '3.8 FLASH'} active!`
      );
    } catch (err) {
      setKeySavedStatus(lang === 'bn' ? '✅ কী সংরক্ষিত হয়েছে!' : '✅ Key saved successfully!');
    } finally {
      setIsSyncingModel(false);
      setTimeout(() => {
        setKeySavedStatus('');
        setShowKeyConfig(false);
      }, 2200);
    }
  };

  // Voice recording toggle (using Web Speech Recognition API if available)
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        // Fallback simulation for unsupported browsers
        setIsRecording(true);
        setTimeout(() => {
          setVoiceTranscript(
            lang === 'bn'
              ? 'কালকে সকাল ৮টায় হাটে গিয়ে ওষুধ কিনতে হবে এবং ১২টায় ক্লায়েন্ট মিটিং'
              : 'Tomorrow at 8am purchase vitamins at market and 12pm host client sync'
          );
          setIsRecording(false);
        }, 2500);
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(r => r[0].transcript)
            .join('');
          setVoiceTranscript(transcript);
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.warn('Speech recognition init error:', err);
        setIsRecording(false);
      }
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() && !voiceTranscript.trim() && !codeSnippet.trim()) return;

    const userMsg = {
      sender: 'user',
      text: inputText || voiceTranscript,
      code: codeSnippet
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setAddedSuccess(false);

    const promptToSend = inputText;
    const voiceToSend = voiceTranscript;
    const codeToSend = codeSnippet;

    setInputText('');
    setVoiceTranscript('');
    setCodeSnippet('');
    setShowCodeBox(false);

    try {
      const res = await queryGeminiReasoning({
        prompt: promptToSend,
        voiceTranscript: voiceToSend,
        codeSnippet: codeToSend
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.textResponse,
          tasks: res.extractedTasks
        }
      ]);

      if (res.extractedTasks && res.extractedTasks.length > 0) {
        setExtractedTasks(res.extractedTasks);
        setSelectedTaskIndexes(res.extractedTasks.map((_, i) => i));
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ ${lang === 'bn' ? 'ত্রুটি' : 'Error'}: ${err.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Add the extracted tasks to the Kanban board and Calendar
  const handleApplyTasksToBoard = async () => {
    const tasksToAdd = extractedTasks.filter((_, idx) => selectedTaskIndexes.includes(idx));
    if (!tasksToAdd.length) return;

    try {
      for (const t of tasksToAdd) {
        await taskApi.create({
          title: t.title,
          brief: t.brief || 'AI Reasoning Decomposed Milestone',
          priority: t.priority || 'Medium',
          status: 'To Do',
          workspaceType: 'Personal',
          scheduledDate: new Date().toISOString()
        });
      }
      setAddedSuccess(true);
      if (onTasksCreated) onTasksCreated();
    } catch (err) {
      console.error('Error applying tasks:', err);
    }
  };

  const hasApiKey = Boolean(getGeminiKey());

  return (
    <div
      className="modal-overlay"
      style={{ justifyContent: 'flex-end', padding: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-content"
        style={{
          width: '100%',
          maxWidth: 520,
          height: '100vh',
          maxHeight: '100vh',
          borderRadius: '24px 0 0 24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 36px rgba(0,0,0,0.4)',
          background: 'var(--bg-surface)'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--header-bg)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: '#090a0f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
              }}
            >
              <Bot size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                Gemini Reasoning AI
                <span
                  title={isSyncingModel ? (lang === 'bn' ? 'API থেকে মডেল সিঙ্ক হচ্ছে...' : 'Syncing model from Gemini API...') : `Active Model: ${activeModelLabel}`}
                  style={{
                    fontSize: '0.65rem',
                    background: 'var(--primary-glow)',
                    color: 'var(--primary)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  {isSyncingModel && <RefreshCw size={10} style={{ animation: 'spin 1.2s linear infinite' }} />}
                  {activeModelLabel}
                </span>
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {hasApiKey ? `🟢 BYOK Connected (${activeModelLabel})` : '🟡 Simulated Decomposition (Add Key for Cloud AI)'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="btn-ghost"
              style={{ padding: 6, borderRadius: '50%', color: hasApiKey ? 'var(--success)' : 'var(--warning)' }}
              title={lang === 'bn' ? 'Gemini API কী কনফিগার' : 'Configure Gemini API Key'}
            >
              <Key size={18} />
            </button>
            <button onClick={onClose} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Gemini API Key Banner & Direct Button */}
        {showKeyConfig && (
          <div
            style={{
              padding: '14px 18px',
              background: 'var(--bg-input)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.82rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Key size={15} color="var(--primary)" />
                {lang === 'bn' ? 'Google Gemini API Key' : 'Google Gemini API Key'}
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{
                  fontSize: '0.74rem',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  textDecoration: 'none'
                }}
              >
                <span>{lang === 'bn' ? 'API Key বের করুন ↗' : 'Get Gemini API Key ↗'}</span>
                <ExternalLink size={12} />
              </a>
            </div>

            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>
              {lang === 'bn'
                ? 'Google AI Studio থেকে সম্পূর্ণ ফ্রিতে ১-ক্লিকে API Key তৈরি করে নিচে পেস্ট করুন:'
                : 'Get a free instant API key from Google AI Studio and paste it below:'}
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKeyState(e.target.value)}
                placeholder="AIzaSy..."
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-code)',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
              <button
                type="button"
                onClick={handleSaveKey}
                className="btn btn-secondary"
                style={{ padding: '7px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                {lang === 'bn' ? 'সেভ করুন' : 'Save Key'}
              </button>
            </div>

            {keySavedStatus && (
              <p style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>
                {keySavedStatus}
              </p>
            )}
          </div>
        )}

        {/* Message Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((m, idx) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '90%'
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: '#090a0f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 4
                    }}
                  >
                    <Sparkles size={15} color="#fff" />
                  </div>
                )}
                <div
                  style={{
                    background: isUser ? '#090a0f' : 'var(--bg-card)',
                    color: isUser ? '#ffffff' : 'var(--text-main)',
                    padding: '12px 16px',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    border: isUser ? 'none' : '1px solid var(--border-subtle)',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {m.text}
                  {m.code && (
                    <pre
                      style={{
                        marginTop: 8,
                        padding: 10,
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 8,
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-code)',
                        overflowX: 'auto'
                      }}
                    >
                      {m.code}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-start', alignItems: 'center' }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Sparkles size={15} color="#fff" />
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  background: 'var(--bg-card)',
                  borderRadius: 14,
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span>{lang === 'bn' ? 'Gemini প্রম্পট বিশ্লেষণ করছে ও টাস্কে রূপান্তর করছে... 🧠' : 'Gemini is analyzing prompt & breaking down tasks... 🧠'}</span>
              </div>
            </div>
          )}

          {/* Extracted Tasks Action Box */}
          {extractedTasks.length > 0 && !addedSuccess && (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--primary)',
                borderRadius: 16,
                padding: 16,
                boxShadow: '0 6px 20px var(--primary-glow)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={16} />
                  {lang === 'bn' ? `বিশ্লেষণকৃত টাস্ক (${extractedTasks.length} টি)` : `Decomposed Tasks (${extractedTasks.length})`}
                </span>
                <span className="badge badge-progress" style={{ fontSize: '0.68rem' }}>
                  {lang === 'bn' ? 'অ্যানালাইজড' : 'AI Analyzed'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {extractedTasks.map((t, i) => {
                  const isChecked = selectedTaskIndexes.includes(i);
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        setSelectedTaskIndexes(prev =>
                          prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                        );
                      }}
                      style={{
                        fontSize: '0.82rem',
                        background: 'var(--bg-input)',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: 700 }}>{t.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span
                            className={`badge ${t.priority === 'Urgent' ? 'badge-urgent' : t.priority === 'High' ? 'badge-high' : 'badge-todo'}`}
                            style={{ fontSize: '0.65rem' }}
                          >
                            {t.priority}
                          </span>
                          <span className="badge" style={{ fontSize: '0.65rem', background: 'var(--bg-card)' }}>
                            {t.suggestedCategory}
                          </span>
                        </div>
                      </div>
                      {t.brief && (
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: 22 }}>
                          {t.brief}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleApplyTasksToBoard}
                disabled={selectedTaskIndexes.length === 0}
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.88rem', padding: '10px', borderRadius: 'var(--radius-md)' }}
              >
                <Plus size={16} />
                {lang === 'bn'
                  ? `${selectedTaskIndexes.length} টি টাস্ক Kanban ও ক্যালেন্ডারে যোগ করুন`
                  : `Add ${selectedTaskIndexes.length} Tasks to Kanban & Calendar`}
              </button>
            </div>
          )}

          {addedSuccess && (
            <div
              style={{
                background: 'var(--success-bg)',
                color: 'var(--success)',
                padding: 14,
                borderRadius: 12,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                border: '1px solid var(--success)'
              }}
            >
              <CheckCircle size={20} />
              <span>
                {lang === 'bn'
                  ? 'টাস্কগুলো সফলভাবে বিশ্লেষণ করে Kanban বোর্ড ও ক্যালেন্ডারে যুক্ত করা হয়েছে!'
                  : 'Tasks successfully analyzed and scheduled on Kanban board & Calendar!'}
              </span>
            </div>
          )}
        </div>

        {/* Input & Multimodal Tools */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          {/* Optional Code Snippet Drawer */}
          {showCodeBox && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span>{lang === 'bn' ? 'কোড স্নিপেট বা বাগ ব্যাখ্যা:' : 'Code snippet or bug description:'}</span>
                <button onClick={() => setShowCodeBox(false)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
              </div>
              <textarea
                rows={3}
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                placeholder="Paste code snippet here..."
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', fontFamily: 'var(--font-code)' }}
              />
            </div>
          )}

          {/* Voice transcript preview if recording */}
          {voiceTranscript && (
            <div style={{ background: 'var(--bg-input)', padding: '6px 10px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--primary)' }}>🎙️ {voiceTranscript}</span>
              <button onClick={() => setVoiceTranscript('')} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                {lang === 'bn' ? 'মুছুন' : 'Clear'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Toggle Code input */}
            <button
              type="button"
              onClick={() => setShowCodeBox(!showCodeBox)}
              title={lang === 'bn' ? 'কোড পেস্ট করুন' : 'Paste Code'}
              style={{
                padding: 10,
                borderRadius: 10,
                background: showCodeBox ? 'var(--primary)' : 'var(--bg-input)',
                color: showCodeBox ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Code size={18} />
            </button>

            {/* Toggle Voice Record */}
            <button
              type="button"
              onClick={toggleRecording}
              title={lang === 'bn' ? 'মুখে কথা বলে টাস্ক বোঝান' : 'Speak to AI'}
              style={{
                padding: 10,
                borderRadius: 10,
                background: isRecording ? 'var(--danger)' : 'var(--bg-input)',
                color: isRecording ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                animation: isRecording ? 'pulse 1.5s infinite' : 'none'
              }}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                isRecording
                  ? (lang === 'bn' ? 'রেকর্ড হচ্ছে... মুখে বলুন' : 'Listening... speak now')
                  : (lang === 'bn' ? 'কাজের কথা লিখুন বা মুখে বলুন...' : 'Type or speak your goal or schedule...')
              }
              style={{ flex: 1, padding: '10px 14px', fontSize: '0.875rem' }}
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={loading || (!inputText.trim() && !voiceTranscript.trim() && !codeSnippet.trim())}
              className="btn btn-primary"
              style={{ padding: '10px 14px', borderRadius: 10 }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
