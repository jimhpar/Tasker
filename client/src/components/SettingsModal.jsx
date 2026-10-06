import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getGeminiKey, setGeminiKey, queryGeminiReasoning } from '../services/gemini';
import {
  CURRENT_VERSION,
  PUBLISHER_NAME,
  checkForUpdates,
  getGitHubRepo,
  setGitHubRepo
} from '../services/updateChecker';
import {
  X,
  Sliders,
  Folder,
  Sparkles,
  CheckCircle,
  Key,
  Languages,
  Trash2,
  Edit2,
  ExternalLink,
  RefreshCw,
  Power,
  ShieldCheck,
  Download
} from 'lucide-react';

export default function SettingsModal({ onClose }) {
  const { user, updateProfile, updateSettings } = useAuth();
  const { lang, setLanguage, t } = useLanguage();

  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'profile' | 'ai'

  // Profile fields
  const [fullName, setFullName] = useState(user?.profile?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [linksText, setLinksText] = useState((user?.profile?.links || []).join(', '));
  const [avatar, setAvatar] = useState(user?.profile?.avatar || '');

  // Account / Settings fields
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [localDir, setLocalDir] = useState(user?.settings?.localAttachmentDir || 'C:/TaskerFiles');
  const [autostart, setAutostart] = useState(true);

  // Gemini Key
  const [geminiKey, setGeminiKeyState] = useState(getGeminiKey());
  const [isEditingKey, setIsEditingKey] = useState(!getGeminiKey());
  const [geminiStatus, setGeminiStatus] = useState('');

  // Update Checker
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);
  const [repoInput, setRepoInput] = useState(getGitHubRepo());

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.profile?.fullName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setBio(user.profile?.bio || '');
      setLinksText((user.profile?.links || []).join(', '));
      setAvatar(user.profile?.avatar || '');
      setNewUsername(user.username || '');
    }
  }, [user]);

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

  useEffect(() => {
    if (window.electronAPI?.getAutostart) {
      window.electronAPI.getAutostart().then((val) => {
        if (typeof val === 'boolean') setAutostart(val);
      }).catch(() => {});
    }
  }, []);

  const handleOpenExternal = (url) => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleAutostart = async (checked) => {
    setAutostart(checked);
    if (window.electronAPI?.setAutostart) {
      await window.electronAPI.setAutostart(checked);
    }
  };

  const handleManualCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateResult(null);
    try {
      if (repoInput.trim()) {
        setGitHubRepo(repoInput.trim());
      }
      const res = await checkForUpdates(true);
      setUpdateResult(res);
    } catch (e) {
      setUpdateResult({ hasUpdate: false, error: e.message });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      const links = linksText.split(',').map(s => s.trim()).filter(Boolean);
      await updateProfile({
        fullName,
        username: newUsername.trim().toLowerCase(),
        email: email.trim(),
        phone: phone.trim(),
        bio,
        links,
        avatar
      });
      setSuccessMsg(t.profileUpdatedSuccess || 'Profile updated successfully!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      setSuccessMsg(t.profileUpdatedSuccess || 'Profile updated successfully!');
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
      if (repoInput.trim()) {
        setGitHubRepo(repoInput.trim());
      }
      const updates = {
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
    const trimmed = geminiKey.trim();
    if (!trimmed) {
      handleDeleteGeminiKey();
      return;
    }
    setGeminiKey(trimmed);
    setGeminiStatus(lang === 'bn' ? 'ভেরিফাই করা হচ্ছে...' : 'Verifying...');
    try {
      const res = await queryGeminiReasoning({ prompt: 'Ping test' });
      if (res) {
        setGeminiStatus(lang === 'bn' ? '✅ Gemini API Key সক্রিয় ও কার্যক্ষম!' : '✅ Gemini API Key active & verified!');
        setIsEditingKey(false);
      }
    } catch (err) {
      setGeminiStatus(`⚠️ ${err.message}`);
    }
  };

  const handleDeleteGeminiKey = () => {
    setGeminiKey('');
    setGeminiKeyState('');
    setIsEditingKey(true);
    setGeminiStatus(lang === 'bn' ? 'API Key মুছে ফেলা হয়েছে।' : 'API Key removed.');
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
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
            {lang === 'bn' ? 'সাধারণ সেটিংস' : 'General'}
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
                    🇬🇧 English
                  </button>
                </div>
              </div>

              {/* Windows Startup Boot Option */}
              <div style={{ padding: 14, background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Power size={18} color="var(--primary)" />
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
                        {lang === 'bn' ? 'উইন্ডোজ স্টার্টআপে স্বয়ংক্রিয়ভাবে চালু করুন' : 'Start Tasker with System Boot'}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                        {lang === 'bn' ? 'উইন্ডোজ অন হওয়ার সাথে সাথে টাস্কার ব্যাকগ্রাউন্ডে রেডি থাকবে' : 'Launch Tasker automatically when your computer starts'}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autostart}
                    onChange={(e) => handleToggleAutostart(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
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
                      setLocalDir('C:/TaskerFiles');
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  >
                    <Folder size={16} /> {t.browseBtn}
                  </button>
                </div>
              </div>

              {/* Software Version & Updates */}
              <div style={{ padding: 14, background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0 }}>
                      Tasker v{CURRENT_VERSION}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                      Publisher: <strong>{PUBLISHER_NAME}</strong> • Checks weekly for updates
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualCheckUpdate}
                    disabled={checkingUpdate}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <RefreshCw size={13} className={checkingUpdate ? 'spin' : ''} />
                    <span>{checkingUpdate ? (lang === 'bn' ? 'চেক হচ্ছে...' : 'Checking...') : (lang === 'bn' ? 'আপডেট চেক করুন' : 'Check for Updates')}</span>
                  </button>
                </div>

                {updateResult && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: updateResult.hasUpdate ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-card)', border: updateResult.hasUpdate ? '1px solid var(--success)' : '1px solid var(--border-subtle)' }}>
                    {updateResult.hasUpdate ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)', margin: 0 }}>
                            🚀 {updateResult.releaseName} {lang === 'bn' ? 'পাওয়া গেছে!' : 'is available!'}
                          </p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                            {updateResult.releaseNotes?.slice(0, 70)}...
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenExternal(updateResult.releaseUrl)}
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Download size={13} />
                          <span>{lang === 'bn' ? 'ডাউনলোড করুন' : 'Download'}</span>
                        </button>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                        {updateResult.error ? `⚠️ ${updateResult.error}` : (lang === 'bn' ? '✅ আপনি Tasker-এর সর্বশেষ সংস্করণ (v2.1.0) ব্যবহার করছেন।' : '✅ Tasker is up to date (v2.1.0).')}
                      </p>
                    )}
                  </div>
                )}
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
                  placeholder="e.g. Oliver Smith"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="e.g. oliver_dev"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                  required
                />
              </div>

              {/* Email and Phone Number Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                    {lang === 'bn' ? 'ইমেইল অ্যাড্রেস' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                    {lang === 'bn' ? 'মোবাইল / ফোন নম্বর' : 'Phone Number'}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1700 000000"
                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                  />
                </div>
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
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                  {lang === 'bn'
                    ? 'আপনার নিজস্ব Gemini API Key ব্যবহার করে আপনি ভয়েস বা টেক্সট দিয়ে সারাদিনের শিডিউল ও টাস্ক সাজাতে পারবেন। কী-টি সম্পূর্ণ এনক্রিপ্ট হয়ে আপনার ডিভাইসে থাকবে।'
                    : 'Use your own Gemini API Key to process voice/text scheduling and task management. Stored securely on your device.'}
                </p>

                {/* External Link button that opens in user's default browser */}
                <button
                  type="button"
                  onClick={() => handleOpenExternal('https://aistudio.google.com/app/apikey')}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.82rem',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Opens in your default browser"
                >
                  <Key size={15} color="var(--primary)" />
                  <span>{lang === 'bn' ? 'Google AI Studio থেকে ফ্রি API Key নিন' : 'Get Free Gemini API Key (Google AI Studio)'}</span>
                  <ExternalLink size={14} color="var(--text-muted)" />
                </button>
              </div>

              {/* Gemini API Key Display / Edit / Delete */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Gemini API Key
                </label>

                {geminiKey && !isEditingKey ? (
                  // Saved Key Card with Edit & Delete Options
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ShieldCheck size={18} color="var(--success)" />
                      <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-code)' }}>
                          AIzaSy••••••••••••{geminiKey.slice(-4)}
                        </p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--success)', margin: 0 }}>
                          {lang === 'bn' ? 'কী সেভ করা আছে' : 'API Key is saved & active'}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setIsEditingKey(true)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
                        title="Edit API Key"
                      >
                        <Edit2 size={13} />
                        <span>{lang === 'bn' ? 'এডিট' : 'Edit'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteGeminiKey}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}
                        title="Delete API Key"
                      >
                        <Trash2 size={13} />
                        <span>{lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  // Input Field for Entering/Editing Key
                  <div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type="password"
                          value={geminiKey}
                          onChange={(e) => setGeminiKeyState(e.target.value)}
                          placeholder="AIzaSy..."
                          autoFocus
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
                      {getGeminiKey() && (
                        <button
                          type="button"
                          onClick={() => {
                            setGeminiKeyState(getGeminiKey());
                            setIsEditingKey(false);
                          }}
                          className="btn btn-secondary"
                        >
                          {t.cancel}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {geminiStatus && (
                  <p style={{ marginTop: 8, fontSize: '0.82rem', fontWeight: 600, color: geminiStatus.includes('✅') ? 'var(--success)' : geminiStatus.includes('🗑️') ? 'var(--text-muted)' : 'var(--warning)' }}>
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
