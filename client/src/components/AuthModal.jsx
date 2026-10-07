import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import appLogo from '../assets/logo.svg';
import {
  Sparkles,
  ShieldCheck,
  UserCheck,
  KeyRound,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  Phone
} from 'lucide-react';

export default function AuthModal() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Live username verification state
  const [usernameStatus, setUsernameStatus] = useState({
    checking: false,
    available: null,
    message: '',
    suggestions: []
  });

  // Debounced username availability check on signup
  useEffect(() => {
    if (isLogin) {
      setUsernameStatus({ checking: false, available: null, message: '', suggestions: [] });
      return;
    }

    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      setUsernameStatus({ checking: false, available: null, message: '', suggestions: [] });
      return;
    }

    if (trimmed.length < 5) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Username must be at least 5 characters',
        suggestions: []
      });
      return;
    }

    setUsernameStatus(prev => ({ ...prev, checking: true }));

    const timer = setTimeout(async () => {
      try {
        const res = await authApi.checkUsername(trimmed);
        setUsernameStatus({
          checking: false,
          available: res.available,
          message: res.message || (res.available ? 'Username is available' : 'Username is already taken'),
          suggestions: res.suggestions || []
        });
      } catch {
        setUsernameStatus({
          checking: false,
          available: null,
          message: '',
          suggestions: []
        });
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [username, isLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        if (!identifier.trim() || !password) {
          throw new Error('Please enter username/email and password');
        }
        await login(identifier.trim(), password);
      } else {
        if (!username.trim() || !password) {
          throw new Error('Username and password are required');
        }
        if (username.trim().length < 5) {
          throw new Error('Username must be at least 5 characters');
        }
        if (usernameStatus.available === false) {
          throw new Error('Please choose an available username');
        }
        await register({
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
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

  return (
    <div className="modal-overlay" style={{ background: 'radial-gradient(circle at 50% 20%, rgba(99,102,241,0.2), #090a0f 85%)' }}>
      <div className="modal-content" style={{ maxWidth: 430, padding: '22px 26px', maxHeight: '92vh', borderRadius: 20 }}>
        {/* Logo and Tagline */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              marginBottom: 8
            }}
          >
            <img
              src={appLogo}
              alt="Logo"
              style={{ width: '100%', height: '100%', display: 'block' }}
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
              }}
            />
            <Sparkles size={26} color="#ffffff" style={{ display: 'none' }} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Tasker
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>
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
            marginBottom: 16
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
            Sign In
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
            Sign Up
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
                Username or Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. oliver_smith or oliver@domain.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                  required
                />
              </div>
            </div>
          ) : (
            <>
              {/* Username with Realtime Availability Check */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  <span>Username (Min 5 chars) *</span>
                  {usernameStatus.checking && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      <Loader2 size={12} className="spin" /> Checking...
                    </span>
                  )}
                  {!usernameStatus.checking && usernameStatus.available === true && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10B981', fontSize: '0.75rem', fontWeight: 700 }}>
                      <Check size={13} /> Available
                    </span>
                  )}
                  {!usernameStatus.checking && usernameStatus.available === false && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#EF4444', fontSize: '0.75rem', fontWeight: 700 }}>
                      <AlertCircle size={13} /> Taken
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="e.g. oliver_dev or arthur_smith"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '0.95rem',
                      borderColor: usernameStatus.available === true ? '#10B981' : (usernameStatus.available === false ? '#EF4444' : undefined)
                    }}
                    required
                  />
                </div>

                {/* Username Helper Message & Suggestions */}
                {usernameStatus.message && (
                  <p style={{
                    fontSize: '0.75rem',
                    marginTop: 4,
                    color: usernameStatus.available ? '#10B981' : '#EF4444'
                  }}>
                    {usernameStatus.message}
                  </p>
                )}

                {/* Clickable Username Suggestions */}
                {usernameStatus.suggestions && usernameStatus.suggestions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                      Suggestions:
                    </span>
                    {usernameStatus.suggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setUsername(sug)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: 'var(--primary)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        +{sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Oliver Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+880 1700 000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Password
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
            disabled={loading || (!isLogin && usernameStatus.available === false)}
            style={{ width: '100%', padding: '12px 16px', marginTop: 8, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {loading ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                <span>Connecting to Cloud...</span>
              </>
            ) : (
              <>
                <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
