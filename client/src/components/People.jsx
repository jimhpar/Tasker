import React, { useState, useEffect } from 'react';
import { peopleApi, teamApi, clientApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { playAlertChime, addNotification } from '../services/notificationService';
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Building2,
  BookUser,
  Trash2,
  Mail,
  Shield,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Plus,
  Tag,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function People() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  const [activePeopleTab, setActivePeopleTab] = useState('connected'); // 'connected' | 'requests'
  const [people, setPeople] = useState([]);
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [teams, setTeams] = useState([]);
  const [clients, setClients] = useState([]);

  // Search global users state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filter connected list
  const [filterQuery, setFilterQuery] = useState('');

  // Modals / Dropdowns
  const [activeTeamDropdownPersonId, setActiveTeamDropdownPersonId] = useState(null);
  const [activeClientDropdownPersonId, setActiveClientDropdownPersonId] = useState(null);

  // Manual Add Contact Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualUsername, setManualUsername] = useState('');
  const [manualRole, setManualRole] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  // Toast feedback
  const [toastMsg, setToastMsg] = useState({ text: '', type: 'info' });

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('tasker_people_updated', handleSync);
    window.addEventListener('tasker_connection_requests_updated', handleSync);
    const interval = setInterval(loadData, 2500); // 2.5s ultra-fast live sync for connection requests & network
    return () => {
      clearInterval(interval);
      window.removeEventListener('tasker_people_updated', handleSync);
      window.removeEventListener('tasker_connection_requests_updated', handleSync);
    };
  }, [user]);

  const showToast = (text, type = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: '', type: 'info' }), 4000);
  };

  const loadData = async () => {
    try {
      const [peopleList, teamsList, clientsList, reqs] = await Promise.all([
        peopleApi.getPeople(),
        teamApi.getTeams(),
        clientApi.getAll(),
        peopleApi.getConnectionRequests()
      ]);
      const myU = (user?.username || '').toLowerCase();
      const cleanPeople = (peopleList || []).filter(p => (p.username || '').toLowerCase() !== myU);
      setPeople(cleanPeople);
      setTeams(teamsList || []);
      setClients(clientsList || []);
      setConnectionRequests(reqs || []);
    } catch (err) {
      console.error('Error loading people data:', err);
    }
  };

  const handleGlobalSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    setSearchLoading(true);
    setHasSearched(true);
    try {
      const res = await teamApi.searchUsers(searchQuery);
      setSearchResults(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleConnectPerson = async (userObj) => {
    try {
      const res = await peopleApi.sendConnectionRequest(user, userObj);
      if (res.status === 'already_connected') {
        showToast(
          lang === 'bn' ? `@${userObj.username} ইতিমধ্যে আপনার কানেক্টেড তালিকায় আছেন!` : `@${userObj.username} is already connected!`,
          'info'
        );
      } else if (res.status === 'already_sent') {
        showToast(
          lang === 'bn' ? `@${userObj.username} এর কাছে ইতিমধ্যে রিকোয়েস্ট পাঠানো হয়েছে (পেন্ডিং)` : `Connection request already pending for @${userObj.username}`,
          'info'
        );
      } else {
        showToast(
          lang === 'bn'
            ? `📨 @${userObj.username} এর কাছে কানেকশন রিকোয়েস্ট পাঠানো হয়েছে! তিনি গ্রহণ করলে কানেক্ট হবে।`
            : `📨 Connection request sent to @${userObj.username}! Awaiting acceptance.`,
          'success'
        );
      }

      setSearchQuery('');
      setSearchResults([]);
      loadData();
    } catch (err) {
      showToast(`⚠️ ${err.message}`, 'danger');
    }
  };

  const handleAcceptRequest = async (requestId) => {
    // 0ms Optimistic UI Update: immediately reflect acceptance in UI
    const targetReq = connectionRequests.find(r => r._id === requestId);
    setConnectionRequests(prev => prev.filter(r => r._id !== requestId));
    if (targetReq) {
      setPeople(prev => {
        const uName = (targetReq.fromUsername || '').toLowerCase();
        if (prev.some(p => (p.username || '').toLowerCase() === uName)) return prev;
        return [
          {
            _id: 'p_' + uName,
            username: uName,
            fullName: targetReq.fromFullName || uName,
            bio: targetReq.fromBio || 'Collaborator',
            email: targetReq.fromEmail || `${uName}@tasker.app`,
            connectedAt: new Date().toISOString(),
            teams: [],
            clientTag: ''
          },
          ...prev
        ];
      });
    }

    try {
      const res = await peopleApi.acceptConnectionRequest(requestId);
      if (res.success) {
        playAlertChime();
        showToast(
          lang === 'bn' ? '🎉 কানেকশন রিকোয়েস্ট গ্রহণ করা হয়েছে!' : '🎉 Connection request accepted!',
          'success'
        );
        addNotification({
          title: lang === 'bn' ? '🤝 কানেকশন সম্পন্ন' : '🤝 Connection Established',
          message: lang === 'bn'
            ? `@${res.person?.fromUsername || targetReq?.fromUsername} এর সাথে সফলভাবে কানেক্ট হয়েছেন।`
            : `You are now connected with @${res.person?.fromUsername || targetReq?.fromUsername}.`
        });
        loadData();
      }
    } catch (err) {
      showToast(`⚠️ ${err.message}`, 'danger');
      loadData();
    }
  };

  const handleDeclineRequest = async (requestId) => {
    setConnectionRequests(prev => prev.filter(r => r._id !== requestId));
    try {
      await peopleApi.declineConnectionRequest(requestId);
      showToast(
        lang === 'bn' ? 'কানেকশন রিকোয়েস্ট বাতিল করা হয়েছে।' : 'Connection request declined.',
        'info'
      );
      loadData();
    } catch (err) {
      showToast(`⚠️ ${err.message}`, 'danger');
      loadData();
    }
  };

  const handleManualAddPerson = async (e) => {
    e.preventDefault();
    if (!manualName.trim() || !manualUsername.trim()) return;

    try {
      await peopleApi.addPerson({
        username: manualUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        fullName: manualName.trim(),
        bio: manualRole.trim() || 'Collaborator',
        email: manualEmail.trim()
      });

      showToast(
        lang === 'bn' ? 'নতুন ব্যক্তি সফলভাবে যুক্ত হয়েছেন!' : 'New person added to your network!',
        'success'
      );
      setShowManualModal(false);
      setManualName('');
      setManualUsername('');
      setManualRole('');
      setManualEmail('');
      loadData();
    } catch (err) {
      showToast(`⚠️ ${err.message}`, 'danger');
    }
  };

  const handleRemovePerson = async (personId, username) => {
    const confirmPrompt = lang === 'bn'
      ? `আপনি কি নিশ্চিত যে @${username} কে পিপল নেটওয়ার্ক থেকে বাদ দিতে চান?`
      : `Are you sure you want to remove @${username} from your People network?`;

    if (window.confirm(confirmPrompt)) {
      // 0ms Optimistic UI Update
      setPeople(prev => prev.filter(p => p._id !== personId && (p.username || '').toLowerCase() !== (username || '').toLowerCase()));
      try {
        await peopleApi.removePerson(username || personId);
        showToast(
          lang === 'bn' ? `@${username} কে তালিকা থেকে বাদ দেওয়া হয়েছে।` : `@${username} removed from your network.`,
          'info'
        );
        loadData();
      } catch (err) {
        showToast(`⚠️ ${err.message}`, 'danger');
        loadData();
      }
    }
  };

  const handleAssignToTeam = async (person, team) => {
    setActiveTeamDropdownPersonId(null);
    try {
      // 1. Send invite or add to team
      await teamApi.inviteUser(person.username, team._id);
      // 2. Update local people record
      await peopleApi.assignToTeam(person._id, team.name);

      showToast(
        lang === 'bn'
          ? `@${person.username} কে "${team.name}" টিমে যুক্ত করা হয়েছে!`
          : `@${person.username} added to team "${team.name}"!`,
        'success'
      );
      loadData();
    } catch (err) {
      showToast(`⚠️ ${err.message}`, 'danger');
    }
  };

  const handleTagToClient = async (person, client) => {
    setActiveClientDropdownPersonId(null);
    try {
      // 1. Update client dictionary contactPerson
      await clientApi.update(client._id, {
        contactPerson: person.fullName || person.username
      });
      // 2. Update local people record
      await peopleApi.tagToClient(person._id, client.name);

      showToast(
        lang === 'bn'
          ? `@${person.username} কে "${client.name}" এর Contact Person হিসেবে ট্যাগ করা হয়েছে!`
          : `@${person.username} tagged as Contact Person for "${client.name}"!`,
        'success'
      );
      loadData();
    } catch (err) {
      showToast(`⚠️ ${err.message}`, 'danger');
    }
  };

  const filteredPeople = people.filter(p => {
    const myU = (user?.username || '').toLowerCase();
    if ((p.username || '').toLowerCase() === myU) return false;

    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      (p.fullName && p.fullName.toLowerCase().includes(q)) ||
      (p.username && p.username.toLowerCase().includes(q)) ||
      (p.bio && p.bio.toLowerCase().includes(q)) ||
      (p.clientTag && p.clientTag.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>👥</span>
            <span>{t.peopleTitle || 'People & Connected Network'}</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t.peopleSubtitle || 'Search global users, connect, add to teams, or tag as Client Contact Person.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowManualModal(true)}
          className="btn btn-primary"
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)' }}
        >
          <Plus size={16} />
          <span>{lang === 'bn' ? '+ নতুন ব্যক্তি যোগ করুন' : '+ Add Person'}</span>
        </button>
      </div>

      {/* Toast Notification */}
      {toastMsg.text && (
        <div
          style={{
            background: toastMsg.type === 'danger' ? 'var(--danger-bg)' : toastMsg.type === 'success' ? 'var(--success-bg)' : 'var(--bg-input)',
            color: toastMsg.type === 'danger' ? 'var(--danger)' : toastMsg.type === 'success' ? 'var(--success)' : 'var(--text-main)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.86rem',
            fontWeight: 600,
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* People Section Switcher Tabs (Connected Network vs Connection Requests) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => setActivePeopleTab('connected')}
          className={activePeopleTab === 'connected' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ borderRadius: 'var(--radius-full)', padding: '7px 18px', fontSize: '0.85rem' }}
        >
          <Users size={16} />
          <span>{lang === 'bn' ? `কানেক্টেড নেটওয়ার্ক (${people.length})` : `Connected Network (${people.length})`}</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePeopleTab('requests')}
          className={activePeopleTab === 'requests' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ borderRadius: 'var(--radius-full)', padding: '7px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <UserPlus size={16} />
          <span>{lang === 'bn' ? 'কানেকশন রিকোয়েস্ট' : 'Connection Requests'}</span>
          {connectionRequests.length > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: 10,
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '1px 6px',
                minWidth: 18,
                textAlign: 'center'
              }}
            >
              {connectionRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* PENDING CONNECTION REQUESTS VIEW */}
      {activePeopleTab === 'requests' && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={18} color="var(--primary)" />
              <span>{lang === 'bn' ? 'আগত কানেকশন রিকোয়েস্ট' : 'Incoming Connection Requests'} ({connectionRequests.length})</span>
            </h3>
          </div>

          {connectionRequests.length === 0 ? (
            <div style={{ padding: '42px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <UserPlus size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>
                {lang === 'bn' ? 'কোনো নতুন কানেকশন রিকোয়েস্ট পেন্ডিং নেই' : 'No pending connection requests'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>
                {lang === 'bn' ? 'কেউ আপনাকে কানেকশন রিকোয়েস্ট পাঠালে এখানে এবং নোটিফিকেশনে দেখতে পাবেন।' : 'When someone sends you a connection request, you can accept or decline it here.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {connectionRequests.map((req) => (
                <div
                  key={req._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    flexWrap: 'wrap',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.1rem'
                      }}
                    >
                      {(req.fromFullName || req.fromUsername || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{req.fromFullName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        @{req.fromUsername} • {req.fromBio}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleAcceptRequest(req._id)}
                      className="btn btn-primary"
                      style={{ padding: '8px 18px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Check size={15} />
                      <span>{lang === 'bn' ? 'গ্রহণ করুন' : 'Accept'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineRequest(req._id)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <X size={15} />
                      <span>{lang === 'bn' ? 'প্রত্যাখ্যান' : 'Decline'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONNECTED COLLABORATORS & GLOBAL SEARCH (Visible on connected tab) */}
      {activePeopleTab === 'connected' && (
      <>
      {/* GLOBAL USER SEARCH CARD */}
      <div className="card" style={{ padding: 18 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>
          {lang === 'bn' ? 'গ্লোবাল ইউজার খুঁজুন ও কানেক্ট করুন' : 'Search & Connect Global Users'}
        </span>

        <form onSubmit={handleGlobalSearch} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) setSearchResults([]);
              }}
              placeholder={t.searchPeoplePlaceholder || 'Search global users by name or username to connect...'}
              style={{ width: '100%', padding: '10px 14px 10px 38px', fontSize: '0.88rem', borderRadius: 'var(--radius-md)' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={searchLoading} style={{ padding: '10px 18px', whiteSpace: 'nowrap' }}>
            <UserPlus size={16} />
            <span>{searchLoading ? (lang === 'bn' ? 'খোঁজা হচ্ছে...' : 'Searching...') : (lang === 'bn' ? 'খুঁজুন' : 'Search')}</span>
          </button>
        </form>

        {/* Search Results Drawer */}
        {hasSearched && !searchLoading && searchResults.length === 0 && (
          <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 10, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
            {lang === 'bn'
              ? `"${searchQuery}" দিয়ে কোনো ইউজার পাওয়া যায়নি। ('sunny', 'zim', বা 'admin' লিখে চেষ্টা করুন)`
              : `No users found matching "${searchQuery}". Try searching for 'sunny', 'zim', or 'admin'.`}
          </div>
        )}

        {searchResults.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {lang === 'bn' ? `সার্চ রেজাল্ট (${searchResults.length}):` : `Search Results (${searchResults.length}):`}
            </span>
            {searchResults.map((u) => {
              const isAlreadyConnected = people.some(p => (p.username || '').toLowerCase() === (u.username || '').toLowerCase());

              return (
                <div
                  key={u._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-input)',
                    borderRadius: 10,
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        flexShrink: 0
                      }}
                    >
                      {(u.profile?.fullName || u.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.profile?.fullName || u.username}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 6, fontWeight: 500 }}>
                          @{u.username}
                        </span>
                      </div>
                      {u.profile?.bio && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.profile.bio}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {isAlreadyConnected ? (
                      <span className="badge badge-done" style={{ fontSize: '0.75rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Check size={12} /> {lang === 'bn' ? 'কানেক্টেড' : 'Connected'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleConnectPerson(u)}
                        className="btn btn-primary"
                        style={{ fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <UserPlus size={14} /> {lang === 'bn' ? 'কানেক্ট করুন' : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONNECTED PEOPLE SECTION */}
      <div className="card" style={{ padding: 0, overflow: 'visible', position: 'relative' }}>
        {/* Section Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>
              {t.connectedPeopleTitle || 'Connected People'} ({people.length})
            </h3>
          </div>

          <div style={{ position: 'relative', width: 260 }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={lang === 'bn' ? 'কানেক্টেড ব্যক্তিবর্গ ফিল্টার...' : 'Filter connected people...'}
              style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
            />
          </div>
        </div>

        {/* People Card List */}
        {filteredPeople.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {t.noConnectedPeople || 'No connected people yet. Search above to add contacts!'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
            {filteredPeople.map((person, idx) => {
              const isTeamDropdownOpen = activeTeamDropdownPersonId === person._id;
              const isClientDropdownOpen = activeClientDropdownPersonId === person._id;

              return (
                <div
                  key={person._id || idx}
                  style={{
                    background: 'var(--bg-card, var(--bg-surface))',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: 'var(--shadow-xs)',
                    position: 'relative',
                    zIndex: (isTeamDropdownOpen || isClientDropdownOpen) ? 35 : 1
                  }}
                >
                  {/* Outside click backdrop for popovers */}
                  {(isTeamDropdownOpen || isClientDropdownOpen) && (
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 30 }}
                      onClick={() => {
                        setActiveTeamDropdownPersonId(null);
                        setActiveClientDropdownPersonId(null);
                      }}
                    />
                  )}

                  {/* Header Row: Avatar + Info + Delete Action Button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: 'var(--primary)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1rem',
                          flexShrink: 0
                        }}
                      >
                        {(person.fullName?.[0] || person.username?.[0] || 'P').toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {person.fullName || person.username}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>@{person.username}</span>
                          <span>•</span>
                          <span>{person.bio || 'Collaborator'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete / Disconnect Button - CLEARLY VISIBLE AND NEVER PUSHED OFF-SCREEN */}
                    <button
                      type="button"
                      onClick={() => handleRemovePerson(person._id, person.username)}
                      className="btn-ghost"
                      style={{
                        color: 'var(--danger, #ef4444)',
                        padding: '6px 10px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                      title={t.disconnectPerson || 'Remove / Disconnect'}
                    >
                      <Trash2 size={14} />
                      <span>{lang === 'bn' ? 'মুছুন' : 'Remove'}</span>
                    </button>
                  </div>

                  {/* Badges & Association Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                      paddingTop: 10,
                      borderTop: '1px dashed var(--border-subtle)',
                      fontSize: '0.8rem'
                    }}
                  >
                    {/* Team Association */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', zIndex: isTeamDropdownOpen ? 40 : 'auto', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {lang === 'bn' ? 'টিম:' : 'Team:'}
                      </span>
                      {person.teams && person.teams.length > 0 ? (
                        person.teams.map((tmName, tIdx) => (
                          <span key={tIdx} className="badge badge-todo" style={{ fontSize: '0.7rem' }}>
                            <Building2 size={11} /> {tmName}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActiveClientDropdownPersonId(null);
                          setActiveTeamDropdownPersonId(isTeamDropdownOpen ? null : person._id);
                        }}
                        className="btn-ghost"
                        style={{ padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, border: '1px dashed var(--border-subtle)' }}
                        title={lang === 'bn' ? 'টিমে যুক্ত করুন' : 'Add to Team'}
                      >
                        <Plus size={11} />
                        <span>{lang === 'bn' ? 'টিম' : 'Team'}</span>
                      </button>

                      {/* Team Picker Popover */}
                      {isTeamDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            zIndex: 100,
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
                            padding: 8,
                            minWidth: 190,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4
                          }}
                        >
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px' }}>
                            {lang === 'bn' ? 'টিম নির্বাচন করুন:' : 'Select Team:'}
                          </span>
                          {teams.map((tm) => (
                            <button
                              key={tm._id}
                              type="button"
                              onClick={() => {
                                handleAssignToTeam(person, tm);
                                setActiveTeamDropdownPersonId(null);
                              }}
                              className="btn-ghost"
                              style={{ textAlign: 'left', padding: '6px 8px', borderRadius: 6, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                              <Building2 size={13} color="var(--primary)" />
                              <span>{tm.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Client Tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', zIndex: isClientDropdownOpen ? 40 : 'auto', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {lang === 'bn' ? 'ক্লায়েন্ট:' : 'Client:'}
                      </span>
                      {person.clientTag ? (
                        <span className="badge badge-done" style={{ fontSize: '0.7rem' }}>
                          <BookUser size={11} /> {person.clientTag}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTeamDropdownPersonId(null);
                          setActiveClientDropdownPersonId(isClientDropdownOpen ? null : person._id);
                        }}
                        className="btn-ghost"
                        style={{ padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, border: '1px dashed var(--border-subtle)' }}
                        title={lang === 'bn' ? 'ক্লায়েন্টের Contact Person হিসেবে ট্যাগ করুন' : 'Tag as Client Contact Person'}
                      >
                        <Tag size={11} />
                        <span>{lang === 'bn' ? 'ট্যাগ' : 'Tag'}</span>
                      </button>

                      {/* Client Picker Popover */}
                      {isClientDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: 0,
                            zIndex: 100,
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
                            padding: 8,
                            minWidth: 210,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4
                          }}
                        >
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px' }}>
                            {lang === 'bn' ? 'ক্লায়েন্ট নির্বাচন করুন:' : 'Select Client:'}
                          </span>
                          {clients.length === 0 ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 8px' }}>
                              {lang === 'bn' ? 'কোনো ক্লায়েন্ট পাওয়া যায়নি' : 'No clients found'}
                            </span>
                          ) : (
                            clients.map((cl) => (
                              <button
                                key={cl._id}
                                type="button"
                                onClick={() => {
                                  handleTagToClient(person, cl);
                                  setActiveClientDropdownPersonId(null);
                                }}
                                className="btn-ghost"
                                style={{ textAlign: 'left', padding: '6px 8px', borderRadius: 6, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
                              >
                                <BookUser size={13} color="var(--primary)" />
                                <span>{cl.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* MANUAL ADD PERSON MODAL */}
      {showManualModal && (
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
                <Users size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {lang === 'bn' ? 'নতুন ব্যক্তি যুক্ত করুন' : 'Add Person to Network'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="btn-ghost"
                style={{ padding: 6, borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleManualAddPerson} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  {lang === 'bn' ? 'পূর্ণ নাম *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. John Doe, আরিফ আহমেদ"
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  {lang === 'bn' ? 'ইউজারনেম *' : 'Username *'}
                </label>
                <input
                  type="text"
                  required
                  value={manualUsername}
                  onChange={(e) => setManualUsername(e.target.value)}
                  placeholder="e.g. john_pm, arif_dev"
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  {lang === 'bn' ? 'রোল / পদবী' : 'Role / Bio'}
                </label>
                <input
                  type="text"
                  value={manualRole}
                  onChange={(e) => setManualRole(e.target.value)}
                  placeholder="e.g. Frontend Engineer, Farm Specialist"
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  {lang === 'bn' ? 'ইমেইল' : 'Email'}
                </label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="e.g. john@company.com"
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="btn btn-secondary"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!manualName.trim() || !manualUsername.trim()}
                  className="btn btn-primary"
                >
                  <Plus size={16} />
                  <span>{lang === 'bn' ? 'যুক্ত করুন' : 'Add Person'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
