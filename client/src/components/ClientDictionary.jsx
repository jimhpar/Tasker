import React, { useState, useEffect } from 'react';
import { clientApi, taskApi } from '../services/api';
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
  FileText
} from 'lucide-react';

export default function ClientDictionary({ onTasksUpdated }) {
  const { t, lang } = useLanguage();

  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientTasks, setClientTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await clientApi.getAll();
      setClients(data);
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

  const handleOpenModal = (clientToEdit = null) => {
    if (clientToEdit) {
      setEditingClient(clientToEdit);
      setName(clientToEdit.name);
      setContactPerson(clientToEdit.contactPerson || '');
      setEmail(clientToEdit.email || '');
      setPhone(clientToEdit.phone || '');
      setCompany(clientToEdit.company || '');
      setNotes(clientToEdit.notes || '');
    } else {
      setEditingClient(null);
      setName('');
      setContactPerson('');
      setEmail('');
      setPhone('');
      setCompany('');
      setNotes('');
    }
    setShowModal(true);
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
      setShowModal(false);
      loadClients();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteClient = async (clientId) => {
    const confirmMsg = lang === 'bn' ? 'আপনি কি এই ক্লায়েন্ট ডিলিট করতে চান?' : 'Are you sure you want to delete this client?';
    if (confirm(confirmMsg)) {
      try {
        await clientApi.delete(clientId);
        if (selectedClient?._id === clientId) setSelectedClient(null);
        loadClients();
      } catch (e) {
        console.error(e);
      }
    }
  };

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

        <button onClick={() => handleOpenModal()} className="btn btn-primary">
          <Plus size={18} /> {t.addClientBtn}
        </button>
      </div>

      {/* Main Grid: Client List on Left, Selected Client Details & Linked Tasks on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(340px, 1.4fr)', gap: 20 }}>
        {/* Client Roster List */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-muted)' }}>
            {t.clientListTitle} ({clients.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
            {clients.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: 20, textAlign: 'center' }}>
                {t.noClientsYet}
              </p>
            ) : (
              clients.map((client) => {
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
                        style={{ padding: 4 }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteClient(client._id); }}
                        className="btn-ghost"
                        style={{ padding: 4, color: 'var(--danger)' }}
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

        {/* Selected Client Profile & Linked Tasks */}
        <div className="card" style={{ padding: 20 }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {t.contactPersonLabel}
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Contact person"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem' }}
                  />
                </div>
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
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  {t.emailLabel}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@domain.com"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.9rem' }}
                />
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
    </div>
  );
}
