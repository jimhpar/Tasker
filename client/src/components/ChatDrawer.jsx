import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { teamApi, peopleApi, communityApi, notifyDataChanged } from '../services/api';
import {
  MessageSquare,
  ChevronDown,
  X,
  Send,
  Paperclip,
  Download,
  Users,
  User,
  ArrowLeft,
  Circle,
  Smile,
  Reply,
  Mic,
  Square
} from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🎉', '🚀', '😊', '💡', '👏', '✅', '🙌', '💯', '✨'];

export default function ChatDrawer({ hideTrigger = false }) {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('tasker_chat_active_tab') || 'teams';
    } catch {
      return 'teams';
    }
  });
  const [teams, setTeams] = useState([]);
  const [people, setPeople] = useState([]);

  // Selected conversation target: { id, name, type: 'team' | 'direct', subtitle }
  const [activeTarget, setActiveTarget] = useState(() => {
    try {
      const viewState = localStorage.getItem('tasker_chat_view_state');
      if (viewState === 'list') return null;
      const saved = localStorage.getItem('tasker_last_chat_target');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [messages, setMessages] = useState(() => {
    try {
      const viewState = localStorage.getItem('tasker_chat_view_state');
      if (viewState === 'list') return [];
      const saved = localStorage.getItem('tasker_last_chat_target');
      if (saved) {
        const target = JSON.parse(saved);
        const raw = localStorage.getItem(`tasker_chat_history_${target.id}`);
        return raw ? JSON.parse(raw) : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e) => {
      const tag = (e.target?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA'].includes(tag)) {
        setIsInputFocused(true);
      }
    };
    const handleFocusOut = () => setIsInputFocused(false);
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Load teams and people when drawer is opened
  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen]);

  // Real-time chat sync across tabs & windows
  useEffect(() => {
    const handleSync = () => {
      if (activeTarget) {
        const raw = localStorage.getItem(`tasker_chat_history_${activeTarget.id}`);
        if (raw) {
          try { setMessages(JSON.parse(raw) || []); } catch {}
        }
      }
    };
    window.addEventListener('tasker_chat_updated', handleSync);
    return () => window.removeEventListener('tasker_chat_updated', handleSync);
  }, [activeTarget]);

  const loadContacts = async () => {
    try {
      const [tList, pList] = await Promise.all([
        teamApi.getTeams().catch(() => []),
        peopleApi.getPeople().catch(() => [])
      ]);
      setTeams(tList || []);
      setPeople(pList || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBackToList = () => {
    setActiveTarget(null);
    try {
      localStorage.setItem('tasker_chat_view_state', 'list');
      localStorage.removeItem('tasker_last_chat_target');
    } catch {}
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('tasker_chat_active_tab', tab);
    } catch {}
  };

  // Channel ID helper for Direct & Team channels
  const getChannelInfo = useCallback((target) => {
    if (!target) return { channelType: 'Direct', channelId: '' };
    if (target.type === 'team') {
      return { channelType: 'Team', channelId: String(target.id || target._id || target.name).toLowerCase() };
    }
    const myU = (user?.username || '').toLowerCase();
    const partnerU = (target.username || target.name || target.id || '').toLowerCase();
    return { channelType: 'Direct', channelId: `direct_${[myU, partnerU].sort().join('_')}` };
  }, [user]);

  const fetchChannelMessages = useCallback(async (target) => {
    const t = target || activeTarget;
    if (!t) return;
    const { channelType, channelId } = getChannelInfo(t);
    if (!channelId) return;

    try {
      const serverMsgs = await communityApi.getChannelMessages(channelType, channelId);
      if (Array.isArray(serverMsgs) && serverMsgs.length > 0) {
        const myU = (user?.username || '').toLowerCase();
        const formatted = serverMsgs.map(m => ({
          id: m._id || m.id,
          sender: m.senderUsername || 'User',
          text: m.content || '',
          audioData: m.audioData || null,
          time: new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: (m.senderUsername || '').toLowerCase() === myU,
          replyTo: m.replyTo
        }));
        setMessages(formatted);
        const storageKey = `tasker_chat_history_${t.id}`;
        try { localStorage.setItem(storageKey, JSON.stringify(formatted)); } catch {}
      }
    } catch (e) {
      console.warn('Channel messages fetch error:', e);
    }
  }, [activeTarget, getChannelInfo, user]);

  // Load chat history for selected target
  const selectConversation = (target) => {
    setActiveTarget(target);
    try {
      localStorage.setItem('tasker_chat_view_state', 'chat');
      localStorage.setItem('tasker_last_chat_target', JSON.stringify(target));
    } catch {}
    const storageKey = `tasker_chat_history_${target.id}`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        setMessages(JSON.parse(raw) || []);
      } catch {
        setMessages([]);
      }
    } else {
      // Default welcome message
      const welcome = [
        {
          id: Date.now(),
          sender: target.type === 'team' ? target.name : (target.name || 'Contact'),
          text: target.type === 'team'
            ? `Welcome to the ${target.name} team channel! Share updates and files here.`
            : `Connected with ${target.name}. Send a direct message to start chatting!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: false
        }
      ];
      setMessages(welcome);
      localStorage.setItem(storageKey, JSON.stringify(welcome));
    }

    // Immediately fetch from cloud
    fetchChannelMessages(target);
  };

  useEffect(() => {
    if (isOpen && activeTarget) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTarget]);

  // Fast live polling for active conversation
  useEffect(() => {
    if (isOpen && activeTarget) {
      fetchChannelMessages(activeTarget);
      const interval = setInterval(() => {
        fetchChannelMessages(activeTarget);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [isOpen, activeTarget, fetchChannelMessages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !activeTarget) return;

    const sentText = text.trim();
    const currentReplying = replyingTo;

    const newMsg = {
      id: Date.now(),
      sender: user?.username || 'You',
      text: sentText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
      replyTo: currentReplying ? { id: currentReplying.id, sender: currentReplying.sender, text: currentReplying.text } : null
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    try { localStorage.setItem(`tasker_chat_history_${activeTarget.id}`, JSON.stringify(updated)); } catch {}
    setText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);

    // Save to Cloud MongoDB
    const { channelType, channelId } = getChannelInfo(activeTarget);
    await communityApi.sendChannelMessage(channelType, channelId, {
      content: sentText,
      replyTo: currentReplying ? { id: currentReplying.id, sender: currentReplying.sender, text: currentReplying.text } : null
    });
    notifyDataChanged('chat', { targetId: activeTarget.id });
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result;
          handleSendVoiceMessage(base64Audio);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone error:', err);
      alert('Microphone access denied or not supported.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const handleSendVoiceMessage = async (base64Audio) => {
    if (!activeTarget) return;
    const newMsg = {
      id: Date.now(),
      sender: user?.username || 'You',
      text: '🎤 Voice message',
      audioData: base64Audio,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
      replyTo: replyingTo ? { id: replyingTo.id, sender: replyingTo.sender, text: replyingTo.text } : null
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    try { localStorage.setItem(`tasker_chat_history_${activeTarget.id}`, JSON.stringify(updated)); } catch {}
    setReplyingTo(null);

    // Save to Cloud MongoDB
    const { channelType, channelId } = getChannelInfo(activeTarget);
    await communityApi.sendChannelMessage(channelType, channelId, {
      content: '🎤 Voice message',
      audioData: base64Audio,
      replyTo: replyingTo ? { id: replyingTo.id, sender: replyingTo.sender, text: replyingTo.text } : null
    });
    notifyDataChanged('chat', { targetId: activeTarget.id });
  };

  const handleLocalFileShare = (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeTarget) return;

    const reader = new FileReader();
    reader.onload = () => {
      const newMsg = {
        id: Date.now(),
        sender: user?.username || 'You',
        text: `📎 Shared file: ${file.name}`,
        fileData: {
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: reader.result
        },
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true
      };
      const updated = [...messages, newMsg];
      setMessages(updated);
      localStorage.setItem(`tasker_chat_history_${activeTarget.id}`, JSON.stringify(updated));
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) {
    if (hideTrigger || isInputFocused) return null;
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-primary chat-floating-trigger"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          borderRadius: 'var(--radius-full)',
          padding: '12px 20px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          background: 'var(--active-btn-bg)',
          color: 'var(--active-btn-text)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}
      >
        <MessageSquare size={19} color="currentColor" />
        <span style={{ fontWeight: 700 }}>Chat</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
      </button>
    );
  }

  return (
    <div
      className="chat-floating-drawer"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 380,
        height: 520,
        background: 'var(--bg-surface)',
        border: 'var(--glass-border)',
        borderRadius: '20px',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 95,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Drawer Header */}
      <div
        className="chat-drawer-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          {activeTarget ? (
            <>
              <button
                type="button"
                onClick={handleBackToList}
                className="btn-ghost"
                style={{
                  padding: '6px 8px',
                  marginRight: 4,
                  borderRadius: 8,
                  background: 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
                title="Switch Conversation"
                aria-label="Back to conversations"
              >
                <ArrowLeft size={18} />
              </button>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--bg-app)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                {activeTarget.type === 'team' ? (
                  <Users size={16} />
                ) : (
                  (activeTarget.name?.[0] || 'U').toUpperCase()
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1, paddingRight: 6 }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.85rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeTarget.name}
                </h4>
                <p style={{ fontSize: '0.68rem', color: 'var(--success)', margin: 0 }}>
                  ● {activeTarget.type === 'team' ? 'Team Channel' : 'Direct Message'}
                </p>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={18} color="var(--primary)" />
              <h4 style={{ fontWeight: 800, fontSize: '0.9rem', margin: 0 }}>
                {lang === 'bn' ? 'চ্যাট ও বার্তা' : 'Conversations'}
              </h4>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setIsOpen(false)}
            className="btn-ghost"
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              background: 'var(--bg-input)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Minimize"
          >
            <ChevronDown size={18} />
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              setActiveTarget(null);
            }}
            className="btn-ghost"
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              background: 'var(--bg-input)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Drawer Body: Either Conversation List OR Active Chat */}
      {!activeTarget ? (
        // Conversation Target Selector: Teams vs People
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tab Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 4, margin: '12px 14px 8px', borderRadius: 10 }}>
            <button
              type="button"
              onClick={() => handleTabChange('teams')}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: activeTab === 'teams' ? 'var(--bg-card)' : 'transparent',
                color: activeTab === 'teams' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: activeTab === 'teams' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Users size={14} />
              <span>Teams ({teams.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('people')}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: activeTab === 'people' ? 'var(--bg-card)' : 'transparent',
                color: activeTab === 'people' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: activeTab === 'people' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <User size={14} />
              <span>Connected People ({people.length})</span>
            </button>
          </div>

          {/* List Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px' }}>
            {activeTab === 'teams' ? (
              teams.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No teams found. Create a team in My Team to start team chatting!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {teams.map((tm) => (
                    <div
                      key={tm._id}
                      onClick={() => selectConversation({ id: tm._id, name: tm.name, type: 'team', subtitle: 'Team Channel' })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'var(--bg-input)',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary)', color: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Users size={16} />
                        </div>
                        <div>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{tm.name}</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                            {tm.members?.length || 1} members • Team Channel
                          </p>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700 }}>Open →</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              people.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No connected people yet. Search and connect people in the People section!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {people.map((p) => (
                    <div
                      key={p._id}
                      onClick={() => selectConversation({ id: p._id, name: p.fullName || p.username, type: 'direct', subtitle: `@${p.username}` })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'var(--bg-input)',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                          {(p.fullName?.[0] || p.username?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{p.fullName || p.username}</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                            @{p.username} {p.email ? `• ${p.email}` : ''}
                          </p>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700 }}>Chat →</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        // Active Chat Conversation View
        <>
          {/* Messages Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div
                  style={{
                    background: m.isMe ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--bg-input)',
                    color: m.isMe ? '#ffffff' : 'var(--text-main)',
                    padding: '8px 12px',
                    borderRadius: m.isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    fontSize: '0.82rem',
                    lineHeight: 1.4,
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {!m.isMe && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)' }}>
                        @{m.sender}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(m)}
                        className="btn-ghost"
                        style={{ padding: 2, borderRadius: 4, opacity: 0.7 }}
                        title="Reply"
                      >
                        <Reply size={12} />
                      </button>
                    </div>
                  )}

                  {/* Reply Quote Banner */}
                  {m.replyTo && (
                    <div
                      style={{
                        background: 'rgba(0,0,0,0.12)',
                        borderLeft: '3px solid var(--primary)',
                        padding: '3px 6px',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        marginBottom: 4,
                        color: m.isMe ? '#fff' : 'var(--text-secondary)'
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>@{m.replyTo.sender}:</span> {m.replyTo.text}
                    </div>
                  )}

                  <div>{m.text}</div>

                  {/* Audio Voice Note Player */}
                  {m.audioData && (
                    <div style={{ marginTop: 6 }}>
                      <audio controls src={m.audioData} style={{ height: 32, width: '100%', minWidth: 180, borderRadius: 6 }} />
                    </div>
                  )}

                  {/* Local Media rendering */}
                  {m.fileData && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      {m.fileData.type.startsWith('image/') && (
                        <img src={m.fileData.dataUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 6, marginBottom: 4 }} />
                      )}
                      <a
                        href={m.fileData.dataUrl}
                        download={m.fileData.name}
                        style={{ fontSize: '0.72rem', color: m.isMe ? '#fff' : 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, textDecoration: 'none' }}
                      >
                        <Download size={12} /> Save ({(m.fileData.size / 1024).toFixed(0)} KB)
                      </a>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, alignSelf: m.isMe ? 'flex-end' : 'flex-start' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {m.time}
                  </span>
                  {m.isMe && (
                    <button
                      type="button"
                      onClick={() => setReplyingTo(m)}
                      className="btn-ghost"
                      style={{ padding: 2, borderRadius: 4, opacity: 0.6 }}
                      title="Reply"
                    >
                      <Reply size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Replying banner */}
          {replyingTo && (
            <div
              style={{
                padding: '6px 12px',
                background: 'var(--bg-input)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                <Reply size={13} color="var(--primary)" />
                <span style={{ fontWeight: 700 }}>@{replyingTo.sender}:</span>
                <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {replyingTo.text}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="btn-ghost"
                style={{ padding: 2, borderRadius: '50%' }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Emoji Picker Row */}
          {showEmojiPicker && (
            <div
              style={{
                padding: '6px 10px',
                background: 'var(--bg-card)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                overflowX: 'auto'
              }}
            >
              {QUICK_EMOJIS.map((em, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setText((prev) => prev + em)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: 4
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          {/* Input Row */}
          <form onSubmit={handleSend} style={{ padding: '8px 12px', background: 'var(--header-bg)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLocalFileShare}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost"
              style={{ padding: 6, borderRadius: '50%' }}
              title="Share file/image"
            >
              <Paperclip size={17} />
            </button>

            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="btn-ghost"
              style={{ padding: 6, borderRadius: '50%', color: showEmojiPicker ? 'var(--primary)' : 'var(--text-muted)' }}
              title="Emoji"
            >
              <Smile size={17} />
            </button>

            {isRecording ? (
              <button
                type="button"
                onClick={stopVoiceRecording}
                className="btn btn-primary"
                style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Square size={13} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{recordingSeconds}s</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startVoiceRecording}
                className="btn-ghost"
                style={{ padding: 6, borderRadius: '50%' }}
                title="Voice Note"
              >
                <Mic size={17} />
              </button>
            )}

            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message ${activeTarget.name}...`}
              style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem', borderRadius: 'var(--radius-full)' }}
            />

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!text.trim()}
              style={{ padding: '7px 10px', borderRadius: 'var(--radius-full)' }}
            >
              <Send size={14} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
