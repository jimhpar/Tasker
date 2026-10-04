import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  ChevronDown,
  X,
  Send,
  Paperclip,
  Image,
  Mic,
  Shield,
  Download
} from 'lucide-react';

export default function ChatDrawer() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatTarget, setActiveChatTarget] = useState('Alpha Team Squad');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'tanvir_tech',
      text: 'আসসালামু আলাইকুম! আজকের প্রজেক্টের কাজ কতটুকু হলো?',
      time: '10:30 AM',
      isMe: false
    },
    {
      id: 2,
      sender: 'zim_founder',
      text: 'Authentication এবং Calendar View রেডি। একটু পর আপডেট দিচ্ছি।',
      time: '10:32 AM',
      isMe: true
    }
  ]);
  const [text, setText] = useState('');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: user?.username || 'You',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true
    };

    setMessages((prev) => [...prev, newMsg]);
    setText('');
  };

  const handleLocalFileShare = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const newMsg = {
        id: Date.now(),
        sender: user?.username || 'You',
        text: `📎 ফাইল শেয়ার: ${file.name}`,
        fileData: {
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: reader.result
        },
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true
      };
      setMessages((prev) => [...prev, newMsg]);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-primary"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          borderRadius: 'var(--radius-full)',
          padding: '12px 20px',
          boxShadow: '0 8px 24px rgba(99,102,241,0.5)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}
      >
        <MessageSquare size={20} />
        <span style={{ fontWeight: 700 }}>Team Chat</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 360,
        height: 480,
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <MessageSquare size={16} />
          </div>
          <div>
            <h4 style={{ fontWeight: 700, fontSize: '0.85rem' }}>{activeChatTarget}</h4>
            <p style={{ fontSize: '0.68rem', color: 'var(--success)' }}>
              🔒 Local Storage (WhatsApp Style)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setIsOpen(false)} className="btn-ghost" style={{ padding: 4 }}>
            <ChevronDown size={18} />
          </button>
          <button onClick={() => setIsOpen(false)} className="btn-ghost" style={{ padding: 4 }}>
            <X size={18} />
          </button>
        </div>
      </div>

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
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>
                  @{m.sender}
                </div>
              )}
              {m.text}

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
                    <Download size={12} /> সেভ করুন ({(m.fileData.size / 1024).toFixed(0)} KB)
                  </a>
                </div>
              )}
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2, alignSelf: m.isMe ? 'flex-end' : 'flex-start' }}>
              {m.time}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Row */}
      <form onSubmit={handleSend} style={{ padding: '10px 14px', background: 'var(--header-bg)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
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
          title="ফাইল / ছবি পাঠান (Local Storage)"
        >
          <Paperclip size={18} />
        </button>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="মেসেজ লিখুন..."
          style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', borderRadius: 'var(--radius-full)' }}
        />

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!text.trim()}
          style={{ padding: '8px 12px', borderRadius: 'var(--radius-full)' }}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
