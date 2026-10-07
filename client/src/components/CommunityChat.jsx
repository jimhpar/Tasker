import React, { useState, useEffect, useRef } from 'react';
import { communityApi, notifyDataChanged } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { playAlertChime, addNotification } from '../services/notificationService';
import {
  Send,
  Mic,
  Square,
  Globe,
  Smile,
  Reply,
  X,
  Bell,
  BellOff,
  CheckCircle2
} from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🎉', '🚀', '😊', '💡', '👏', '✅', '🙌', '💯', '✨'];

export default function CommunityChat() {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Global Chat Subscription Status (Default: Muted/Unsubscribed)
  const [isSubscribed, setIsSubscribed] = useState(() => {
    try {
      return localStorage.getItem('tasker_global_chat_subscribed') === 'true';
    } catch {
      return false;
    }
  });

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const messagesEndRef = useRef(null);

  // Mark as read immediately on mount and clear red dot
  useEffect(() => {
    try {
      localStorage.setItem('tasker_global_last_read_time', Date.now().toString());
      localStorage.setItem('tasker_global_unread', 'false');
      window.dispatchEvent(new CustomEvent('tasker_global_unread_changed', { detail: { hasUnread: false } }));
    } catch {}

    loadCommunityMessages();

    // Listen for real-time community chat broadcast
    const handleChatSync = () => loadCommunityMessages();
    window.addEventListener('tasker_community_chat_updated', handleChatSync);

    const interval = setInterval(loadCommunityMessages, 4000); // Polling sync
    return () => {
      clearInterval(interval);
      window.removeEventListener('tasker_community_chat_updated', handleChatSync);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadCommunityMessages = async () => {
    try {
      const data = await communityApi.getMessages();
      setMessages(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSubscription = () => {
    const next = !isSubscribed;
    setIsSubscribed(next);
    try {
      localStorage.setItem('tasker_global_chat_subscribed', next ? 'true' : 'false');
    } catch {}
    if (next) {
      playAlertChime();
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    // Auto-subscribe user if they send a message while unsubscribed
    if (!isSubscribed) {
      setIsSubscribed(true);
      try {
        localStorage.setItem('tasker_global_chat_subscribed', 'true');
      } catch {}
    }

    const payload = {
      content: inputText.trim(),
      isMediaP2P: false,
      replyTo: replyingTo ? { id: replyingTo._id, sender: replyingTo.senderUsername, text: replyingTo.content } : null
    };

    setInputText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);

    try {
      const newMsg = await communityApi.sendMessage(payload);
      if (payload.replyTo) {
        newMsg.replyTo = payload.replyTo;
      }
      setMessages((prev) => [...prev, newMsg]);
      notifyDataChanged('community_chat');
    } catch (e) {
      console.error(e);
    }
  };

  // Voice recording handlers
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
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          await handleSendVoiceMessage(base64Audio);
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
      alert(lang === 'bn' ? 'মাইক্রোফোনের অনুমতি দেওয়া হয়নি।' : 'Microphone permission not granted.');
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
    if (!isSubscribed) {
      setIsSubscribed(true);
      try {
        localStorage.setItem('tasker_global_chat_subscribed', 'true');
      } catch {}
    }

    const payload = {
      content: '🎤 ভয়েস বার্তা (Voice Note)',
      audioData: base64Audio,
      isMediaP2P: false,
      replyTo: replyingTo ? { id: replyingTo._id, sender: replyingTo.senderUsername, text: replyingTo.content } : null
    };

    setReplyingTo(null);
    try {
      const newMsg = await communityApi.sendMessage(payload);
      newMsg.audioData = base64Audio;
      setMessages((prev) => [...prev, newMsg]);
      notifyDataChanged('community_chat');
    } catch (e) {
      console.error(e);
    }
  };

  const handleEmojiClick = (emoji) => {
    setInputText((prev) => prev + emoji);
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className="card community-chat-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
        padding: 0,
        overflow: 'hidden'
      }}
    >
      {/* Community Header */}
      <div
        className="community-chat-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--bg-app)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)'
            }}
          >
            <Globe size={20} color="var(--bg-app)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {lang === 'bn' ? 'গ্লোবাল কমিউনিটি চ্যাট' : 'Global Community Chat'}
              <span style={{ fontSize: '0.65rem', background: 'var(--success-bg)', color: 'var(--success)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                ● Live
              </span>
            </h3>
            <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {lang === 'bn' ? 'সকল ব্যবহারকারীর জন্য উন্মুক্ত আলোচনা ও ভয়েস চ্যাট (ফাইল/ছবি ছাড়া)' : 'Open community discussion & voice notes (No files/images)'}
            </p>
          </div>
        </div>

        {/* Subscribe / Unsubscribe Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={toggleSubscription}
            className={isSubscribed ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            title={isSubscribed ? 'Click to unsubscribe/mute global notifications' : 'Click to subscribe to global chat updates'}
          >
            {isSubscribed ? (
              <>
                <Bell size={14} />
                <span>{lang === 'bn' ? 'সাবস্ক্রাইব করা রয়েছে' : 'Subscribed'}</span>
              </>
            ) : (
              <>
                <BellOff size={14} color="var(--text-muted)" />
                <span>{lang === 'bn' ? 'মিউট (সাবস্ক্রাইব করুন)' : 'Muted (Subscribe)'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map((msg, idx) => {
          const isMe = msg.senderUsername === user?.username;

          return (
            <div
              key={msg._id || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '75%',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {isMe ? 'আপনি (You)' : `@${msg.senderUsername}`} • {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(msg)}
                  className="btn-ghost"
                  style={{ padding: 2, borderRadius: 4, opacity: 0.6 }}
                  title="Reply"
                >
                  <Reply size={12} />
                </button>
              </div>

              <div
                style={{
                  background: isMe ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--bg-input)',
                  color: isMe ? '#ffffff' : 'var(--text-main)',
                  padding: '10px 16px',
                  borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* Reply preview if replying to another message */}
                {msg.replyTo && (
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.12)',
                      borderLeft: '3px solid #22c55e',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: '0.74rem',
                      marginBottom: 6,
                      color: isMe ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)'
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>@{msg.replyTo.sender}:</span> {msg.replyTo.text}
                  </div>
                )}

                {msg.content}

                {/* Voice Audio Message Playback */}
                {msg.audioData && (
                  <div style={{ marginTop: 8 }}>
                    <audio
                      controls
                      src={msg.audioData}
                      style={{ height: 32, width: '100%', minWidth: 200, borderRadius: 6 }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--bg-hover)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <Reply size={14} color="var(--primary)" />
            <span style={{ fontWeight: 700 }}>@{replyingTo.senderUsername}:</span>
            <span style={{ color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {replyingTo.content}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="btn-ghost"
            style={{ padding: 4, borderRadius: '50%' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Emoji Picker Palette */}
      {showEmojiPicker && (
        <div
          style={{
            padding: '8px 14px',
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto'
          }}
        >
          {QUICK_EMOJIS.map((em, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleEmojiClick(em)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 6
              }}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Message Input Footer (Images and files strictly disabled in Global Chat) */}
      <form
        className="community-chat-form"
        onSubmit={handleSendMessage}
        style={{
          padding: '12px 18px',
          background: 'var(--header-bg)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}
      >
        {/* Emoji Toggle Button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="btn-ghost"
          style={{ padding: 8, borderRadius: '50%', color: showEmojiPicker ? 'var(--primary)' : 'var(--text-muted)' }}
          title="Emojis"
        >
          <Smile size={20} />
        </button>

        {/* Voice Note Record / Stop Button */}
        {isRecording ? (
          <button
            type="button"
            onClick={stopVoiceRecording}
            className="btn btn-primary"
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-full)', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Square size={14} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{formatTimer(recordingSeconds)}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startVoiceRecording}
            className="btn-ghost"
            style={{ padding: 8, borderRadius: '50%', color: 'var(--text-muted)' }}
            title="Record Voice Note"
          >
            <Mic size={20} />
          </button>
        )}

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={lang === 'bn' ? 'গ্লোবাল কমিউনিটিতে বার্তা লিখুন...' : 'Type a message to community...'}
          style={{ flex: 1, padding: '10px 16px', fontSize: '0.9rem', borderRadius: 'var(--radius-full)' }}
        />

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!inputText.trim()}
          style={{ padding: '10px 18px', borderRadius: 'var(--radius-full)' }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
