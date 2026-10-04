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
  Clock,
  Shield,
  Trash2,
  UserMinus,
  Mail,
  ChevronLeft
} from 'lucide-react';

export default function MyTeam({ onRequestsUpdated }) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  const [team, setTeam] = useState(null);
  const [requests, setRequests] = useState([]);
  const [showRequestsView, setShowRequestsView] = useState(false);

  // Search field above members list
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    try {
      const [teamData, reqData] = await Promise.all([
        teamApi.getMembers(),
        teamApi.getRequests()
      ]);
      setTeam(teamData);
      setRequests(reqData.incoming || []);
      if (onRequestsUpdated) onRequestsUpdated((reqData.incoming || []).length);
    } catch (e) {
      console.error(e);
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
    try {
      const res = await teamApi.inviteUser(targetUsername);
      setInviteMsg(res.message || `${lang === 'bn' ? 'ইনভাইট পাঠানো হয়েছে' : 'Invite sent to'} @${targetUsername}`);
      setTimeout(() => setInviteMsg(''), 4000);
      setSearchQuery('');
      setSearchResults([]);
      loadTeamData();
    } catch (err) {
      setInviteMsg(`⚠️ ${err.message}`);
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    const confirmMsg = lang === 'bn' ? 'আপনি কি এই সদস্যকে টিম থেকে বাদ দিতে চান?' : 'Are you sure you want to remove this member from the team?';
    if (confirm(confirmMsg)) {
      try {
        await teamApi.removeMember(memberUserId);
        loadTeamData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleRespondRequest = async (requestId, action) => {
    try {
      await teamApi.respondRequest(requestId, action);
      loadTeamData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header: Title on Left, Team Requests Button on the RIGHT */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>👥 {t.teamTitle}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t.teamSubtitle}
          </p>
        </div>

        {/* Right side: Team Requests Button */}
        <div>
          <button
            type="button"
            onClick={() => setShowRequestsView(!showRequestsView)}
            className={`btn ${showRequestsView ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-full)',
              position: 'relative'
            }}
          >
            {showRequestsView ? (
              <>
                <ChevronLeft size={16} /> {t.teamMembersTab}
              </>
            ) : (
              <>
                <Mail size={16} /> {t.teamRequestsTab} ({requests.length})
                {requests.length > 0 && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--danger)',
                      display: 'inline-block',
                      marginLeft: 4
                    }}
                  />
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {inviteMsg && (
        <div style={{ background: 'var(--primary-glow)', color: 'var(--primary)', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', border: '1px solid var(--border-focus)' }}>
          {inviteMsg}
        </div>
      )}

      {/* VIEW 1: TEAM MEMBERS + INLINE SEARCH */}
      {!showRequestsView ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* User Search Field directly above the members list (as marked in Screenshot 5) */}
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
                  placeholder={t.searchMembersPlaceholder}
                  style={{ width: '100%', padding: '10px 14px 10px 38px', fontSize: '0.88rem', borderRadius: 'var(--radius-md)' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={searchLoading} style={{ padding: '10px 18px', whiteSpace: 'nowrap' }}>
                <UserPlus size={16} />
                {searchLoading ? t.searching : t.searchBtn}
              </button>
            </form>

            {/* Live Search Results Popup / Drawer if query is active */}
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

          {/* Members List View (member er list view thakbe) */}
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
              <div style={{ textAlign: 'right' }}>{t.actionsCol}</div>
            </div>

            {/* Members Rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(team?.members || []).map((m, idx) => {
                const memberUser = m.userId || {};
                const isMe = memberUser.username === user?.username || memberUser._id === user?.id;

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
                        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
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
                      {!isMe ? (
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
      ) : (
        /* VIEW 2: TEAM REQUESTS VIEW */
        <div className="card" style={{ padding: 24, maxWidth: 640 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
            {t.incomingRequestsTitle}
          </h3>
          {requests.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
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
                    padding: 14,
                    background: 'var(--bg-input)',
                    borderRadius: 12,
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <h4 style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {r.teamName || 'Workspace Team'}
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      @{r.fromUser?.username || 'Admin'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleRespondRequest(r.requestId, 'accept')}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      <Check size={15} /> {t.accept}
                    </button>
                    <button
                      onClick={() => handleRespondRequest(r.requestId, 'reject')}
                      className="btn btn-danger"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
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
    </div>
  );
}
