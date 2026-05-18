import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit3, X, Search } from 'lucide-react';
import api from '../services/api';

function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }

const EMOJI_CATEGORIES = {
  '💰 Finans': ['💰','💵','💴','💶','💷','💸','💳','💎','🏦','📈','📉','📊','🧾','🪙','💹','🏧','💱','💲','🧈','🟡','⚪','🥇','🥈','🥉','🧱'],
  '🍽️ Yeme & İçme': ['🍽️','🍔','🍕','🍝','🍜','🍣','🍰','🍩','🍦','🍫','🍿','☕','🍺','🍷','🥤','🧁','🥗','🌮','🥘','🍱'],
  '🛒 Alışveriş': ['🛒','🛍️','🏪','🏬','🎁','📦','🧴','🧹','🧺','🧻','🧽','🧼'],
  '🚗 Ulaşım': ['🚗','🚕','🚌','🚇','🚆','🚂','✈️','🚀','🛳️','🚲','🛵','🏍️','⛽','🅿️','🚁','🛸'],
  '🏠 Ev & Yaşam': ['🏠','🏡','🏢','🛋️','🛏️','🚿','🛁','🪑','🪞','🧲','🔑','🔒','🪴','🏗️','🧱','💡'],
  '🏥 Sağlık': ['🏥','💊','🩺','🩹','💉','🦷','👓','🧬','🩻','🩸','💆','🧘'],
  '📚 Eğitim': ['📚','🎓','✏️','📝','📖','📐','🔬','🔭','🧪','🎒','📓','📌'],
  '🎮 Eğlence': ['🎮','🎬','🎭','🎪','🎡','🎢','🎠','🎤','🎧','🎵','🎶','🎸','🎻','🎺','🥁','🎲','🎯','🎰'],
  '⚽ Spor': ['⚽','🏀','🏈','⚾','🎾','🏐','🏓','🏸','🏊','🏋️','🤸','🚴','⛷️','🏄','🧗','🥊','🏆','🥇'],
  '🐾 Evcil Hayvan': ['🐾','🐶','🐱','🐟','🐦','🐰','🐹','🦜','🐢','🦮'],
  '👕 Giyim': ['👕','👔','👗','👠','👟','🧥','👜','👝','🎩','🧢','🕶️','💄','👑','💍'],
  '🌿 Doğa': ['🌿','🌳','🌸','🌻','🌈','☀️','🌙','☁️','⚡','🔥','💧','❄️','🌊','🍀'],
  '💻 Teknoloji': ['💻','📱','⌨️','🖱️','🖥️','📷','🎥','📹','🔋','🔌','📡','🛰️','🤖','🧮'],
  '🔧 Tamir': ['🔧','🔨','🪚','🪜','🛠️','⚙️','🔩','🪛','🧰'],
  '📁 Diğer': ['📁','📂','📋','📎','🗂️','🗃️','🗄️','🏷️','✅','❌','⭐','❤️','🔔','🎀','🕐','📅','🗓️','✉️','📮','🎗️'],
};
const EMOJI_CATEGORY_KEYS = Object.keys(EMOJI_CATEGORIES);
const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data.categories);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.delete(`/categories/${deleteConfirmId}`);
      setDeleteConfirmId(null);
      fetchCategories();
    } catch {}
  };

  const filtered = categories.filter(c => {
    const matchesType = !typeFilter || c.type === typeFilter;
    const catName = c.name || '';
    const matchesSearch = catName.toLowerCase().includes((searchQuery || '').toLowerCase());
    return matchesType && matchesSearch;
  });
  const incomeCount = categories.filter(c => c.type === 'income').length;
  const expenseCount = categories.filter(c => c.type === 'expense').length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Kategoriler</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{incomeCount} gelir, {expenseCount} gider kategorisi</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true); }} className="btn btn-primary"><Plus size={18} /> Yeni Kategori</button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          {[{ val: '', label: 'Tümü' }, { val: 'expense', label: '🔴 Gider' }, { val: 'income', label: '🟢 Gelir' }].map(f => (
            <button key={f.val} onClick={() => setTypeFilter(f.val)} className={`btn btn-sm ${typeFilter === f.val ? 'btn-primary' : 'btn-secondary'}`}>{f.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-64">
          <Search size={18} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          <input
            type="text"
            className="input w-full"
            placeholder="Kategori Ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((cat, i) => (
            <div key={cat.id} className="card p-4 group animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: cat.color + '20' }}>
                    {cat.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{cat.name}</p>
                    <span className={`badge text-[11px] ${cat.type === 'income' ? 'badge-income' : 'badge-expense'}`}>
                      {cat.type === 'income' ? 'Gelir' : 'Gider'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditItem(cat); setShowForm(true); }} className="btn-icon btn-ghost btn-sm"><Edit3 size={14} /></button>
                  <button onClick={() => setDeleteConfirmId(cat.id)} className="btn-icon btn-ghost btn-sm hover:!text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}

          {/* Add new card removed as requested */}
        </div>
      )}

      {showForm && (
        <CategoryFormModal editItem={editItem} onClose={() => { setShowForm(false); setEditItem(null); }} onSaved={() => { setShowForm(false); setEditItem(null); fetchCategories(); }} />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirmId(null)}>
          <div className="modal-content p-6" style={{ maxWidth: '400px' }}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: 'var(--expense-light)', color: 'var(--expense)' }}>
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Kategoriyi Sil</h3>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>Bu kategoriyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirmId(null)} className="btn btn-secondary flex-1">İptal</button>
              <button type="button" onClick={executeDelete} className="btn btn-danger flex-1">Evet, Sil</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function CategoryFormModal({ editItem, onClose, onSaved }) {
  const [form, setForm] = useState({ name: editItem?.name || '', type: editItem?.type || 'expense', icon: editItem?.icon || '📁', color: editItem?.color || '#6366f1' });
  const [loading, setLoading] = useState(false);
  const [emojiFilter, setEmojiFilter] = useState('');

  const filteredEmojis = emojiFilter ? EMOJI_CATEGORIES[emojiFilter] : ALL_EMOJIS;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setLoading(true);
    try {
      if (editItem) { await api.put(`/categories/${editItem.id}`, form); }
      else { await api.post('/categories', form); }
      onSaved();
    } catch {}
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editItem ? 'Kategori Düzenle' : 'Yeni Kategori'}</h3>
          <button onClick={onClose} className="btn-icon btn-ghost"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Kategori Adı</label>
            <input className="input" placeholder="Kategori adı" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
          </div>
          {!editItem && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tür</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense' }))} className={`flex-1 btn btn-sm ${form.type === 'expense' ? 'gradient-expense text-white' : 'btn-secondary'}`}>Gider</button>
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income' }))} className={`flex-1 btn btn-sm ${form.type === 'income' ? 'gradient-income text-white' : 'btn-secondary'}`}>Gelir</button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>İkon</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button type="button" onClick={() => setEmojiFilter('')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${!emojiFilter ? 'text-white' : 'hover:opacity-80'}`}
                style={{ background: !emojiFilter ? 'var(--primary)' : 'var(--bg-secondary)', color: !emojiFilter ? 'white' : 'var(--text-secondary)' }}>
                Tümü
              </button>
              {EMOJI_CATEGORY_KEYS.map(cat => (
                <button key={cat} type="button" onClick={() => setEmojiFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${emojiFilter === cat ? 'text-white' : 'hover:opacity-80'}`}
                  style={{ background: emojiFilter === cat ? 'var(--primary)' : 'var(--bg-secondary)', color: emojiFilter === cat ? 'white' : 'var(--text-secondary)' }}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1" style={{ scrollbarWidth: 'thin' }}>
              {filteredEmojis.map(e => (
                <button key={e} type="button" onClick={() => setForm(f => ({ ...f, icon: e }))} className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-all ${form.icon === e ? 'ring-2 ring-[var(--primary)] scale-110' : 'hover:bg-[var(--bg-secondary)]'}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Renk</label>
            <input type="color" value={form.color} onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))} className="w-full h-10 rounded-lg cursor-pointer border-0" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Kaydediliyor...' : editItem ? 'Güncelle' : 'Oluştur'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
