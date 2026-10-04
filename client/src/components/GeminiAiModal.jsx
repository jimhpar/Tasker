import React, { useState, useRef } from 'react';
import { queryGeminiReasoning, getGeminiKey } from '../services/gemini';
import { taskApi } from '../services/api';
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
  AlertCircle
} from 'lucide-react';

export default function GeminiAiModal({ onClose, onTasksCreated }) {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'নমস্কার! আমি Tasker AI অ্যাসিস্ট্যান্ট। আমাকে লিখে, মুখে বলে (ভয়েস রেকর্ড) অথবা কোড দিয়ে আপনার কাজের বিষয় বুঝিয়ে বলুন। আমি আপনার সারাদিনের শিডিউল গুছিয়ে দেব।'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [addedSuccess, setAddedSuccess] = useState(false);

  const recognitionRef = useRef(null);

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
          setVoiceTranscript('কালকে সকাল ৮টায় হাটে গিয়ে গরুর ওষুধ কিনতে হবে এবং ১২টায় ক্লায়েন্ট মিটিং');
          setIsRecording(false);
        }, 3000);
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'bn-BD'; // or 'en-US'
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
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ ত্রুটি: ${err.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Add the extracted tasks to the Kanban board and Calendar
  const handleApplyTasksToBoard = async () => {
    if (!extractedTasks.length) return;
    try {
      for (const t of extractedTasks) {
        await taskApi.create({
          title: t.title,
          brief: t.brief || 'AI Reasoning Generated',
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
    <div className="modal-overlay" style={{ justifyContent: 'flex-end', padding: 0 }}>
      <div
        className="modal-content"
        style={{
          width: '100%',
          maxWidth: 480,
          height: '100vh',
          maxHeight: '100vh',
          borderRadius: '24px 0 0 24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          background: 'var(--bg-surface)'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--header-bg)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px var(--primary-glow)'
              }}
            >
              <Bot size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                Gemini Reasoning AI
                <span style={{ fontSize: '0.65rem', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                  FLASH
                </span>
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {hasApiKey ? '🟢 BYOK API Active' : '🟡 Simulated Preview (Add Key in Settings)'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

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
                  maxWidth: '88%'
                }}
              >
                {!isUser && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
                    <Sparkles size={14} color="#fff" />
                  </div>
                )}
                <div
                  style={{
                    background: isUser ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--bg-card)',
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
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} color="#fff" />
              </div>
              <div style={{ padding: '8px 14px', background: 'var(--bg-card)', borderRadius: 12, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Gemini চিন্তা করছে... 🧠
              </div>
            </div>
          )}

          {/* Extracted Tasks Action Box */}
          {extractedTasks.length > 0 && !addedSuccess && (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--primary)',
                borderRadius: 14,
                padding: 16,
                boxShadow: '0 4px 16px var(--primary-glow)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={15} /> জেনারেট করা টাস্ক ({extractedTasks.length} টি)
                </span>
                <span className="badge badge-progress" style={{ fontSize: '0.65rem' }}>Auto-Parsed</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {extractedTasks.map((t, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', background: 'var(--bg-input)', padding: '6px 10px', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span>📌 {t.title}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t.priority}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleApplyTasksToBoard}
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
              >
                <Plus size={16} /> এক ক্লিকে Kanban ও ক্যালেন্ডারে যোগ করুন
              </button>
            </div>
          )}

          {addedSuccess && (
            <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: 12, borderRadius: 10, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={18} />
              টাস্কগুলো সফলভাবে Kanban বোর্ড ও ক্যালেন্ডারে যুক্ত করা হয়েছে!
            </div>
          )}
        </div>

        {/* Input & Multimodal Tools */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          {/* Optional Code Snippet Drawer */}
          {showCodeBox && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span>কোড স্নিপেট বা বাগ ব্যাখ্যা:</span>
                <button onClick={() => setShowCodeBox(false)} style={{ color: 'var(--danger)' }}>বাতিল</button>
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
              <button onClick={() => setVoiceTranscript('')} style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>মুছুন</button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Toggle Code input */}
            <button
              type="button"
              onClick={() => setShowCodeBox(!showCodeBox)}
              title="কোড পেস্ট করুন"
              style={{
                padding: 10,
                borderRadius: 10,
                background: showCodeBox ? 'var(--primary)' : 'var(--bg-input)',
                color: showCodeBox ? '#fff' : 'var(--text-secondary)'
              }}
            >
              <Code size={18} />
            </button>

            {/* Toggle Voice Record */}
            <button
              type="button"
              onClick={toggleRecording}
              title="মুখে কথা বলে টাস্ক বোঝান"
              style={{
                padding: 10,
                borderRadius: 10,
                background: isRecording ? 'var(--danger)' : 'var(--bg-input)',
                color: isRecording ? '#fff' : 'var(--text-secondary)',
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
              placeholder={isRecording ? 'রেকর্ড হচ্ছে... মুখে বলুন' : 'কাজের কথা লিখুন বা মুখে বলুন...'}
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
