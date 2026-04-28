import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, PiggyBank, Target, Trash2, X } from 'lucide-react';
import api from '../services/api';

function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }

export default function Savings() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [addAmountId, setAddAmountId] = useState(null);
  const [addAmount, setAddAmount] = useState('');

  const fetchGoals = async () => {
    try { const { data } = await api.get('/savings'); setGoals(data.goals); } catch {}
    setLoading(false);
  };
  useEffect(() => { fetchGoals(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Hedefi silmek istediğinize emin misiniz?')) return;
    try { await api.delete(`/savings/${id}`); fetchGoals(); } catch {}
  };

  const handleAddAmount = async (id) => {
    if (!addAmount || parseFloat(addAmount) <= 0) return;
    try { await api.put(`/savings/${id}`, { add_amount: parseFloat(addAmount) }); setAddAmountId(null); setAddAmount(''); fetchGoals(); } catch {}
  };

  const active = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');
  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Tasarruf Hedefleri</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Toplam birikim: {formatMoney(totalSaved)} / {formatMoney(totalTarget)}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus size={18} /> Yeni Hedef</button>
      </div>

      {/* Overall progress */}
      {goals.length > 0 && (
        <div className="card p-5 gradient-accent text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <PiggyBank size={28} />
              <div>
                <p className="text-sm opacity-80">Genel İlerleme</p>
                <p className="text-2xl font-bold">{formatMoney(totalSaved)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">Hedef</p>
              <p className="text-lg font-semibold">{formatMoney(totalTarget)}</p>
            </div>
          </div>
          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0}%` }} />
          </div>
          <p className="text-xs mt-2 opacity-70 text-right">{totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}% tamamlandı</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
      ) : goals.length === 0 ? (
        <div className="card p-12 text-center">
          <Target size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-muted)' }}>Henüz tasarruf hedefi yok</p>
          <button onClick={() => setShowForm(true)} className="btn btn-primary mt-4"><Plus size={18} /> İlk Hedefi Oluştur</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...active, ...completed].map((goal, i) => {
            const pct = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
            const isComplete = goal.status === 'completed';
            const daysLeft = goal.deadline ? Math.max(0, Math.ceil((new Date(goal.deadline) - new Date()) / 86400000)) : null;

            return (
              <div key={goal.id} className="card p-5 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white ${isComplete ? 'bg-emerald-500' : 'gradient-primary'}`}>
                      {isComplete ? '🎉' : '🎯'}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{goal.name}</p>
                      {daysLeft !== null && !isComplete && (
                        <p className="text-xs" style={{ color: daysLeft < 30 ? 'var(--expense)' : 'var(--text-muted)' }}>{daysLeft} gün kaldı</p>
                      )}
                      {isComplete && <span className="badge badge-income text-xs">Tamamlandı!</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(goal.id)} className="btn-icon btn-ghost btn-sm hover:!text-red-500"><Trash2 size={14} /></button>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>{formatMoney(goal.current_amount)}</span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatMoney(goal.target_amount)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: isComplete ? '#10b981' : undefined }} />
                  </div>
                  <p className="text-xs text-right mt-1 font-medium" style={{ color: 'var(--primary)' }}>{Math.round(pct)}%</p>
                </div>

                {!isComplete && (
                  <div>
                    {addAmountId === goal.id ? (
                      <div className="flex gap-2">
                        <input type="number" className="input" style={{ flex: 1 }} placeholder="Tutar (₺)" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} autoFocus />
                        <button onClick={() => handleAddAmount(goal.id)} className="btn btn-primary btn-sm">Ekle</button>
                        <button onClick={() => { setAddAmountId(null); setAddAmount(''); }} className="btn btn-ghost btn-sm">İptal</button>
                      </div>
                    ) : (
                      <button onClick={() => setAddAmountId(goal.id)} className="btn btn-secondary btn-sm w-full"><Plus size={14} /> Birikim Ekle</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <SavingsFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchGoals(); }} />}
    </div>
  );
}

function SavingsFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', target_amount: '', deadline: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.target_amount) return;
    setLoading(true);
    try { await api.post('/savings', { ...form, target_amount: parseFloat(form.target_amount) }); onSaved(); } catch {}
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Yeni Tasarruf Hedefi</h3>
          <button onClick={onClose} className="btn-icon btn-ghost"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Hedef Adı</label>
            <input className="input" placeholder="ör: Tatil fonu" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Hedef Tutar (₺)</label>
            <input type="number" className="input" placeholder="50000" value={form.target_amount} onChange={(e) => setForm(f => ({ ...f, target_amount: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Hedef Tarihi (Opsiyonel)</label>
            <input type="date" className="input" value={form.deadline} onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Oluşturuluyor...' : 'Hedef Oluştur'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
