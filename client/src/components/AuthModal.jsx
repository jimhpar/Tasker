import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ShieldCheck, UserCheck, KeyRound, ArrowRight } from 'lucide-react';

export default function AuthModal() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        if (!identifier.trim() || !password) {
          throw new Error('দয়া করে ইউজারনেম/ইমেইল এবং পাসওয়ার্ড দিন');
        }
        await login(identifier.trim(), password);
      } else {
        if (!username.trim() || !password) {
          throw new Error('ইউজারনেম এবং পাসওয়ার্ড আবশ্যক');
        }
        await register({
          username: username.trim(),
          email: email.trim(),
          fullName: fullName.trim(),
          password
        });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // One-click quick demo login for testing
  const handleQuickDemo = async (role = 'Tech Founder') => {
    setLoading(true);
    try {
      const demoUser = role === 'Farmer' ? 'rahim_farm' : 'zim_founder';
      await login(demoUser, '123456');
    } catch {
      // Handled by api fallback
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ background: 'radial-gradient(circle at 50% 20%, rgba(99,102,241,0.2), #090a0f 85%)' }}>
      <div className="modal-content" style={{ maxWidth: 440, padding: 32 }}>
        {/* Logo and Tagline */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
              marginBottom: 12
            }}
          >
            <Sparkles size={28} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Tasker
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            Universal AI-Powered Workflow & Scheduling Suite
          </p>
        </div>

        {/* Tab Switcher (Login / Signup) */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-input)',
            padding: 4,
            borderRadius: 12,
            marginBottom: 20
          }}
        >
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.9rem',
              color: isLogin ? '#ffffff' : 'var(--text-secondary)',
              background: isLogin ? 'var(--primary)' : 'transparent',
              boxShadow: isLogin ? '0 2px 8px var(--primary-glow)' : 'none'
            }}
          >
            লগইন (Sign In)
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.9rem',
              color: !isLogin ? '#ffffff' : 'var(--text-secondary)',
              background: !isLogin ? 'var(--primary)' : 'transparent',
              boxShadow: !isLogin ? '0 2px 8px var(--primary-glow)' : 'none'
            }}
          >
            নতুন একাউন্ট (Sign Up)
          </button>
        </div>

        {error && (
          <div
            style={{
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: '0.85rem',
              marginBottom: 16,
              border: '1px solid rgba(239,68,68,0.2)'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isLogin ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                ইউজারনেম অথবা ইমেইল (Username or Email)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. zim_founder or email@domain.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                  required
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  ইউজারনেম (Username - শুধু নাম দিয়েও চলবে) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. zim_dev or rahim_agro"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  আপনার পুরো নাম (Full Name)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Zim Chowdhury"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  ইমেইল (ঐচ্ছিক / Optional)
                </label>
                <input
                  type="email"
                  placeholder="you@example.com (ইচ্ছা হলে দিতে পারেন)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
              পাসওয়ার্ড (Password)
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px 16px', marginTop: 8, fontSize: '1rem' }}
          >
            {loading ? 'প্রসেসিং হচ্ছে...' : (isLogin ? 'সফটওয়্যারে প্রবেশ করুন' : 'একাউন্ট তৈরি করুন')}
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Quick Demo Access Tiers */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            ⚡ টেস্ট করার জন্য এক ক্লিকে ডেমো লগইন করুন:
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => handleQuickDemo('Tech Founder')}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              💻 Tech Founder Mode
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('Farmer')}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              🌾 Agro / Farmer Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
