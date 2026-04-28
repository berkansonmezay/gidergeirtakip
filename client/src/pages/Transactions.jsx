import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Filter, Trash2, Edit3, TrendingUp, TrendingDown, X } from 'lucide-react';
import api from '../services/api';

function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payees, setPayees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', category_id: '', payee_id: '', search: '' });
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [total, setTotal] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.type) params.append('type', filter.type);
      if (filter.category_id) params.append('category_id', filter.category_id);
      if (filter.payee_id) params.append('payee_id', filter.payee_id);
      params.append('limit', '100');
      const { data } = await api.get(`/transactions?${params}`);
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data.categories);
    } catch {}
  };

  const fetchPayees = async () => {
    try {
      const { data } = await api.get('/payees');
      setPayees(data.payees);
    } catch {}
  };

  useEffect(() => { fetchCategories(); fetchPayees(); }, []);
  useEffect(() => { fetchTransactions(); }, [filter.type, filter.category_id, filter.payee_id]);

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.delete(`/transactions/${deleteConfirmId}`);
      fetchTransactions();
      window.dispatchEvent(new Event('transaction-added'));
    } catch (err) {
      alert(err.response?.data?.error || 'İşlem silinirken bir hata oluştu.');
    }
    setDeleteConfirmId(null);
  };

  const handleEdit = (tx) => { setEditItem(tx); setShowForm(true); };

  const filtered = transactions.filter(tx => {
    if (!filter.search) return true;
    const s = filter.search.toLowerCase();
    return (tx.description?.toLowerCase().includes(s) || tx.category_name?.toLowerCase().includes(s) || tx.payee_name?.toLowerCase().includes(s));
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>İşlemler</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{total} kayıt bulundu</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true); }} className="btn btn-primary">
          <Plus size={18} /> Yeni İşlem
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input className="input" style={{ paddingLeft: '40px' }} placeholder="Ara..." value={filter.search} onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))} />
          </div>
          <select className="select" style={{ width: 'auto', minWidth: '140px' }} value={filter.type} onChange={(e) => setFilter(f => ({ ...f, type: e.target.value }))}>
            <option value="">Tüm Türler</option>
            <option value="income">Gelir</option>
            <option value="expense">Gider</option>
          </select>
          <select className="select" style={{ width: 'auto', minWidth: '160px' }} value={filter.category_id} onChange={(e) => setFilter(f => ({ ...f, category_id: e.target.value }))}>
            <option value="">Tüm Kategoriler</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select className="select" style={{ width: 'auto', minWidth: '160px' }} value={filter.payee_id} onChange={(e) => setFilter(f => ({ ...f, payee_id: e.target.value }))}>
            <option value="">Tüm Ödeme Yerleri</option>
            {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: 'var(--text-muted)' }}>📭 Henüz işlem bulunamadı</p>
            <button onClick={() => setShowForm(true)} className="btn btn-primary mt-4"><Plus size={18} /> İlk İşlemi Ekle</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Tarih</th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Ödeme Yeri</th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Kategori</th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Açıklama</th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Tür</th>
                  <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Tutar</th>
                  <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => (
                  <tr key={tx.id} className="transition-colors hover:bg-[var(--bg-secondary)]" style={{ borderBottom: '1px solid var(--border)', animationDelay: `${i * 30}ms` }}>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(tx.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tx.payee_name ? <span className="flex items-center gap-1">📍 {tx.payee_name}</span> : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {tx.category_name && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                          {tx.category_icon} {tx.category_name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{tx.description || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${tx.type === 'income' ? 'badge-income' : 'badge-expense'}`}>
                        {tx.type === 'income' ? <><TrendingUp size={12} /> Gelir</> : <><TrendingDown size={12} /> Gider</>}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right ${tx.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => handleEdit(tx)} className="btn-icon btn-ghost btn-sm"><Edit3 size={15} /></button>
                        <button type="button" onClick={() => setDeleteConfirmId(tx.id)} className="btn-icon btn-ghost btn-sm hover:!text-red-500 relative z-10"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <TransactionFormModal
          categories={categories}
          payees={payees}
          editItem={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={() => { setShowForm(false); setEditItem(null); fetchTransactions(); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirmId(null)}>
          <div className="modal-content p-6" style={{ maxWidth: '400px' }}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: 'var(--expense-light)', color: 'var(--expense)' }}>
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>İşlemi Sil</h3>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>Bu işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
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

function TransactionFormModal({ categories, payees, editItem, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: editItem?.type || 'expense',
    amount: editItem?.amount || '',
    description: editItem?.description || '',
    category_id: editItem?.category_id || '',
    payee_id: editItem?.payee_id || '',
    date: editItem?.date || new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredCats = categories.filter(c => c.type === form.type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return setError('Geçerli tutar girin.');
    setLoading(true);
    try {
      if (editItem) {
        await api.put(`/transactions/${editItem.id}`, { ...form, amount: parseFloat(form.amount) });
      } else {
        await api.post('/transactions', { ...form, amount: parseFloat(form.amount) });
      }
      onSaved();
      window.dispatchEvent(new Event('transaction-added'));
    } catch (err) { setError(err.response?.data?.error || 'Hata oluştu.'); }
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editItem ? 'İşlemi Düzenle' : 'Yeni İşlem'}</h3>
          <button onClick={onClose} className="btn-icon btn-ghost"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'var(--expense-light)', color: 'var(--expense)' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))} className={`flex-1 btn ${form.type === 'expense' ? 'gradient-expense text-white' : 'btn-secondary'}`}>
              <TrendingDown size={16} /> Gider
            </button>
            <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))} className={`flex-1 btn ${form.type === 'income' ? 'gradient-income text-white' : 'btn-secondary'}`}>
              <TrendingUp size={16} /> Gelir
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tutar (₺)</label>
            <input type="number" step="0.01" className="input text-xl font-bold text-center" placeholder="0.00" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} autoFocus />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Açıklama</label>
            <input className="input" placeholder="Açıklama..." value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ödeme Yeri (Gider Yapılan)</label>
              <select className="select" value={form.payee_id} onChange={(e) => setForm(f => ({ ...f, payee_id: e.target.value }))}>
                <option value="">Seçiniz</option>
                {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Kategori</label>
              <select className="select" value={form.category_id} onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Seçiniz</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tarih</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Kaydediliyor...' : editItem ? 'Güncelle' : 'Ekle'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
