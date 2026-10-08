import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import {
  Layers,
  Save,
  Check,
  Users,
  Bot,
  Globe,
  BookOpen,
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

const DEFAULT_PLANS_STATE = [
  {
    planId: 'free',
    name: 'Free',
    price: '$0/mo',
    description: 'Basic daily productivity and personal tracking',
    teamAccess: true,
    maxTeamMembers: 100,
    aiChatAccess: true,
    communityChatAccess: true,
    clientDictionaryAccess: true
  },
  {
    planId: 'pro',
    name: 'Pro',
    price: '$12/mo',
    description: 'For growing professionals & boutique teams',
    teamAccess: true,
    maxTeamMembers: 10,
    aiChatAccess: true,
    communityChatAccess: true,
    clientDictionaryAccess: true
  },
  {
    planId: 'business',
    name: 'Business',
    price: '$29/mo',
    description: 'For collaborative companies & multi-team management',
    teamAccess: true,
    maxTeamMembers: 50,
    aiChatAccess: true,
    communityChatAccess: true,
    clientDictionaryAccess: true
  },
  {
    planId: 'enterprise',
    name: 'Enterprise',
    price: '$79/mo',
    description: 'Unlimited capacity, enterprise scale & dedicated speed',
    teamAccess: true,
    maxTeamMembers: 200,
    aiChatAccess: true,
    communityChatAccess: true,
    clientDictionaryAccess: true
  }
];

export default function AdminPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPlans();
      if (data && data.length > 0) {
        setPlans(data);
      } else {
        setPlans(DEFAULT_PLANS_STATE);
      }
    } catch {
      setPlans(DEFAULT_PLANS_STATE);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (planId, field, value) => {
    setPlans(prev =>
      prev.map(p => (p.planId === planId ? { ...p, [field]: value } : p))
    );
  };

  const handleSaveAllPlans = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      await adminApi.updatePlans(plans);
      setSuccessMsg('SaaS Plans and Feature Access successfully updated!');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update plans');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary)', color: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                Manage SaaS Plans & Features
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Control feature access matrix, team limits, and pricing for Free, Pro, Business & Enterprise
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveAllPlans}
          className="btn btn-primary"
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}
        >
          <Save size={16} />
          <span>{saving ? 'Saving...' : 'Save Plan Settings'}</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px 18px', borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 600 }}>
          <Check size={18} />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px 18px', borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 600 }}>
          <AlertCircle size={18} />
          {errorMsg}
        </div>
      )}

      {/* Grid of 4 Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        {plans.map((plan) => {
          const isFree = plan.planId === 'free';
          const isPro = plan.planId === 'pro';
          const isBiz = plan.planId === 'business';
          const isEnt = plan.planId === 'enterprise';

          const accentColor = isFree ? '#9ca3af' : (isPro ? '#818cf8' : (isBiz ? '#10B981' : '#f59e0b'));

          return (
            <div
              key={plan.planId}
              className="card"
              style={{
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                borderTop: `4px solid ${accentColor}`,
                position: 'relative'
              }}
            >
              {/* Plan Title & Price */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, textTransform: 'capitalize' }}>
                    {plan.name}
                  </h3>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-input)', color: accentColor, textTransform: 'uppercase' }}>
                    {plan.planId}
                  </span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    value={plan.price || ''}
                    onChange={(e) => handleFieldChange(plan.planId, 'price', e.target.value)}
                    placeholder="e.g. $12/mo"
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      padding: '4px 8px',
                      borderRadius: 6,
                      width: '100%',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Description
                </label>
                <textarea
                  rows={2}
                  value={plan.description || ''}
                  onChange={(e) => handleFieldChange(plan.planId, 'description', e.target.value)}
                  style={{ width: '100%', fontSize: '0.8rem', padding: '6px 10px', resize: 'none' }}
                />
              </div>

              {/* Feature Matrix / Access Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Feature Privileges
                </div>

                {/* Team Access Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={16} color="var(--primary)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Team Access</span>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 42, height: 22 }}>
                    <input
                      type="checkbox"
                      checked={!!plan.teamAccess}
                      onChange={(e) => handleFieldChange(plan.planId, 'teamAccess', e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      background: plan.teamAccess ? 'var(--primary)' : 'var(--bg-input)',
                      borderRadius: 22, transition: '0.2s'
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: 16, width: 16, left: plan.teamAccess ? 22 : 3, bottom: 3,
                        background: '#ffffff', borderRadius: '50%', transition: '0.2s'
                      }} />
                    </span>
                  </label>
                </div>

                {/* Team Member Limit */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Max Team Members</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: accentColor }}>
                      {plan.maxTeamMembers} Members
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={plan.maxTeamMembers || 10}
                    onChange={(e) => handleFieldChange(plan.planId, 'maxTeamMembers', parseInt(e.target.value) || 1)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
                  />
                </div>

                {/* AI Reasoning / Gemini Chat */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bot size={16} color="var(--primary)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>AI Chat (Gemini)</span>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 42, height: 22 }}>
                    <input
                      type="checkbox"
                      checked={!!plan.aiChatAccess}
                      onChange={(e) => handleFieldChange(plan.planId, 'aiChatAccess', e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      background: plan.aiChatAccess ? 'var(--primary)' : 'var(--bg-input)',
                      borderRadius: 22, transition: '0.2s'
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: 16, width: 16, left: plan.aiChatAccess ? 22 : 3, bottom: 3,
                        background: '#ffffff', borderRadius: '50%', transition: '0.2s'
                      }} />
                    </span>
                  </label>
                </div>

                {/* Community Chat Access */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={16} color="var(--primary)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Community Chat</span>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 42, height: 22 }}>
                    <input
                      type="checkbox"
                      checked={!!plan.communityChatAccess}
                      onChange={(e) => handleFieldChange(plan.planId, 'communityChatAccess', e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      background: plan.communityChatAccess ? 'var(--primary)' : 'var(--bg-input)',
                      borderRadius: 22, transition: '0.2s'
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: 16, width: 16, left: plan.communityChatAccess ? 22 : 3, bottom: 3,
                        background: '#ffffff', borderRadius: '50%', transition: '0.2s'
                      }} />
                    </span>
                  </label>
                </div>

                {/* Client Dictionary Access */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={16} color="var(--primary)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Client Directory</span>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 42, height: 22 }}>
                    <input
                      type="checkbox"
                      checked={!!plan.clientDictionaryAccess}
                      onChange={(e) => handleFieldChange(plan.planId, 'clientDictionaryAccess', e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      background: plan.clientDictionaryAccess ? 'var(--primary)' : 'var(--bg-input)',
                      borderRadius: 22, transition: '0.2s'
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: 16, width: 16, left: plan.clientDictionaryAccess ? 22 : 3, bottom: 3,
                        background: '#ffffff', borderRadius: '50%', transition: '0.2s'
                      }} />
                    </span>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
