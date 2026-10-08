import React, { useState, useEffect } from 'react';
import { teamApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Trash2,
  UserMinus,
  Mail,
  ChevronLeft,
  Plus,
  Edit2,
  Building2,
  CheckCircle2,
  Circle,
  Tag,
  Calendar
} from 'lucide-react';

export default function MyTeam({ onRequestsUpdated, onOpenNewTask, onTasksUpdated, tasks }) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  // Multi-team state
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState(teamApi.getActiveTeamId());
  const [activeTeam, setActiveTeam] = useState(null);
  const [requests, setRequests] = useState([]);
  const [showRequestsView, setShowRequestsView] = useState(false);

  // Create Team Modal State
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [createTeamLoading, setCreateTeamLoading] = useState(false);

  // Edit Team Name State
  const [isEditingTeamName, setIsEditingTeamName] = useState(false);
  const [editTeamNameValue, setEditTeamNameValue] = useState('');

  // Search field above members list
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: 'info' });

  useEffect(() => {
    loadAllTeamsAndRequests();
  }, []);

  const showFeedback = (text, type = 'info') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg({ text: '', type: 'info' }), 4000);
  };

  const loadAllTeamsAndRequests = async (preferredTeamId) => {
    try {
      const [allTeams, reqData] = await Promise.all([
        teamApi.getTeams(),
        teamApi.getRequests()
      ]);

      setTeams(allTeams || []);
      const incomingList = reqData.incoming || [];
      setRequests(incomingList);
      if (onRequestsUpdated) onRequestsUpdated(incomingList.length);

      // Determine active team
      const currentId = preferredTeamId || activeTeamId || teamApi.getActiveTeamId();
      let selected = (allTeams || []).find(t => t._id === currentId);
      if (!selected && allTeams && allTeams.length > 0) {
        selected = allTeams[0];
      }

      if (selected) {
        setActiveTeamId(selected._id);
        teamApi.setActiveTeamId(selected._id);
        const detailed = await teamApi.getMembers(selected._id);
        setActiveTeam(detailed || selected);
      } else {
        setActiveTeam(null);
      }
    } catch (e) {
      console.error('Error loading team data:', e);
    }
  };

  const handleSelectTeam = async (teamId) => {
    setActiveTeamId(teamId);
    teamApi.setActiveTeamId(teamId);
    setIsEditingTeamName(false);
    try {
      const detailed = await teamApi.getMembers(teamId);
      setActiveTeam(detailed);
    } catch (e) {
      const local = teams.find(t => t._id === teamId);
      setActiveTeam(local);
    }
  };

  const handleCreateTeam = async (e) => {
    e?.preventDefault();
    if (!newTeamName.trim()) return;

    setCreateTeamLoading(true);
    try {
      const created = await teamApi.createTeam({ name: newTeamName.trim() });
      setShowCreateTeamModal(false);
      setNewTeamName('');
      showFeedback(
        lang === 'bn' ? `"${created.name}" টিম সফলভাবে তৈরি হয়েছে!` : `Team "${created.name}" created successfully!`,
        'success'
      );
      await loadAllTeamsAndRequests(created._id);
    } catch (err) {
      showFeedback(`⚠️ ${err.message}`, 'danger');
    } finally {
      setCreateTeamLoading(false);
    }
  };

  const handleUpdateTeamName = async () => {
    if (!editTeamNameValue.trim() || !activeTeam) return;
    try {
      await teamApi.updateTeam(activeTeam._id, { name: editTeamNameValue.trim() });
      setIsEditingTeamName(false);
      showFeedback(lang === 'bn' ? 'টিমের নাম পরিবর্তিত হয়েছে!' : 'Team name updated!', 'success');
      loadAllTeamsAndRequests(activeTeam._id);
    } catch (err) {
      showFeedback(`⚠️ ${err.message}`, 'danger');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    const isOwner = activeTeam?.ownerId === user?.username || activeTeam?.ownerId === user?.id || activeTeam?.ownerId === 'u_me';
    const confirmPrompt = isOwner
      ? (lang === 'bn' ? 'আপনি কি নিশ্চিত যে এই টিমটি সম্পূর্ণ মুছে ফেলতে চান?' : 'Are you sure you want to permanently delete this team?')
      : (lang === 'bn' ? 'আপনি কি নিশ্চিত যে এই টিমটি ত্যাগ করতে চান?' : 'Are you sure you want to leave this team?');

    if (window.confirm(confirmPrompt)) {
      try {
        await teamApi.deleteTeam(teamId);
        showFeedback(
          lang === 'bn' ? 'টিম সফলভাবে মোছা বা ত্যাগ করা হয়েছে!' : 'Team deleted/left successfully!',
          'success'
        );
        loadAllTeamsAndRequests();
      } catch (err) {
        showFeedback(`⚠️ ${err.message}`, 'danger');
      }
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await teamApi.searchUsers(searchQuery);
      setSearchResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInvite = async (targetUsername) => {
    if (!activeTeam) return;
    try {
      const res = await teamApi.inviteUser(targetUsername, activeTeam._id);
      showFeedback(
        res.message || `${lang === 'bn' ? 'ইনভাইট পাঠানো হয়েছে' : 'Invite sent to'} @${targetUsername}`,
        'success'
      );
      setSearchQuery('');
      setSearchResults([]);
      loadAllTeamsAndRequests(activeTeam._id);
    } catch (err) {
      showFeedback(`⚠️ ${err.message}`, 'danger');
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!activeTeam) return;
    const confirmMsg = lang === 'bn'
      ? 'আপনি কি এই সদস্যকে টিম থেকে বাদ দিতে চান?'
      : 'Are you sure you want to remove this member from the team?';

    if (window.confirm(confirmMsg)) {
      try {
        await teamApi.removeMember(memberUserId, activeTeam._id);
        showFeedback(lang === 'bn' ? 'সদস্যকে টিম থেকে বাদ দেওয়া হয়েছে!' : 'Member removed from team!', 'success');
        loadAllTeamsAndRequests(activeTeam._id);
      } catch (err) {
        showFeedback(`⚠️ ${err.message}`, 'danger');
      }
    }
  };

  // Reject or Accept Team Request
  const handleRespondRequest = async (requestId, action) => {
    // 1. Immediately update UI state so request disappears instantly
    setRequests(prev => {
      const updated = prev.filter(r => r.requestId !== requestId);
      if (onRequestsUpdated) onRequestsUpdated(updated.length);
      return updated;
    });

    showFeedback(
      action === 'reject'
        ? (lang === 'bn' ? 'ইনভাইটেশন বাতিল করা হয়েছে!' : 'Team invitation rejected!')
        : (lang === 'bn' ? 'ইনভাইটেশন গ্রহণ করা হয়েছে! টিমে যুক্ত হয়েছেন।' : 'Team invitation accepted!'),
      action === 'reject' ? 'warning' : 'success'
    );

    try {
      await teamApi.respondRequest(requestId, action);
      // Reload teams and requests to sync newly joined team
      await loadAllTeamsAndRequests();
    } catch (err) {
      console.error('Error responding to request:', err);
    }
  };

  const isOwnerOrAdmin = activeTeam?.ownerId === user?.username ||
    activeTeam?.ownerId === user?.id ||
    activeTeam?.ownerId === 'u_me' ||
    (activeTeam?.members || []).some(m => (m.userId?.username === user?.username || m.userId?._id === user?.id) && m.role === 'Admin');

  const teamTasks = (tasks || []).filter((taskItem) => {
    if (taskItem.workspaceType !== 'Team') return false;
    const tId = taskItem.teamId?._id || taskItem.teamId;
    return tId === activeTeam?._id;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header: Title, Multiple Teams Bar, Requests Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>👥</span>
            <span>{t.teamTitle || 'My Teams'}</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t.teamSubtitle}
          </p>
        </div>

        {/* Right side: Team Requests Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setShowCreateTeamModal(true)}
            className="btn btn-primary"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Plus size={16} />
            <span>{t.createTeamBtn || 'Create New Team'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRequestsView(!showRequestsView)}
            className={`btn ${showRequestsView ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-full)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {showRequestsView ? (
              <>
                <ChevronLeft size={16} /> {t.teamMembersTab || 'Team Members'}
              </>
            ) : (
              <>
                <Mail size={16} />
                <span>{t.teamRequestsTab || 'Team Requests'}</span>
                {requests.length > 0 && (
                  <span
                    style={{
                      background: 'var(--danger)',
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: 'var(--radius-full)',
                      marginLeft: 4
                    }}
                  >
                    {requests.length}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg.text && (
        <div
          style={{
            background: feedbackMsg.type === 'danger' ? 'var(--danger-bg)' : feedbackMsg.type === 'warning' ? 'var(--warning-bg)' : 'var(--primary-glow)',
            color: feedbackMsg.type === 'danger' ? 'var(--danger)' : feedbackMsg.type === 'warning' ? 'var(--warning)' : 'var(--primary)',
            padding: '10px 16px',
            borderRadius: 10,
            fontSize: '0.86rem',
            fontWeight: 600,
            border: '1px solid var(--border-focus)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* MULTIPLE TEAMS TABS BAR */}
      {!showRequestsView && teams.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 4,
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
            {lang === 'bn' ? 'আমার টিমসমূহ:' : 'My Teams:'}
          </span>

          {teams.map((tm) => {
            const isActive = tm._id === activeTeamId;
            const memberCount = tm.members ? tm.members.length : 1;

            return (
              <button
                key={tm._id}
                type="button"
                onClick={() => handleSelectTeam(tm._id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-full)',
                  background: isActive ? 'var(--active-btn-bg)' : 'var(--bg-card)',
                  color: isActive ? 'var(--active-btn-text)' : 'var(--text-main)',
                  border: isActive ? '1px solid var(--active-btn-bg)' : '1px solid var(--border-subtle)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none'
                }}
              >
                <Building2 size={15} color={isActive ? 'var(--active-btn-text)' : 'var(--text-main)'} />
                <span>{tm.name}</span>
                <span
                  style={{
                    background: isActive ? 'var(--active-btn-icon-bg)' : 'var(--bg-input)',
                    color: isActive ? 'var(--active-btn-text)' : 'var(--text-muted)',
                    fontSize: '0.72rem',
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700
                  }}
                >
                  {memberCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* VIEW 1: TEAM MEMBERS + INLINE SEARCH + ACTIVE TEAM INFO */}
      {!showRequestsView ? (
        teams.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--bg-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}
            >
              <Users size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 6 }}>
                {lang === 'bn' ? 'কোনো টিম তৈরি করা হয়নি' : 'No Teams Created Yet'}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: 420 }}>
                {lang === 'bn'
                  ? 'সহযোগিতা করার জন্য আপনার প্রথম টিম তৈরি করুন অথবা ইনভাইটেশনের জন্য অপেক্ষা করুন।'
                  : 'Create your first team to collaborate with teammates or check pending invitations.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewTeamName('');
                setShowCreateTeamModal(true);
              }}
              className="btn btn-primary"
              style={{
                padding: '10px 24px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 8
              }}
            >
              <Plus size={18} />
              <span>{lang === 'bn' ? 'নতুন টিম তৈরি করুন' : 'Create New Team'}</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active Team Summary Banner */}
          {activeTeam && (
            <div
              className="card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
                background: 'linear-gradient(135deg, var(--bg-card), var(--bg-surface))',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                  }}
                >
                  <Users size={22} color="var(--bg-app)" />
                </div>
                <div>
                  {isEditingTeamName ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text"
                        value={editTeamNameValue}
                        onChange={(e) => setEditTeamNameValue(e.target.value)}
                        placeholder="Team name"
                        style={{ padding: '4px 10px', fontSize: '0.9rem', borderRadius: 6 }}
                      />
                      <button onClick={handleUpdateTeamName} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                        <Check size={14} />
                      </button>
                      <button onClick={() => setIsEditingTeamName(false)} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.78rem' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{activeTeam.name}</h3>
                      {isOwnerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditTeamNameValue(activeTeam.name);
                            setIsEditingTeamName(true);
                          }}
                          className="btn-ghost"
                          style={{ padding: 4, borderRadius: 6, color: 'var(--text-muted)' }}
                          title={lang === 'bn' ? 'টিমের নাম পরিবর্তন করুন' : 'Rename Team'}
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {(activeTeam.members || []).length} {lang === 'bn' ? 'জন সক্রিয় সদস্য' : 'Active Members'} • {isOwnerOrAdmin ? (lang === 'bn' ? 'আপনি এডমিন/মালিক' : 'You are Admin') : (lang === 'bn' ? 'আপনি সাধারণ সদস্য' : 'You are Member')}
                  </p>
                </div>
              </div>

              {/* Active Team Right Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Delete / Leave Team Button */}
                <button
                  type="button"
                  onClick={() => handleDeleteTeam(activeTeam._id)}
                  className="btn btn-ghost"
                  style={{
                    color: 'var(--danger)',
                    fontSize: '0.78rem',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Trash2 size={14} />
                  <span>{isOwnerOrAdmin ? (t.deleteTeamConfirm ? (lang === 'bn' ? 'টিম মুছুন' : 'Delete Team') : 'Delete Team') : (lang === 'bn' ? 'টিম ত্যাগ করুন' : 'Leave Team')}</span>
                </button>
              </div>
            </div>
          )}

          {/* User Search Field directly above the members list */}
          <div className="card" style={{ padding: 16 }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value.trim()) setSearchResults([]);
                  }}
                  placeholder={
                    lang === 'bn'
                      ? `"${activeTeam?.name || 'টিমে'}" যুক্ত করার জন্য ইউজারনেম দিয়ে খুঁজুন...`
                      : `Search users to invite to "${activeTeam?.name || 'this team'}"...`
                  }
                  style={{ width: '100%', padding: '10px 14px 10px 38px', fontSize: '0.88rem', borderRadius: 'var(--radius-md)' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={searchLoading} style={{ padding: '10px 18px', whiteSpace: 'nowrap' }}>
                <UserPlus size={16} />
                {searchLoading ? t.searching : t.searchBtn}
              </button>
            </form>

            {/* Live Search Results Popup */}
            {searchResults.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {lang === 'bn' ? 'সার্চ রেজাল্ট:' : 'Search Results:'}
                </span>
                {searchResults.map((u) => (
                  <div
                    key={u._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      borderRadius: 10
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                        {u.profile?.fullName || u.username}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                        @{u.username}
                      </span>
                      {u.profile?.bio && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>{u.profile.bio}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInvite(u.username)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                    >
                      <UserPlus size={14} /> {t.addToTeamBtn}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {searchQuery && searchResults.length === 0 && !searchLoading && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 10 }}>{t.noUserFound}</p>
            )}
          </div>

          {/* Members List View */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1.5fr 1fr 140px 100px',
                padding: '14px 18px',
                background: 'var(--bg-input)',
                fontWeight: 700,
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-subtle)'
              }}
            >
              <div>#</div>
              <div>{lang === 'bn' ? 'সদস্যের নাম' : 'Member'}</div>
              <div>{lang === 'bn' ? 'ইউজারনেম' : 'Username'}</div>
              <div>{lang === 'bn' ? 'রোল (Role)' : 'Role'}</div>
              <div style={{ textAlign: 'right' }}>{t.actionsCol || 'Actions'}</div>
            </div>

            {/* Members Rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(activeTeam?.members || []).map((m, idx) => {
                const memberUser = m.userId || {};
                const isMe = memberUser.username === user?.username || memberUser._id === user?.id || memberUser.username === 'you';

                return (
                  <div
                    key={m._id || idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 1.5fr 1fr 140px 100px',
                      padding: '14px 18px',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: '0.88rem'
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--bg-app)',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}
                    >
                      {(memberUser.username?.[0] || 'U').toUpperCase()}
                    </div>

                    {/* Member Name */}
                    <div>
                      <span style={{ fontWeight: 700 }}>
                        {memberUser.profile?.fullName || memberUser.username || 'Member'}
                      </span>
                      {isMe && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 4, marginLeft: 8, fontWeight: 700 }}>
                          {lang === 'bn' ? 'আপনি' : 'You'}
                        </span>
                      )}
                    </div>

                    {/* Username */}
                    <div style={{ color: 'var(--text-muted)' }}>
                      @{memberUser.username}
                    </div>

                    {/* Role Badge */}
                    <div>
                      <span className={`badge ${m.role === 'Admin' ? 'badge-urgent' : 'badge-todo'}`}>
                        {m.role || 'Member'}
                      </span>
                    </div>

                    {/* Actions: Remove Member Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {!isMe && isOwnerOrAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(memberUser._id || m._id)}
                          className="btn btn-ghost"
                          style={{ color: 'var(--danger)', padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}
                          title={t.removeMember}
                        >
                          <UserMinus size={15} />
                          <span>{t.removeMember}</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )
      ) : (
        /* VIEW 2: TEAM REQUESTS VIEW */
        <div className="card" style={{ padding: 24, maxWidth: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {t.incomingRequestsTitle}
            </h3>
            <span className="badge badge-progress" style={{ fontSize: '0.72rem' }}>
              {requests.length} {lang === 'bn' ? 'পেন্ডিং' : 'Pending'}
            </span>
          </div>

          {requests.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              {t.noPendingRequests}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {requests.map((r) => (
                <div
                  key={r.requestId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    background: 'var(--bg-input)',
                    borderRadius: 12,
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <h4 style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {r.teamName || 'Workspace Team'}
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      @{r.fromUser?.username || 'Admin'} • {r.fromUser?.profile?.fullName || ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleRespondRequest(r.requestId, 'accept')}
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Check size={15} /> {t.accept}
                    </button>
                    <button
                      onClick={() => handleRespondRequest(r.requestId, 'reject')}
                      className="btn btn-danger"
                      style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <X size={15} /> {t.reject}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE NEW TEAM MODAL */}
      {showCreateTeamModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: 440,
              padding: 24,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {t.createTeamTitle || 'Create New Team'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTeamModal(false)}
                className="btn-ghost"
                style={{ padding: 6, borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  {t.teamNameLabel || 'Team Name'}
                </label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder={t.teamNamePlaceholder || 'e.g. Core Engineering, Farm Operations...'}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem', borderRadius: 'var(--radius-md)' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="btn btn-secondary"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={createTeamLoading || !newTeamName.trim()}
                  className="btn btn-primary"
                >
                  <Plus size={16} />
                  {createTeamLoading ? (lang === 'bn' ? 'তৈরি হচ্ছে...' : 'Creating...') : (t.createTeamBtn || 'Create Team')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
