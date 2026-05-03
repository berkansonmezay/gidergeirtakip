import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit3, X, MapPin } from 'lucide-react';
import api from '../services/api';

export default function Payees() {
  const [payees, setPayees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [name, setName] = useState('');

  const fetchPayees = async () => {
    try {
      const { data } = await api.get('/payees');
      setPayees(data.payees);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchPayees(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;
    try {
      if (editItem) {
        await api.put(`/payees/${editItem.id}`, { name });
      } else {
        await api.post('/payees', { name });
      }
      setName('');
      setEditItem(null);
      setShowForm(false);
      fetchPayees();
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu ödeme yerini silmek istediğinize emin misiniz?')) return;
    try { await api.delete(`/payees/${id}`); fetchPayees(); } catch {}
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Harcama Yerleri</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Gider yapılan kurum veya mağazalar</p>
        </div>
        <button onClick={() => { setEditItem(null); setName(''); setShowForm(true); }} className="btn btn-primary"><Plus size={18} /> Yeni Ekle</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {payees.map((p) => (
            <div key={p.id} className="card p-4 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)]">
                  <MapPin size={20} />
                </div>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditItem(p); setName(p.name); setShowForm(true); }} className="btn-icon btn-ghost btn-sm"><Edit3 size={15} /></button>
                <button onClick={() => handleDelete(p.id)} className="btn-icon btn-ghost btn-sm hover:!text-red-500"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editItem ? 'Düzenle' : 'Yeni Harcama Yeri'}</h3>
              <button onClick={() => setShowForm(false)} className="btn-icon btn-ghost"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>İsim (Örn: Migros, Shell, Kira vb.)</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn btn-primary flex-1">Kaydet</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
