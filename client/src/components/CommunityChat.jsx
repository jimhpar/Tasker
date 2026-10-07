import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  CheckCircle2,
  ArrowDownUp
} from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🎉', '🚀', '😊', '💡', '👏', '✅', '🙌', '💯', '✨'];

export default function CommunityChat() {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem('tasker_community_messages_store_v2') || localStorage.getItem('tasker_community_cached_messages');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
          const valid = parsed.filter(m => new Date(m.createdAt || m.timestamp || Date.now()).getTime() >= threeDaysAgo);
          if (valid.length > 0) return valid;
        }
      }
    } catch {}
    return [];
  });
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Message Sort Order: 'newest_first' (Newest at top) vs 'bottom_up' (Traditional bottom flow)
  const [sortOrder, setSortOrder] = useState(() => {
    try {
      return localStorage.getItem('tasker_global_chat_sort_order') || 'newest_first';
    } catch {
      return 'newest_first';
    }
  });

  const toggleSortOrder = () => {
    const next = sortOrder === 'newest_first' ? 'bottom_up' : 'newest_first';
    setSortOrder(next);
    try {
      localStorage.setItem('tasker_global_chat_sort_order', next);
    } catch {}
  };

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
  const isDiscardingRef = useRef(false);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Derived messages list based on selected sort order
  const displayMessages = useMemo(() => {
    const list = [...messages];
    if (sortOrder === 'newest_first') {
      // Newest messages appear right at the top
      return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    // Bottom up: oldest at top, newest at bottom
    return list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }, [messages, sortOrder]);

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

    const interval = setInterval(loadCommunityMessages, 1800); // 1.8s ultra-fast sync
    return () => {
      clearInterval(interval);
      window.removeEventListener('tasker_community_chat_updated', handleChatSync);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (sortOrder === 'bottom_up') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else if (messagesContainerRef.current) {
      // For newest_first, start at top (newest)
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [messages.length, sortOrder]);

  const loadCommunityMessages = async () => {
    try {
      const data = await communityApi.getMessages();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (e) {
      console.warn('Error loading community messages:', e);
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

    // If currently recording voice, direct send immediately!
    if (isRecording) {
      stopVoiceRecording(false);
      return;
    }

    if (!inputText.trim()) return;

    // Auto-subscribe user if they send a message while unsubscribed
    if (!isSubscribed) {
      setIsSubscribed(true);
      try {
        localStorage.setItem('tasker_global_chat_subscribed', 'true');
      } catch {}
    }

    const sentText = inputText.trim();
    const currentReplying = replyingTo;

    setInputText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);

    const tempId = 'cmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const optimisticMsg = {
      _id: tempId,
      senderId: user?._id || user?.id || 'u_me',
      senderUsername: user?.username || 'You',
      senderRole: user?.role || 'Member',
      content: sentText,
      replyTo: currentReplying ? { id: currentReplying._id, sender: currentReplying.senderUsername, text: currentReplying.content } : null,
      createdAt: new Date().toISOString()
    };

    // 0ms Optimistic UI Append - Message appears INSTANTLY!
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const newMsg = await communityApi.sendMessage(payload);
      if (newMsg && newMsg._id) {
        setMessages((prev) => prev.map((m) => (m._id === tempId ? newMsg : m)));
      }
      notifyDataChanged('community_chat');
    } catch (e) {
      console.warn('Backend message save fallback:', e);
    }
  };

  // Voice recording handlers with Direct Send and Discard support
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      isDiscardingRef.current = false;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (isDiscardingRef.current) {
          audioChunksRef.current = [];
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
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

  const stopVoiceRecording = (cancel = false) => {
    isDiscardingRef.current = !!cancel;
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

    const tempId = 'temp_voice_' + Date.now();
    const optimisticVoice = {
      _id: tempId,
      senderId: user?._id || user?.id || 'me',
      senderUsername: user?.username || user?.fullName || 'You',
      senderRole: user?.role || 'Member',
      content: '🎤 ভয়েস বার্তা (Voice Note)',
      audioData: base64Audio,
      isMediaP2P: false,
      replyTo: replyingTo ? { id: replyingTo._id, sender: replyingTo.senderUsername, text: replyingTo.content } : null,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => {
      const next = [...prev, optimisticVoice];
      try {
        localStorage.setItem('tasker_community_cached_messages', JSON.stringify(next.slice(-100)));
      } catch {}
      return next;
    });

    const payload = {
      content: '🎤 ভয়েস বার্তা (Voice Note)',
      audioData: base64Audio,
      isMediaP2P: false,
      replyTo: replyingTo ? { id: replyingTo._id, sender: replyingTo.senderUsername, text: replyingTo.content } : null
    };

    setReplyingTo(null);
    try {
      const newMsg = await communityApi.sendMessage(payload);
      if (newMsg && newMsg._id) {
        newMsg.audioData = base64Audio;
        setMessages((prev) => {
          const updated = prev.map((m) => (m._id === tempId ? newMsg : m));
          try {
            localStorage.setItem('tasker_community_cached_messages', JSON.stringify(updated.slice(-100)));
          } catch {}
          return updated;
        });
      }
      notifyDataChanged('community_chat');
    } catch (e) {
      console.warn('Backend voice note save fallback:', e);
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
              {lang === 'bn' ? 'গ্লোবাল চ্যাট' : 'Global Chat'}
              <span style={{ fontSize: '0.65rem', background: 'var(--success-bg)', color: 'var(--success)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                ● Live
              </span>
            </h3>
            <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {lang === 'bn' ? 'সকল ব্যবহারকারীর জন্য উন্মুক্ত আলোচনা ও ভয়েস বার্তা' : 'Open live discussion & voice notes for all users'}
            </p>
          </div>
        </div>

        {/* Actions: Sort Order Toggle & Subscribe */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Newest First vs Standard Bottom-Up Toggle */}
          <button
            type="button"
            onClick={toggleSortOrder}
            className="btn-ghost"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: sortOrder === 'newest_first' ? 'rgba(34, 197, 94, 0.12)' : 'var(--bg-input)',
              border: '1px solid ' + (sortOrder === 'newest_first' ? 'rgba(34, 197, 94, 0.4)' : 'var(--border-subtle)'),
              color: sortOrder === 'newest_first' ? '#16a34a' : 'var(--text-main)',
              fontWeight: 700
            }}
            title={lang === 'bn' ? 'মেসেজ প্রদর্শন ক্রম পরিবর্তন' : 'Toggle message ordering'}
          >
            <ArrowDownUp size={14} />
            <span>{sortOrder === 'newest_first' ? (lang === 'bn' ? '⚡ নতুন বার্তা আগে' : '⚡ Newest First') : (lang === 'bn' ? '💬 স্বাভাবিক ফ্লো' : '💬 Chat Flow')}</span>
          </button>

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
                <span>{lang === 'bn' ? 'সাবস্ক্রাইব করা' : 'Subscribed'}</span>
              </>
            ) : (
              <>
                <BellOff size={14} color="var(--text-muted)" />
                <span>{lang === 'bn' ? 'মিউট' : 'Muted'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={messagesContainerRef}
        style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {displayMessages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Globe size={42} style={{ margin: '0 auto 12px', opacity: 0.35 }} />
            <h4 style={{ fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>
              {lang === 'bn' ? 'গত ৩ দিনে কোনো বার্তা নেই' : 'No messages in the last 3 days'}
            </h4>
            <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
              {lang === 'bn' ? 'নিচের বক্সে বার্তা লিখে আলোচনা শুরু করুন!' : 'Type a message below to start the community conversation!'}
            </p>
          </div>
        )}
        {displayMessages.map((msg, idx) => {
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
        {sortOrder === 'bottom_up' && <div ref={messagesEndRef} />}
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

        {/* Voice Note Record / Timer / Cancel Button */}
        {isRecording ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => stopVoiceRecording(true)}
              className="btn-ghost"
              style={{ padding: 6, borderRadius: '50%', color: '#ef4444' }}
              title={lang === 'bn' ? 'রেকর্ডিং বাতিল করুন' : 'Cancel recording'}
            >
              <X size={18} />
            </button>
            <div
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
              <span>{formatTimer(recordingSeconds)}</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startVoiceRecording}
            className="btn-ghost"
            style={{ padding: 8, borderRadius: '50%', color: 'var(--text-muted)' }}
            title={lang === 'bn' ? 'ভয়েস বার্তা রেকর্ড করুন' : 'Record Voice Note'}
          >
            <Mic size={20} />
          </button>
        )}

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isRecording
              ? (lang === 'bn' ? 'ভয়েস রেকর্ড হচ্ছে... সরাসরি পাঠাতে Send বাটনে চাপুন!' : 'Recording voice... Press Send button to transmit!')
              : (lang === 'bn' ? 'গ্লোবাল চ্যাটে বার্তা লিখুন...' : 'Type a message to Global Chat...')
          }
          disabled={isRecording}
          style={{ flex: 1, padding: '10px 16px', fontSize: '0.9rem', borderRadius: 'var(--radius-full)' }}
        />

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!isRecording && !inputText.trim()}
          style={{
            padding: '10px 18px',
            borderRadius: 'var(--radius-full)',
            background: isRecording ? '#22c55e' : undefined,
            boxShadow: isRecording ? '0 0 12px rgba(34, 197, 94, 0.5)' : undefined,
            transition: 'all 0.2s'
          }}
          title={isRecording ? (lang === 'bn' ? 'সরাসরি পাঠিয়ে দিন' : 'Send recording now') : 'Send'}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
