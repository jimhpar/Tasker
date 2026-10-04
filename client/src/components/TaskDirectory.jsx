import React, { useState, useEffect } from 'react';
import { taskTypeApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  FolderTree,
  Plus,
  Trash2,
  Edit2,
  Tag,
  Palette,
  X
} from 'lucide-react';

export default function TaskDirectory() {
  const { t, lang } = useLanguage();

  const [types, setTypes] = useState([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366F1');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    try {
      const data = await taskTypeApi.getAll();
      setTypes(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartEdit = (typeItem) => {
    setEditingId(typeItem._id);
    setName(typeItem.name);
    setColor(typeItem.color || '#6366F1');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setColor('#6366F1');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        category: 'General', // default internal grouping
        color
      };

      if (editingId) {
        await taskTypeApi.update(editingId, payload);
      } else {
        await taskTypeApi.create(payload);
      }

      handleCancelEdit();
      loadTypes();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmMsg = lang === 'bn' ? 'এই ক্যাটাগরিটি মুছে ফেলতে চান?' : 'Are you sure you want to delete this category?';
    if (confirm(confirmMsg)) {
      try {
        await taskTypeApi.delete(id);
        if (editingId === id) handleCancelEdit();
        loadTypes();
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>📁 {t.taskDirectoryTitle}</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {t.taskDirectorySubtitle}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(360px, 1.3fr)', gap: 20 }}>
        {/* Create / Edit Category Card */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            {editingId ? (
              <>
                <Edit2 size={18} color="var(--primary)" /> {t.editCategoryTitle}
              </>
            ) : (
              <>
                <Plus size={18} color="var(--primary)" /> {t.addCategoryTitle}
              </>
            )}
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Category / Task Type Name (Profession input completely removed!) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                {t.categoryNameLabel}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.categoryNamePlaceholder}
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
              />
            </div>

            {/* Color Tag */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                {t.colorTagLabel}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ width: 44, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent' }}
                />
                <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                  {color}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  <X size={15} /> {t.cancelEdit}
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ flex: editingId ? 1 : 'none' }}
              >
                {loading
                  ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                  : (editingId ? t.updateCategoryBtn : t.saveCategoryBtn)
                }
              </button>
            </div>
          </form>
        </div>

        {/* Existing Categories List */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 14 }}>
            {t.currentCategoriesTitle} ({types.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
            {types.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.noCategoriesYet}</p>
            ) : (
              types.map((typeItem) => {
                const isBeingEdited = editingId === typeItem._id;
                return (
                  <div
                    key={typeItem._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: isBeingEdited ? 'var(--primary-glow)' : 'var(--bg-input)',
                      border: isBeingEdited ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: typeItem.color || '#6366f1',
                          display: 'inline-block',
                          boxShadow: `0 0 8px ${typeItem.color || '#6366f1'}55`
                        }}
                      />
                      <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{typeItem.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(typeItem)}
                        className="btn-ghost"
                        style={{ padding: 6, color: 'var(--primary)' }}
                        title={lang === 'bn' ? 'ক্যাটাগরি এডিট করুন' : 'Edit Category'}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(typeItem._id)}
                        className="btn-ghost"
                        style={{ padding: 6, color: 'var(--danger)' }}
                        title={lang === 'bn' ? 'ক্যাটাগরি মুছুন' : 'Delete Category'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
