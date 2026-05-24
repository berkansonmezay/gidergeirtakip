import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Repeat, Plus, Trash2, X, Edit3, Search, Bell, BellOff, Calendar, Link as LinkIcon, AlertCircle, CreditCard, CheckCircle2, History } from 'lucide-react';
import api from '../services/api';

function formatMoney(n, curr = '₺') { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n).replace('₺', curr); }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); }

const CATEGORIES = [
  { value: 'eglence', label: 'Eğlence & Medya', icon: '🍿' },
  { value: 'yazilim', label: 'Yazılım & Araçlar', icon: '💻' },
  { value: 'oyun', label: 'Oyun', icon: '🎮' },
  { value: 'spor', label: 'Spor & Sağlık', icon: '🏋️' },
  { value: 'egitim', label: 'Eğitim', icon: '📚' },
  { value: 'diger', label: 'Diğer', icon: '📦' },
];

const PRESETS = [
  { name: 'Netflix', icon: '🎬', category: 'eglence', url: 'https://www.netflix.com/cancelplan', color: '#E50914' },
  { name: 'Spotify', icon: '🎧', category: 'eglence', url: 'https://www.spotify.com/account/cancel/', color: '#1DB954' },
  { name: 'YouTube Premium', icon: '▶️', category: 'eglence', url: 'https://www.youtube.com/paid_memberships', color: '#FF0000' },
  { name: 'Amazon Prime', icon: '📦', category: 'eglence', url: 'https://www.amazon.com/mc', color: '#00A8E1' },
  { name: 'Adobe Creative Cloud', icon: '🎨', category: 'yazilim', url: 'https://account.adobe.com/plans', color: '#FF0000' },
  { name: 'ChatGPT Plus', icon: '🤖', category: 'yazilim', url: 'https://chat.openai.com', color: '#10A37F' },
  { name: 'Xbox Game Pass', icon: '🎮', category: 'oyun', url: 'https://account.microsoft.com/services', color: '#107C10' },
  { name: 'PlayStation Plus', icon: '🎮', category: 'oyun', url: 'https://store.playstation.com/', color: '#003791' },
  { name: 'Apple Music', icon: '🎵', category: 'eglence', url: 'https://music.apple.com/account', color: '#FA243C' },
  { name: 'MacFit', icon: '🏋️', category: 'spor', url: 'https://www.macfit.com.tr/', color: '#F15A24' }
];

function getSubStatus(endDate) {
  if (!endDate) return { label: 'Belirsiz', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
  const now = new Date();
  const end = new Date(endDate);
  now.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  const daysLeft = Math.ceil((end - now) / 86400000);
  
  if (daysLeft < 0) return { label: 'Günü Geçti', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', daysLeft };
  if (daysLeft <= 2) return { label: `${daysLeft} gün kaldı!`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', daysLeft, urgent: true };
  if (daysLeft <= 7) return { label: `${daysLeft} gün kaldı`, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', daysLeft };
  return { label: `${daysLeft} gün kaldı`, color: '#10b981', bg: 'rgba(16,185,129,0.12)', daysLeft };
}


// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function Subscriptions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filter, setFilter] = useState('active'); // active | cancelled
  const [searchQuery, setSearchQuery] = useState('');

  const fetchItems = async () => {
    try {
      const { data } = await api.get('/subscriptions');
      setItems(data.items);
    } catch (err) {
      console.error('Fetch Subscriptions Error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleDelete = (id) => {
    const item = items.find(i => i.id === id);
    setDeleteConfirm({
      id,
      title: 'Aboneliği Sil',
      message: `"${item?.name}" aboneliğini tamamen silmek istediğinize emin misiniz? (Geçmişte İptal Edildi olarak işaretlemeyi de seçebilirsiniz.)`
    });
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/subscriptions/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      fetchItems();
    } catch {}
  };

  const toggleStatus = async (item, e) => {
    e.stopPropagation();
    try {
      await api.put(`/subscriptions/${item.id}`, {
        status: item.status === 'active' ? 'cancelled' : 'active'
      });
      fetchItems();
    } catch {}
  };

  const toggleNotification = async (item, e) => {
    e.stopPropagation();
    try {
      await api.put(`/subscriptions/${item.id}`, {
        reminder_enabled: !item.reminder_enabled
      });
      fetchItems();
    } catch {}
  };

  // Stats
  const activeItems = items.filter(i => i.status === 'active');
  const cancelledItems = items.filter(i => i.status === 'cancelled');
  
  // Calculate monthly total (yearly / 12) - simple estimation in TRY (assuming ₺ for simplicity, could add conversion later)
  const monthlyTotal = activeItems.reduce((acc, curr) => {
    let amount = curr.amount || 0;
    if (curr.billing_cycle === 'yearly') amount = amount / 12;
    return acc + amount;
  }, 0);

  const yearlyTotal = activeItems.reduce((acc, curr) => {
    let amount = curr.amount || 0;
    if (curr.billing_cycle === 'monthly') amount = amount * 12;
    return acc + amount;
  }, 0);

  // Filtered items
  const filtered = useMemo(() => {
    const list = filter === 'active' ? activeItems : cancelledItems;
    return list.filter(item => {
      const q = (searchQuery || '').toLowerCase();
      return !q || (item.name || '').toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q);
    });
  }, [activeItems, cancelledItems, filter, searchQuery]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Repeat size={26} style={{ color: 'var(--primary)' }} />
            Abonelik İptal Hatırlatıcısı
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Dijital üyeliklerinizi takip edin, boşuna para ödemeyin</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true); }} className="btn btn-primary">
          <Plus size={18} /> Yeni Abonelik
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 animate-fade-in" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <CheckCircle2 size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Aktif Abonelik</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{activeItems.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4 animate-fade-in" style={{ borderLeft: '4px solid #ef4444', animationDelay: '50ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <History size={20} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>İptal Edilen</p>
              <p className="text-xl font-bold" style={{ color: '#ef4444' }}>{cancelledItems.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4 animate-fade-in" style={{ borderLeft: '4px solid #8b5cf6', animationDelay: '100ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)' }}>
              <CreditCard size={20} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Aylık Maliyet</p>
              <p className="text-lg font-bold" style={{ color: '#8b5cf6' }}>{formatMoney(monthlyTotal)}</p>
            </div>
          </div>
        </div>
        <div className="card p-4 animate-fade-in" style={{ borderLeft: '4px solid #f59e0b', animationDelay: '150ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <Calendar size={20} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Yıllık Maliyet</p>
              <p className="text-lg font-bold" style={{ color: '#f59e0b' }}>{formatMoney(yearlyTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <button onClick={() => setFilter('active')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === 'active' ? 'bg-white shadow-sm' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            style={{ color: filter === 'active' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            Aktif Olanlar ({activeItems.length})
          </button>
          <button onClick={() => setFilter('cancelled')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === 'cancelled' ? 'bg-white shadow-sm' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            style={{ color: filter === 'cancelled' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            İptal Edilenler ({cancelledItems.length})
          </button>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-64">
          <Search size={18} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          <input type="text" className="input w-full" placeholder="Abonelik ara..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <Repeat size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-muted)' }}>Hiç abonelik eklemediniz</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Kullanmadığınız üyeliklerden kurtulmak için takibe başlayın</p>
          <button onClick={() => { setEditItem(null); setShowForm(true); }} className="btn btn-primary mt-4"><Plus size={18} /> İlk Aboneliği Ekle</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <Search size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Bu listede abonelik bulunamadı.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, i) => {
            const status = getSubStatus(item.next_billing_date);
            const isCancelled = item.status === 'cancelled';

            return (
              <div key={item.id} className={`card p-4 transition-all border-2 ${isCancelled ? 'opacity-75' : 'hover:shadow-lg'}`}
                style={{ animationDelay: `${i * 50}ms`, borderColor: status.urgent && !isCancelled ? '#f59e0b' : 'transparent' }}>
                
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner" style={{ background: 'var(--bg-secondary)' }}>
                      {item.icon || '🔄'}
                    </div>
                    <div>
                      <h3 className="font-bold text-base line-clamp-1" style={{ color: 'var(--text-primary)', textDecoration: isCancelled ? 'line-through' : 'none' }}>{item.name}</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{CATEGORIES.find(c => c.value === item.category)?.label || item.category}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditItem(item); setShowForm(true); }} className="btn-icon btn-ghost btn-sm"><Edit3 size={14} /></button>
                      <button onClick={() => handleDelete(item.id)} className="btn-icon btn-ghost btn-sm hover:!text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>

                {/* Price & Cycle */}
                <div className="flex items-center justify-between p-3 rounded-xl mb-3" style={{ background: 'var(--bg-secondary)' }}>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tutar</p>
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{item.amount} {item.currency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Döngü</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {item.billing_cycle === 'yearly' ? 'Yıllık' : 'Aylık'}
                    </p>
                  </div>
                </div>

                {/* Status & Next Bill */}
                {!isCancelled ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Sonraki Ödeme: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{formatDate(item.next_billing_date)}</span></p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1" style={{ background: status.bg, color: status.color }}>
                        {status.urgent && <AlertCircle size={10} />} {status.label}
                      </span>
                    </div>
                    <button onClick={(e) => toggleNotification(item, e)}
                      className={`btn-icon btn-sm ${item.reminder_enabled ? '' : 'btn-ghost'}`}
                      style={{ 
                        background: item.reminder_enabled ? 'rgba(245,158,11,0.15)' : '', 
                        color: item.reminder_enabled ? '#f59e0b' : 'var(--text-muted)' 
                      }}
                      title={item.reminder_enabled ? 'Hatırlatıcı Açık (2 gün kala)' : 'Hatırlatıcı Kapalı'}>
                      {item.reminder_enabled ? <Bell size={16} /> : <BellOff size={16} />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-lg justify-center" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                    <History size={14} />
                    <span className="text-xs font-bold">İptal Edildi</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm flex-1 text-xs justify-center gap-1.5 hover:!bg-blue-50 dark:hover:!bg-blue-900/20 hover:!text-blue-600">
                      <LinkIcon size={12} /> İptal Sayfası
                    </a>
                  )}
                  <button onClick={(e) => toggleStatus(item, e)} 
                    className={`btn btn-sm flex-1 text-xs justify-center font-bold ${isCancelled ? 'btn-primary' : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40'}`}>
                    {isCancelled ? 'Yeniden Aktif Et' : 'İptal Edildi İşaretle'}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <SubscriptionFormModal
          editItem={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={() => { setShowForm(false); setEditItem(null); fetchItems(); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal-content p-6 animate-slide-up" style={{ maxWidth: '400px' }}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{deleteConfirm.title}</h3>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{deleteConfirm.message}</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="btn btn-secondary flex-1">Vazgeç</button>
              <button type="button" onClick={executeDelete} className="btn bg-rose-500 hover:bg-rose-600 text-white flex-1 font-bold">Evet, Sil</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


// ============================================================================
// FORM MODAL
// ============================================================================
function SubscriptionFormModal({ editItem, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: editItem?.name || '',
    amount: editItem?.amount || '',
    currency: editItem?.currency || '₺',
    billing_cycle: editItem?.billing_cycle || 'monthly',
    next_billing_date: editItem?.next_billing_date ? editItem.next_billing_date.split('T')[0] : new Date().toISOString().split('T')[0],
    category: editItem?.category || 'eglence',
    icon: editItem?.icon || '🔄',
    url: editItem?.url || '',
    notes: editItem?.notes || '',
    reminder_enabled: editItem?.reminder_enabled !== undefined ? editItem.reminder_enabled : true,
    status: editItem?.status || 'active'
  });
  const [loading, setLoading] = useState(false);

  const updateField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const applyPreset = (preset) => {
    setForm(f => ({
      ...f,
      name: preset.name,
      icon: preset.icon,
      category: preset.category,
      url: preset.url
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.amount === '') return;
    
    setLoading(true);
    try {
      if (editItem) {
        await api.put(`/subscriptions/${editItem.id}`, form);
      } else {
        await api.post('/subscriptions', form);
      }
      onSaved();
    } catch (err) {
      console.error('Save error:', err);
    }
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-0 overflow-hidden" style={{ maxWidth: '500px' }}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl">
              {form.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold">{editItem ? 'Aboneliği Düzenle' : 'Yeni Abonelik Ekle'}</h3>
              <p className="text-xs opacity-80">Faturalandırma öncesi uyarı alın</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={22} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: 'thin', background: 'var(--bg-primary)' }}>
          
          {/* Presets (Only for New) */}
          {!editItem && (
            <div className="mb-4">
              <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>HIZLI EKLE</label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                {PRESETS.map(p => (
                  <button key={p.name} type="button" onClick={() => applyPreset(p)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <span>{p.icon}</span> {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name & Icon */}
          <div className="flex gap-3">
            <div className="w-16">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>İkon</label>
              <input className="input text-center text-xl p-0" value={form.icon}
                onChange={(e) => updateField('icon', e.target.value)} maxLength={2} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Abonelik Adı *</label>
              <input className="input" placeholder="ör: Netflix, Spor Salonu" value={form.name}
                onChange={(e) => updateField('name', e.target.value)} required autoFocus />
            </div>
          </div>

          {/* Amount & Cycle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tutar *</label>
              <div className="flex gap-1">
                <input type="number" step="0.01" className="input w-full" placeholder="0.00" value={form.amount}
                  onChange={(e) => updateField('amount', e.target.value)} required />
                <select className="input px-2 w-16 text-center" value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value)}>
                  <option value="₺">₺</option>
                  <option value="$">$</option>
                  <option value="€">€</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Döngü</label>
              <select className="input w-full" value={form.billing_cycle}
                onChange={(e) => updateField('billing_cycle', e.target.value)}>
                <option value="monthly">Aylık</option>
                <option value="yearly">Yıllık</option>
              </select>
            </div>
          </div>

          {/* Date & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Sonraki Ödeme Tarihi *</label>
              <input type="date" className="input w-full" value={form.next_billing_date}
                onChange={(e) => updateField('next_billing_date', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Kategori</label>
              <select className="input w-full" value={form.category}
                onChange={(e) => updateField('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>İptal Linki / URL (Opsiyonel)</label>
            <input type="url" className="input w-full" placeholder="https://..." value={form.url}
              onChange={(e) => updateField('url', e.target.value)} />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>İleride iptal etmeniz gerekirse tek tıkla sayfaya gidebilirsiniz.</p>
          </div>

          {/* Reminder Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-black/5 transition-colors" 
            style={{ background: form.reminder_enabled ? 'rgba(245,158,11,0.1)' : 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            onClick={() => updateField('reminder_enabled', !form.reminder_enabled)}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: form.reminder_enabled ? 'rgba(245,158,11,0.2)' : 'var(--bg-card)' }}>
                {form.reminder_enabled ? <Bell size={16} style={{ color: '#f59e0b' }} /> : <BellOff size={16} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Hatırlatıcı</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Karttan çekilmeden 2 gün önce uyar</p>
              </div>
            </div>
            <div className="w-10 h-6 rounded-full transition-all relative" style={{ background: form.reminder_enabled ? '#f59e0b' : 'var(--border)' }}>
              <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-sm" style={{ left: form.reminder_enabled ? '22px' : '4px' }} />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold border-none">
              {loading ? 'Kaydediliyor...' : editItem ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
