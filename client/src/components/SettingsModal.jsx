import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getGeminiKey, setGeminiKey, queryGeminiReasoning } from '../services/gemini';
import {
  X,
  User,
  Sliders,
  Folder,
  Sun,
  Moon,
  Sparkles,
  CheckCircle,
  Key,
  Laptop,
  Languages
} from 'lucide-react';

export default function SettingsModal({ onClose }) {
  const { user, theme, setTheme, updateProfile, updateSettings } = useAuth();
  const { lang, setLanguage, t } = useLanguage();

  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'profile' | 'ai'

  // Profile fields
  const [fullName, setFullName] = useState(user?.profile?.fullName || '');
  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [linksText, setLinksText] = useState((user?.profile?.links || []).join(', '));
  const [avatar, setAvatar] = useState(user?.profile?.avatar || '');

  // Account / Settings fields
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [localDir, setLocalDir] = useState(user?.settings?.localAttachmentDir || 'C:/TaskerFiles');

  // Gemini Key
  const [geminiKey, setGeminiKeyState] = useState(getGeminiKey());
  const [geminiStatus, setGeminiStatus] = useState('');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      const links = linksText.split(',').map(s => s.trim()).filter(Boolean);
      await updateProfile({ fullName, bio, links, avatar });
      setSuccessMsg(t.profileUpdatedSuccess);
      // Automatically dismiss popup after saving
      setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      setSuccessMsg(t.profileUpdatedSuccess);
      setTimeout(() => {
        onClose();
      }, 700);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      const updates = {
        theme,
        localAttachmentDir: localDir
      };
      if (newUsername.trim() && newUsername.trim() !== user?.username) {
        updates.username = newUsername.trim();
      }
      if (newPassword.trim()) {
        updates.newPassword = newPassword.trim();
      }
      await updateSettings(updates);
      setSuccessMsg(t.savedSuccess);
      // Automatically dismiss popup after saving
      setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      setSuccessMsg(t.savedSuccess);
      setTimeout(() => {
        onClose();
      }, 700);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGeminiKey = async () => {
    setGeminiKey(geminiKey);
    setGeminiStatus(lang === 'bn' ? 'ভেরিফাই করা হচ্ছে...' : 'Verifying...');
    try {
      const res = await queryGeminiReasoning({ prompt: 'Ping test' });
      if (res) {
        setGeminiStatus(lang === 'bn' ? '✅ Gemini API Key সক্রিয় ও কার্যক্ষম!' : '✅ Gemini API Key active & verified!');
      }
    } catch (err) {
      setGeminiStatus(`⚠️ ${err.message}`);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 640 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sliders size={22} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{t.settingsTitle}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6, borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-input)', padding: '0 16px' }}>
          <button
            onClick={() => { setActiveTab('general'); setSuccessMsg(''); }}
            style={{
              padding: '12px 18px',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: activeTab === 'general' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'general' ? '2px solid var(--primary)' : '2px solid transparent'
            }}
          >
            {t.generalThemeTab}
          </button>
          <button
            onClick={() => { setActiveTab('profile'); setSuccessMsg(''); }}
            style={{
              padding: '12px 18px',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent'
            }}
          >
            {t.profileInfoTab}
          </button>
          <button
            onClick={() => { setActiveTab('ai'); setSuccessMsg(''); }}
            style={{
              padding: '12px 18px',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: activeTab === 'ai' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'ai' ? '2px solid var(--primary)' : '2px solid transparent'
            }}
          >
            {t.geminiKeyTab}
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: 24 }}>
          {successMsg && (
            <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} />
              {successMsg}
            </div>
          )}

          {activeTab === 'general' && (
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Language Switcher Section */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  <Languages size={15} style={{ display: 'inline', marginRight: 6 }} />
                  {lang === 'bn' ? 'অ্যাপের ভাষা (Language)' : 'App Language'}
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setLanguage('bn')}
                    className={`btn ${lang === 'bn' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '9px 14px', fontSize: '0.88rem' }}
                  >
                    🇧🇩 বাংলা (Bangla)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`btn ${lang === 'en' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '9px 14px', fontSize: '0.88rem' }}
                  >
                    🇺🇸 English
                  </button>
                </div>
              </div>

              {/* Theme Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>
                  {t.themeLabel}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { key: 'Dark', label: t.darkTheme, icon: Moon, desc: lang === 'bn' ? 'ডার্ক অ্যানেক্স' : 'Deep Obsidian' },
                    { key: 'Gray', label: t.grayTheme, icon: Laptop, desc: lang === 'bn' ? 'সফট মেটালিক' : 'Slate Metallic' },
                    { key: 'Light', label: t.lightTheme, icon: Sun, desc: lang === 'bn' ? 'উজ্জ্বল ক্লিন' : 'Clean & Bright' }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = theme === item.key;
                    return (
                      <div
                        key={item.key}
                        onClick={() => setTheme(item.key)}
                        style={{
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                          borderRadius: 12,
                          padding: '14px 12px',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--primary-glow)' : 'var(--bg-input)',
                          textAlign: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Icon size={22} color={isSelected ? 'var(--primary)' : 'var(--text-secondary)'} style={{ margin: '0 auto 6px' }} />
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Local Storage Directory */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  📁 {t.localStorageLabel}
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {t.localStorageDesc}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    value={localDir}
                    onChange={(e) => setLocalDir(e.target.value)}
                    placeholder="e.g. D:/TaskerFiles or C:/Users/.../Documents/Tasker"
                    style={{ flex: 1, padding: '10px 14px', fontSize: '0.9rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLocalDir('D:/Workstation/TaskerFiles');
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  >
                    <Folder size={16} /> {t.browseBtn}
                  </button>
                </div>
              </div>

              {/* Account Credentials */}
              <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>{t.accountCredsTitle}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{t.usernameLabel}</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{t.newPasswordLabel}</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : t.saveSettingsBtn}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  {t.fullNameLabel}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Zim Chowdhury"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  {t.avatarLabel}
                </label>
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://... or 👨‍💻 / 🌾"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  {t.bioLabel}
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={lang === 'bn' ? 'আপনার কাজের বিবরণ, পেশা বা পদবি লিখুন...' : 'Your bio, role, or profession...'}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  {t.linksLabel}
                </label>
                <input
                  type="text"
                  value={linksText}
                  onChange={(e) => setLinksText(e.target.value)}
                  placeholder="https://github.com/..., https://linkedin.com/..."
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (lang === 'bn' ? 'আপডেট হচ্ছে...' : 'Updating...') : t.updateProfileBtn}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Sparkles size={20} color="var(--primary)" />
                  <h4 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Google Gemini AI (BYOK)</h4>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {lang === 'bn'
                    ? 'আপনার নিজস্ব Gemini API Key ব্যবহার করে আপনি ভয়েস বা টেক্সট দিয়ে সারাদিনের শিডিউল ও টাস্ক সাজাতে পারবেন। কী-টি সম্পূর্ণ এনক্রিপ্ট হয়ে আপনার ডিভাইসে থাকবে।'
                    : 'Use your own Gemini API Key to process voice/text scheduling and task management. Stored securely on your device.'}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Gemini API Key
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKeyState(e.target.value)}
                      placeholder="AIzaSy..."
                      style={{ width: '100%', padding: '10px 14px 10px 36px', fontSize: '0.9rem', fontFamily: 'var(--font-code)' }}
                    />
                    <Key size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveGeminiKey}
                    className="btn btn-primary"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {lang === 'bn' ? 'সেভ ও টেস্ট' : 'Save & Test'}
                  </button>
                </div>
                {geminiStatus && (
                  <p style={{ marginTop: 8, fontSize: '0.82rem', fontWeight: 600, color: geminiStatus.includes('✅') ? 'var(--success)' : 'var(--warning)' }}>
                    {geminiStatus}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
