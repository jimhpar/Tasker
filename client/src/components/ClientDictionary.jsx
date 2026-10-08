import React, { useState, useEffect } from 'react';
import { clientApi, taskApi, peopleApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  BookUser,
  Plus,
  Building,
  Mail,
  Phone,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  X,
  FileText,
  UserPlus,
  Search,
  User
} from 'lucide-react';

export default function ClientDictionary({ onTasksUpdated }) {
  const { t, lang } = useLanguage();

  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientTasks, setClientTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [connectedPeople, setConnectedPeople] = useState([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');

  // "Add From People" State
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [taggedPerson, setTaggedPerson] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const [data, peopleData] = await Promise.all([
        clientApi.getAll(),
        peopleApi.getPeople()
      ]);
      setClients(data);
      setConnectedPeople(peopleData || []);
      if (data.length > 0 && !selectedClient) {
        handleSelectClient(data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectClient = async (client) => {
    setSelectedClient(client);
    setLoadingTasks(true);
    try {
      const allTasks = await taskApi.getAll();
      const matched = allTasks.filter(
        item => item.clientId?._id === client._id || item.clientId === client._id
      );
      setClientTasks(matched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleOpenModal = async (clientToEdit = null) => {
    setShowPeoplePicker(false);
    setPeopleSearch('');

    let currentPeople = connectedPeople;
    try {
      const pData = await peopleApi.getPeople();
      if (pData) {
        setConnectedPeople(pData);
        currentPeople = pData;
      }
    } catch {}

    if (clientToEdit) {
      setEditingClient(clientToEdit);
      setName(clientToEdit.name);
      setContactPerson(clientToEdit.contactPerson || '');
      setEmail(clientToEdit.email || '');
      setPhone(clientToEdit.phone || '');
      setCompany(clientToEdit.company || '');
      setNotes(clientToEdit.notes || '');

      const matched = (currentPeople || []).find(
        p => (p.fullName && p.fullName === clientToEdit.contactPerson) ||
             (p.username && p.username === clientToEdit.contactPerson)
      );
      setTaggedPerson(matched || null);
    } else {
      setEditingClient(null);
      setName('');
      setContactPerson('');
      setEmail('');
      setPhone('');
      setCompany('');
      setNotes('');
      setTaggedPerson(null);
    }
    setShowModal(true);
  };

  const handleSelectPerson = (person) => {
    setTaggedPerson(person);
    setContactPerson(person.fullName || person.username);
    if (person.email && !email) setEmail(person.email);
    if (person.phone && !phone) setPhone(person.phone);
    setShowPeoplePicker(false);
    setPeopleSearch('');
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      company: company.trim(),
      notes: notes.trim()
    };

    try {
      if (editingClient) {
        await clientApi.update(editingClient._id, payload);
      } else {
        await clientApi.create(payload);
      }

      // Tag the selected person from People to this client
      if (taggedPerson) {
        await peopleApi.tagToClient(taggedPerson._id, name.trim());
      }

      setShowModal(false);
      loadClients();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteClient = (clientItem) => {
    // In-app modal confirmation
    setClientToDelete(clientItem);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    const clientId = clientToDelete._id;
    setClientToDelete(null);

    // Instant optimistic removal
    setClients(prev => prev.filter(c => c._id !== clientId));
    if (selectedClient?._id === clientId) setSelectedClient(null);

    try {
      await clientApi.delete(clientId);
    } catch (e) {
      console.error(e);
      loadClients();
    }
  };

  const filteredPeople = connectedPeople.filter((p) => {
    if (!peopleSearch.trim()) return true;
    const q = peopleSearch.toLowerCase();
    return (
      (p.fullName && p.fullName.toLowerCase().includes(q)) ||
      (p.username && p.username.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.bio && p.bio.toLowerCase().includes(q))
    );
  });

  const filteredClients = clients.filter((c) => {
    if (!clientSearchQuery.trim()) return true;
    const q = clientSearchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>📇 {t.clientDictionaryTitle}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t.clientDictionarySubtitle}
          </p>
        </div>
      </div>

      {/* Main Grid: On Mobile: Selected Client Top, Roster Below. On Desktop: Roster Left, Details Right */}
      <div className="client-dictionary-responsive-grid" style={{ display: 'grid', gap: 20 }}>
        {/* Client Roster List Card */}
        <div className="card client-roster-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {t.clientListTitle} ({filteredClients.length})
            </h3>
            <button
              onClick={() => handleOpenModal()}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Plus size={14} /> {t.addClientBtn}
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={lang === 'bn' ? 'ক্লায়েন্ট বা কোম্পানির নাম খুঁজুন...' : 'Search client, company, person...'}
              value={clientSearchQuery}
              onChange={(e) => setClientSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 32px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
            {filteredClients.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: 20, textAlign: 'center' }}>
                {clientSearchQuery ? (lang === 'bn' ? 'কোন ক্লায়েন্ট পাওয়া যায়নি' : 'No clients found') : t.noClientsYet}
              </p>
            ) : (
              filteredClients.map((client) => {
                const isSelected = selectedClient?._id === client._id;
                return (
                  <div
                    key={client._id}
                    onClick={() => handleSelectClient(client)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: isSelected ? 'var(--primary-glow)' : 'var(--bg-input)',
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div>
                      <h4 style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                        {client.name}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {client.company || client.contactPerson || (lang === 'bn' ? 'ব্যক্তিগত ক্লায়েন্ট' : 'Direct Client')}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(client); }}
                        className="btn-ghost"
                        style={{ padding: 6, borderRadius: 6 }}
                        title="Edit client info"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteClient(client); }}
                        className="btn-ghost"
                        style={{ padding: 6, borderRadius: 6, color: 'var(--danger)' }}
                        title="Delete client"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Client Profile & Linked Tasks Card */}
        <div className="card client-details-card" style={{ padding: 20 }}>
          {selectedClient ? (
            <div>
              {/* Client Info Header */}
              <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{selectedClient.name}</h3>
                  <span className="badge badge-todo">{selectedClient.company || 'Direct'}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {selectedClient.contactPerson && (
                    <div>{t.clientContact} <strong>{selectedClient.contactPerson}</strong></div>
                  )}
                  {selectedClient.phone && (
                    <div>{t.clientPhone} <strong>{selectedClient.phone}</strong></div>
                  )}
                  {selectedClient.email && (
                    <div>{t.clientEmail} <strong>{selectedClient.email}</strong></div>
                  )}
                </div>

                {selectedClient.notes && (
                  <p style={{ fontSize: '0.8rem', background: 'var(--bg-input)', padding: 8, borderRadius: 8, marginTop: 10, color: 'var(--text-muted)' }}>
                    {t.clientNotes} {selectedClient.notes}
                  </p>
                )}
              </div>

              {/* Linked Tasks */}
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} color="var(--primary)" />
                {t.clientTasksTitle} ({clientTasks.length})
              </h4>

              {loadingTasks ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>...</p>
              ) : clientTasks.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>
                  {t.noTasksForClient}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                  {clientTasks.map((taskItem) => (
                    <div
                      key={taskItem._id}
                      style={{
                        padding: 10,
                        background: 'var(--bg-input)',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {taskItem.status === 'Done' ? <CheckCircle2 size={16} color="var(--success)" /> : <Circle size={16} color="var(--text-muted)" />}
                        <span style={{ fontWeight: 600, textDecoration: taskItem.status === 'Done' ? 'line-through' : 'none' }}>
                          {taskItem.title}
                        </span>
                      </div>
                      <span className={`badge ${taskItem.status === 'Done' ? 'badge-done' : taskItem.status === 'In Progress' ? 'badge-progress' : 'badge-todo'}`}>
                        {taskItem.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
              {lang === 'bn' ? 'বাম পাশের তালিকা থেকে ক্লায়েন্ট নির্বাচন করুন।' : 'Select a client from the left roster.'}
            </p>
          )}
        </div>
      </div>

      {/* Add / Edit Client Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {editingClient ? t.editClientTitle : t.addClientBtn}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: 4, borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveClient} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  {t.clientNameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  {t.clientCompanyLabel}
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company name"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.9rem' }}
                />
              </div>

              {/* Contact Person Section with "Add From People" button */}
              <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={15} color="var(--primary)" />
                    {t.contactPersonLabel || 'Contact Person'}
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPeoplePicker(!showPeoplePicker);
                      setPeopleSearch('');
                    }}
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      borderRadius: 6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 700,
                      background: showPeoplePicker ? 'var(--active-btn-bg)' : 'var(--bg-card)',
                      color: showPeoplePicker ? 'var(--active-btn-text)' : 'var(--text-main)',
                      borderColor: 'var(--border-subtle)'
                    }}
                  >
                    <UserPlus size={13} color={showPeoplePicker ? 'var(--active-btn-text)' : 'var(--primary)'} />
                    <span>{showPeoplePicker ? (lang === 'bn' ? 'সার্চ বন্ধ করুন' : 'Close Search') : 'Add From People'}</span>
                  </button>
                </div>

                {/* People Search Panel */}
                {showPeoplePicker && (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: 10,
                      borderRadius: 8,
                      background: 'var(--bg-card)',
                      border: '1.5px solid var(--primary)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        autoFocus
                        value={peopleSearch}
                        onChange={(e) => setPeopleSearch(e.target.value)}
                        placeholder={lang === 'bn' ? 'নাম, ইউজারনেম বা ইমেইল দিয়ে খুঁজুন...' : 'Search contacts by name, username or email...'}
                        style={{ width: '100%', padding: '6px 10px 6px 32px', fontSize: '0.82rem', borderRadius: 6 }}
                      />
                    </div>

                    <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {filteredPeople.length === 0 ? (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0', margin: 0 }}>
                          {connectedPeople.length === 0
                            ? (lang === 'bn' ? 'পিপল সেকশনে কোনো কন্টাক্ট পাওয়া যায়নি।' : 'No contacts in People yet.')
                            : (lang === 'bn' ? 'কোনো কন্টাক্ট মেলেনি।' : 'No matching contact found.')}
                        </p>
                      ) : (
                        filteredPeople.map((person) => (
                          <div
                            key={person._id}
                            onClick={() => handleSelectPerson(person)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: 6,
                              background: taggedPerson?._id === person._id ? 'var(--primary-glow)' : 'var(--bg-input)',
                              cursor: 'pointer',
                              border: taggedPerson?._id === person._id ? '1px solid var(--primary)' : '1px solid transparent',
                              transition: 'all 0.12s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  background: 'var(--primary)',
                                  color: 'var(--bg-app)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.72rem',
                                  fontWeight: 700
                                }}
                              >
                                {(person.fullName?.[0] || person.username?.[0] || 'U').toUpperCase()}
                              </div>
                              <div>
                                <p style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>
                                  {person.fullName || person.username}
                                </p>
                                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0 }}>
                                  @{person.username} {person.email ? `• ${person.email}` : ''}
                                </p>
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: taggedPerson?._id === person._id ? 'var(--primary)' : 'var(--bg-card)',
                                color: taggedPerson?._id === person._id ? '#ffffff' : 'var(--text-main)',
                                border: '1px solid var(--border-subtle)'
                              }}
                            >
                              {taggedPerson?._id === person._id ? 'Selected' : 'Assign'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tagged Badge Indicator */}
                {taggedPerson && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 10px',
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid var(--primary)',
                      borderRadius: 6,
                      marginBottom: 8,
                      fontSize: '0.75rem'
                    }}
                  >
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      ✓ Tagged: <strong>{taggedPerson.fullName || taggedPerson.username}</strong> (@{taggedPerson.username})
                    </span>
                    <button
                      type="button"
                      onClick={() => setTaggedPerson(null)}
                      className="btn-ghost"
                      style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}
                      title="Clear tag"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => {
                    setContactPerson(e.target.value);
                    if (taggedPerson && e.target.value !== (taggedPerson.fullName || taggedPerson.username)) {
                      setTaggedPerson(null);
                    }
                  }}
                  placeholder="e.g. Alex Rivera or click 'Add From People'"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.88rem', borderRadius: 6 }}
                />
              </div>

              {/* Phone & Email side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {t.phoneLabel}
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {t.emailLabel}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@domain.com"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  {t.notesLabel}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="..."
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">{t.cancel}</button>
                <button type="submit" className="btn btn-primary">{t.saveClientBtn}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-app Delete Client Confirmation Modal */}
      {clientToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: 380, padding: 24, textAlign: 'center' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}
            >
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>
              {lang === 'bn' ? 'ক্লায়েন্ট মুছে ফেলবেন?' : 'Delete Client?'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              {lang === 'bn'
                ? `আপনি কি নিশ্চিত যে "${clientToDelete.name}" ক্লায়েন্টটি মুছে ফেলতে চান?`
                : `Are you sure you want to delete "${clientToDelete.name}"?`}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDeleteClient}
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                {lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
