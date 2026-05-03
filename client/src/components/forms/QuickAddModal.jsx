import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../../services/api';

export default function QuickAddModal({ onClose, initialType }) {
  const [type, setType] = useState(initialType || 'expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categories, setCategories] = useState([]);
  const [payees, setPayees] = useState([]);
  const [payeeId, setPayeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('12');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setCategoryId('');
    api.get(`/categories?type=${type}`).then(r => setCategories(r.data.categories)).catch(() => {});
    api.get('/payees').then(r => setPayees(r.data.payees)).catch(() => {});
  }, [type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return setError('Geçerli bir tutar girin.');
    setLoading(true);
    setError('');
    try {
      if (isInstallment) {
        await api.post('/installments', {
          description,
          total_amount: parseFloat(amount),
          installment_count: parseInt(installmentCount),
          start_date: startDate,
          category_id: categoryId || null,
          payee_id: payeeId || null,
          type
        });
      } else {
        await api.post('/transactions', { amount: parseFloat(amount), description, date, type, category_id: categoryId || null, payee_id: payeeId || null });
      }
      onClose();
      window.dispatchEvent(new Event('transaction-added'));
      if (isInstallment) window.dispatchEvent(new Event('installment-added'));
    } catch (err) {
      setError(err.response?.data?.error || 'Hata oluştu.');
    }
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-0 overflow-hidden">
        {/* Header */}
        <div className={`p-5 text-white ${type === 'income' ? 'gradient-income' : 'gradient-expense'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Hızlı İşlem Ekle</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 transition-colors"><X size={20} /></button>
          </div>
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setType('expense')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${type === 'expense' ? 'bg-white/25 shadow-md' : 'bg-white/10 hover:bg-white/15'}`}
            >
              <TrendingDown size={18} /> Gider
            </button>
            <button
              onClick={() => setType('income')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${type === 'income' ? 'bg-white/25 shadow-md' : 'bg-white/10 hover:bg-white/15'}`}
            >
              <TrendingUp size={18} /> Gelir
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 rounded-xl text-sm font-medium" style={{ background: 'var(--expense-light)', color: 'var(--expense)' }}>{error}</div>}
          
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Tutar (₺)</label>
            <input
              type="number"
              step="0.01"
              className="input text-2xl font-bold text-center"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              style={{ fontSize: '1.5rem', padding: '14px' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Harcama Yeri</label>
              <select className="select" value={payeeId} onChange={(e) => setPayeeId(e.target.value)}>
                <option value="">Seçiniz</option>
                {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Kategori</label>
              <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Seçiniz</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Tarih</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Açıklama</label>
            <input className="input" placeholder="İşlem açıklaması..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Installment Toggle */}
          <div className="p-4 rounded-2xl border transition-all" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${isInstallment ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                  <TrendingUp size={16} className={isInstallment ? 'rotate-45' : ''} style={{ transition: 'transform 0.3s' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Taksitli İşlem</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Bu işlemi taksitlere böl</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={isInstallment} onChange={(e) => setIsInstallment(e.target.checked)} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {isInstallment && (
              <div className="pt-3 border-t mt-3 animate-slide-down" style={{ borderColor: 'var(--border)' }}>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Taksit Sayısı</label>
                    <input
                      type="number"
                      min="2"
                      max="60"
                      className="input !py-2"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>İlk Taksit</label>
                    <input
                      type="date"
                      className="input !py-2 !text-[11px]"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Taksit Tutarı</label>
                    <div className="h-10 flex items-center px-2 rounded-xl font-bold text-[13px]" style={{ background: 'var(--bg-primary)', color: 'var(--primary)' }}>
                      ₺{amount && installmentCount ? (parseFloat(amount) / parseInt(installmentCount)).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`btn w-full btn-lg text-white font-semibold ${type === 'income' ? 'gradient-income' : 'gradient-expense'}`}
            style={{ borderRadius: '12px' }}
          >
            {loading ? 'Ekleniyor...' : `${type === 'income' ? 'Gelir' : 'Gider'} Ekle`}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
