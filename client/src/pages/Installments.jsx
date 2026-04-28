import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, CreditCard, Check, ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
import api from '../services/api';

function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }

export default function Installments() {
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [payments, setPayments] = useState({});
  const [categories, setCategories] = useState([]);

  const fetchInstallments = async () => {
    try {
      const { data } = await api.get('/installments');
      setInstallments(data.installments);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchInstallments();
    api.get('/categories?type=expense').then(r => setCategories(r.data.categories)).catch(() => {});
  }, []);

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!payments[id]) {
      try {
        const { data } = await api.get(`/installments/${id}`);
        setPayments(p => ({ ...p, [id]: data.payments }));
      } catch {}
    }
  };

  const handlePay = async (id) => {
    try {
      await api.put(`/installments/${id}/pay`);
      fetchInstallments();
      const { data } = await api.get(`/installments/${id}`);
      setPayments(p => ({ ...p, [id]: data.payments }));
    } catch {}
  };

  const handleUnpay = async (id) => {
    if (!window.confirm('Son ödemeyi geri almak istediğinize emin misiniz?')) return;
    try {
      await api.put(`/installments/${id}/unpay`);
      fetchInstallments();
      const { data } = await api.get(`/installments/${id}`);
      setPayments(p => ({ ...p, [id]: data.payments }));
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu taksiti silmek istediğinize emin misiniz?')) return;
    try { await api.delete(`/installments/${id}`); fetchInstallments(); } catch {}
  };

  const active = installments.filter(i => i.status === 'active');
  const completed = installments.filter(i => i.status === 'completed');
  const totalMonthly = active.reduce((s, i) => s + i.monthly_amount, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Taksitler</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{active.length} aktif taksit • Aylık toplam: {formatMoney(totalMonthly)}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus size={18} /> Yeni Taksit</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
      ) : installments.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-muted)' }}>Henüz taksit kaydı yok</p>
          <button onClick={() => setShowForm(true)} className="btn btn-primary mt-4"><Plus size={18} /> İlk Taksiti Ekle</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active installments */}
          {active.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Aktif Taksitler</h3>
              <div className="space-y-3">
                {active.map((inst, i) => (
                  <InstallmentCard key={inst.id} inst={inst} expanded={expandedId === inst.id} payments={payments[inst.id]} onToggle={() => toggleExpand(inst.id)} onPay={() => handlePay(inst.id)} onUnpay={() => handleUnpay(inst.id)} onDelete={() => handleDelete(inst.id)} delay={i} />
                ))}
              </div>
            </div>
          )}
          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tamamlanan Taksitler</h3>
              <div className="space-y-3">
                {completed.map((inst, i) => (
                  <InstallmentCard key={inst.id} inst={inst} expanded={expandedId === inst.id} payments={payments[inst.id]} onToggle={() => toggleExpand(inst.id)} onUnpay={() => handleUnpay(inst.id)} onDelete={() => handleDelete(inst.id)} delay={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && <InstallmentFormModal categories={categories} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchInstallments(); }} />}
    </div>
  );
}

function InstallmentCard({ inst, expanded, payments, onToggle, onPay, onUnpay, onDelete, delay }) {
  const progress = inst.installment_count > 0 ? (inst.paid_count / inst.installment_count) * 100 : 0;
  const isComplete = inst.status === 'completed';

  return (
    <div className="card overflow-hidden animate-fade-in" style={{ animationDelay: `${delay * 80}ms` }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${isComplete ? 'bg-emerald-500' : 'gradient-primary'}`}>
              {isComplete ? <Check size={20} /> : <CreditCard size={20} />}
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{inst.description}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {inst.paid_count} / {inst.installment_count} taksit ödendi
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatMoney(inst.total_amount)}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aylık: {formatMoney(inst.monthly_amount)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-bar mb-3">
          <div className="progress-fill" style={{ width: `${progress}%`, background: isComplete ? '#10b981' : undefined }} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isComplete && onPay && (
              <button onClick={onPay} className="btn btn-sm btn-primary"><Check size={14} /> Taksit Öde</button>
            )}
            {inst.paid_count > 0 && onUnpay && (
              <button type="button" onClick={onUnpay} className="btn btn-sm btn-ghost hover:!text-orange-500 relative z-10" title="Son ödemeyi geri al">Geri Al</button>
            )}
            <button onClick={onToggle} className="btn btn-sm btn-ghost">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Detay
            </button>
          </div>
          <button type="button" onClick={onDelete} className="btn-icon btn-ghost btn-sm hover:!text-red-500 relative z-10"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Expanded payment schedule */}
      {expanded && payments && (
        <div className="border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center ${p.is_paid ? 'bg-emerald-500 text-white' : ''}`} style={!p.is_paid ? { border: '2px solid var(--border)' } : {}}>
                    {p.is_paid && <Check size={12} />}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>Taksit {p.payment_number}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(p.due_date).toLocaleDateString('tr-TR')}</span>
                  <span className="font-medium" style={{ color: p.is_paid ? 'var(--income)' : 'var(--text-primary)' }}>{formatMoney(p.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InstallmentFormModal({ categories, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', total_amount: '', installment_count: '', start_date: new Date().toISOString().split('T')[0], category_id: '' });
  const [loading, setLoading] = useState(false);

  const monthly = form.total_amount && form.installment_count ? (parseFloat(form.total_amount) / parseInt(form.installment_count)).toFixed(2) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/installments', { ...form, total_amount: parseFloat(form.total_amount), installment_count: parseInt(form.installment_count) });
      onSaved();
    } catch {}
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Yeni Taksit</h3>
          <button onClick={onClose} className="btn-icon btn-ghost"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Açıklama</label>
            <input className="input" placeholder="ör: Telefon taksiti" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Toplam Tutar (₺)</label>
              <input type="number" className="input" placeholder="50000" value={form.total_amount} onChange={(e) => setForm(f => ({ ...f, total_amount: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Taksit Sayısı</label>
              <input type="number" className="input" placeholder="12" min="1" max="60" value={form.installment_count} onChange={(e) => setForm(f => ({ ...f, installment_count: e.target.value }))} required />
            </div>
          </div>
          {monthly > 0 && (
            <div className="p-3 rounded-xl text-center" style={{ background: 'var(--bg-secondary)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aylık Taksit Tutarı</p>
              <p className="text-xl font-bold" style={{ color: 'var(--primary)' }}>{formatMoney(monthly)}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Başlangıç Tarihi</label>
              <input type="date" className="input" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Kategori</label>
              <select className="select" value={form.category_id} onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Seçiniz</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Oluşturuluyor...' : 'Taksit Oluştur'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
