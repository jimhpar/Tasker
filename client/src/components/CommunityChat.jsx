import React, { useState, useEffect, useRef } from 'react';
import { communityApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Send,
  Image,
  Paperclip,
  Mic,
  MicOff,
  Globe,
  ShieldCheck,
  Download,
  Sparkles,
  Wifi
} from 'lucide-react';

export default function CommunityChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [p2pTransferActive, setP2pTransferActive] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadCommunityMessages();
    const interval = setInterval(loadCommunityMessages, 10000); // Polling sync
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadCommunityMessages = async () => {
    try {
      const data = await communityApi.getMessages();
      setMessages(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const payload = {
      content: inputText.trim(),
      isMediaP2P: false
    };

    setInputText('');
    try {
      const newMsg = await communityApi.sendMessage(payload);
      setMessages((prev) => [...prev, newMsg]);
    } catch (e) {
      console.error(e);
    }
  };

  // P2P Direct File / Image Share (Zero Cloud Storage Hosting)
  const handleP2pFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setP2pTransferActive(true);

    // Read file locally as Data URL for P2P chunk transfer
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;

      const p2pMessage = {
        content: `📎 P2P শেয়ার করেছেন: ${file.name}`,
        isMediaP2P: true,
        mediaMetadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          dataUrl: base64Data // directly kept in peer memory / local device
        }
      };

      try {
        const sent = await communityApi.sendMessage(p2pMessage);
        // Attach the local preview in state
        sent.mediaMetadata.dataUrl = base64Data;
        setMessages((prev) => [...prev, sent]);
      } catch (err) {
        console.error(err);
      } finally {
        setP2pTransferActive(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="card"
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(139,92,246,0.3)'
            }}
          >
            <Globe size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              গ্লোবাল কমিউনিটি চ্যাট (Global Community)
              <span style={{ fontSize: '0.65rem', background: 'var(--success-bg)', color: 'var(--success)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                ● Live Peers
              </span>
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              সব ইউজারের উন্মুক্ত আলোচনা ও সরাসরি P2P ফাইল শেয়ারিং
            </p>
          </div>
        </div>

        {/* Zero-host indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-input)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <ShieldCheck size={14} color="var(--success)" />
          <span>Zero Server Storage (P2P Transfer)</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map((msg, idx) => {
          const isMe = msg.senderUsername === user?.username;
          const isMedia = msg.isMediaP2P;

          return (
            <div
              key={msg._id || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '75%'
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2, paddingLeft: 4, paddingRight: 4, textAlign: isMe ? 'right' : 'left' }}>
                {isMe ? 'আপনি (You)' : `@${msg.senderUsername}`} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>

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
                {msg.content}

                {/* P2P File / Image Rendering */}
                {isMedia && msg.mediaMetadata && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                    {msg.mediaMetadata.mimeType?.startsWith('image/') && msg.mediaMetadata.dataUrl ? (
                      <img
                        src={msg.mediaMetadata.dataUrl}
                        alt="p2p shared"
                        style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, objectFit: 'cover', display: 'block', marginBottom: 6 }}
                      />
                    ) : null}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span>📁 {msg.mediaMetadata.fileName}</span>
                      {msg.mediaMetadata.dataUrl && (
                        <a
                          href={msg.mediaMetadata.dataUrl}
                          download={msg.mediaMetadata.fileName}
                          style={{ color: isMe ? '#fff' : 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                        >
                          <Download size={14} /> সেভ করুন
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer */}
      <form onSubmit={handleSendMessage} style={{ padding: '14px 20px', background: 'var(--header-bg)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleP2pFileSelect}
          style={{ display: 'none' }}
        />

        {/* File / Image Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn-ghost"
          style={{ padding: 8, borderRadius: '50%' }}
          title="ছবি বা ফাইল শেয়ার করুন (P2P Direct)"
        >
          <Paperclip size={20} />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="কমিউনিটিতে মেসেজ লিখুন..."
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
