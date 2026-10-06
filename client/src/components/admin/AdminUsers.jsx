import React, { useState, useEffect } from 'react';
import { adminApi, getStoredUser } from '../../services/api';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Trash2,
  Edit2,
  X,
  Check,
  AlertCircle,
  Phone,
  Mail,
  Calendar,
  Layers,
  Crown
} from 'lucide-react';

const PLAN_COLORS = {
  free: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.3)' },
  pro: { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.3)' },
  business: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
  enterprise: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' }
};

export default function AdminUsers({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add User Form State
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'user',
    plan: 'free'
  });

  useEffect(() => {
    loadUsers();
    const handleUpdate = () => {
      loadUsers();
    };
    window.addEventListener('tasker_user_updated', handleUpdate);
    return () => window.removeEventListener('tasker_user_updated', handleUpdate);
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getUsers();
      setUsers(data || []);
    } catch (e) {
      console.error(e);
      // Fallback: Read current logged in user and local admin cache
      const stored = getStoredUser();
      const fallbackUser = {
        _id: stored?.id || stored?._id || currentUserId || 'u_admin',
        username: stored?.username || 'zim',
        email: stored?.email || 'zim@tasker.com',
        phone: stored?.phone || '+880 1700 000000',
        role: stored?.role || 'admin',
        plan: stored?.plan || 'enterprise',
        profile: { fullName: stored?.profile?.fullName || stored?.username || 'zim' },
        createdAt: stored?.createdAt || new Date().toISOString()
      };
      setUsers([fallbackUser]);
    } finally {
      setLoading(false);
    }
  };


  const handleCreateUser = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (formData.username.trim().length < 5) {
        throw new Error('Username must be at least 5 characters');
      }
      if (!formData.password || formData.password.length < 4) {
        throw new Error('Password must be at least 4 characters');
      }
      const created = await adminApi.createUser({
        username: formData.username.trim().toLowerCase(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        role: formData.role,
        plan: formData.plan
      });
      setUsers(prev => [created, ...prev]);
      setShowAddModal(false);
      setFormData({ username: '', fullName: '', email: '', phone: '', password: '', role: 'user', plan: 'free' });
      setSuccessMsg('User created successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const updated = await adminApi.updateUser(editingUser._id, {
        fullName: editingUser.profile?.fullName,
        email: editingUser.email,
        phone: editingUser.phone,
        role: editingUser.role,
        plan: editingUser.plan,
        newPassword: editingUser.newPassword || undefined
      });
      setUsers(prev => prev.map(u => (u._id === editingUser._id || u.username === editingUser.username) ? { ...u, ...updated, profile: { ...(u.profile || {}), fullName: editingUser.profile?.fullName || updated?.profile?.fullName || u.profile?.fullName } } : u));
      setEditingUser(null);
      setSuccessMsg('User updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update user');
    }
  };

  const handleQuickChangePlan = async (userId, newPlan) => {
    try {
      const updated = await adminApi.updateUser(userId, { plan: newPlan });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, plan: newPlan } : u));
      setSuccessMsg(`Plan changed to ${newPlan.toUpperCase()}!`);
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await adminApi.deleteUser(userToDelete._id);
      setUsers(prev => prev.filter(u => u._id !== userToDelete._id));
      setUserToDelete(null);
      setSuccessMsg('User deleted successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    const matchesSearch =
      u.username?.toLowerCase().includes(q) ||
      u.profile?.fullName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q);
    const matchesPlan = planFilter === 'all' || u.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                User Management
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Manage all registered accounts, roles, and subscription plans
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => { setFormData({ username: '', fullName: '', email: '', phone: '', password: '', role: 'user', plan: 'free' }); setShowAddModal(true); }}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 'var(--radius-md)' }}
        >
          <UserPlus size={16} />
          <span>Add New User</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 600 }}>
          <Check size={16} />
          {successMsg}
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Users</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{users.length}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Free Plan</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: '#9ca3af' }}>
            {users.filter(u => !u.plan || u.plan === 'free').length}
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Pro Plan</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: '#818cf8' }}>
            {users.filter(u => u.plan === 'pro').length}
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Business & Enterprise</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: '#34d399' }}>
            {users.filter(u => ['business', 'enterprise'].includes(u.plan)).length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by username, name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 14px 10px 40px', fontSize: '0.9rem', borderRadius: 'var(--radius-md)' }}
          />
        </div>

        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '0.9rem' }}
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 20px' }}>User Details</th>
                <th style={{ padding: '14px 16px' }}>Contact</th>
                <th style={{ padding: '14px 16px' }}>Role</th>
                <th style={{ padding: '14px 16px' }}>Subscription Plan</th>
                <th style={{ padding: '14px 16px' }}>Joined Date</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const planStyle = PLAN_COLORS[u.plan || 'free'] || PLAN_COLORS.free;
                  return (
                    <tr key={u._id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}>
                      {/* Name & Username */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.role === 'admin' ? 'var(--primary)' : 'var(--bg-input)', color: u.role === 'admin' ? 'var(--bg-app)' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                            {(u.profile?.fullName || u.username)?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                              {u.profile?.fullName || u.username}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {u.email ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Mail size={13} /> {u.email}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No email</span>
                          )}
                          {u.phone ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Phone size={13} /> {u.phone}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(156, 163, 175, 0.12)',
                          color: u.role === 'admin' ? '#ef4444' : 'var(--text-secondary)'
                        }}>
                          {u.role === 'admin' ? <Shield size={12} /> : null}
                          {u.role?.toUpperCase() || 'USER'}
                        </span>
                      </td>

                      {/* Subscription Plan with Quick Selector */}
                      <td style={{ padding: '14px 16px' }}>
                        <select
                          value={u.plan || 'free'}
                          onChange={(e) => handleQuickChangePlan(u._id, e.target.value)}
                          style={{
                            background: planStyle.bg,
                            color: planStyle.text,
                            border: `1px solid ${planStyle.border}`,
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro ($12/mo)</option>
                          <option value="business">Business ($29/mo)</option>
                          <option value="enterprise">Enterprise ($79/mo)</option>
                        </select>
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Calendar size={13} />
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setEditingUser({ ...u, newPassword: '' })}
                            className="btn-ghost"
                            style={{ padding: 6, borderRadius: 6 }}
                            title="Edit User"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            className="btn-ghost"
                            style={{ padding: 6, borderRadius: 6, color: '#ef4444' }}
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New User */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Add New User</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost" style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: 10, borderRadius: 8, fontSize: '0.85rem', marginBottom: 16 }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                  Username (Min 5 chars) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. arthur_dev"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Arthur Smith"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+880..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: 'var(--radius-md)' }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                    Subscription Plan
                  </label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: 'var(--radius-md)' }}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro ($12/mo)</option>
                    <option value="business">Business ($29/mo)</option>
                    <option value="enterprise">Enterprise ($79/mo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                  Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing User */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Edit User: @{editingUser.username}
              </h3>
              <button type="button" onClick={() => setEditingUser(null)} className="btn-ghost" style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: 10, borderRadius: 8, fontSize: '0.85rem', marginBottom: 16 }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={editingUser.profile?.fullName || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, profile: { ...editingUser.profile, fullName: e.target.value } })}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                    Role
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: 'var(--radius-md)' }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                    Subscription Plan
                  </label>
                  <select
                    value={editingUser.plan || 'free'}
                    onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: 'var(--radius-md)' }}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro ($12/mo)</option>
                    <option value="business">Business ($29/mo)</option>
                    <option value="enterprise">Enterprise ($79/mo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 5 }}>
                  Change Password (Leave empty to keep current)
                </label>
                <input
                  type="password"
                  placeholder="New password (optional)"
                  value={editingUser.newPassword || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, newPassword: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setEditingUser(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400, padding: 24, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 8 }}>
              Delete User @{userToDelete.username}?
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              This will permanently delete the user account and associated personal data.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setUserToDelete(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button type="button" onClick={handleDeleteUser} className="btn" style={{ flex: 1, background: '#ef4444', color: '#fff' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
