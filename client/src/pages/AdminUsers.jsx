import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit3, X, UserCog, KeyRound } from 'lucide-react';
import api from '../services/api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
      alert('Kullanıcılar yüklenirken hata oluştu.');
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.delete(`/users/${deleteConfirmId}`);
      setDeleteConfirmId(null);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Silme işlemi başarısız.');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Kullanıcı Yönetimi</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sistemdeki tüm kullanıcıları yönetin</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true); }} className="btn btn-primary"><Plus size={18} /> Yeni Kullanıcı Ekle</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((user, i) => (
            <div key={user.id} className="card p-4 group animate-fade-in" style={{ animationDelay: `${i * 50}ms`, border: user.role === 'admin' ? '1px solid var(--primary)' : undefined }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: user.role === 'admin' ? 'var(--primary)' : 'var(--bg-secondary)', color: user.role === 'admin' ? 'white' : 'var(--text-secondary)' }}>
                    {user.role === 'admin' ? <UserCog size={24} /> : <UserCog size={24} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>@{user.username} | {user.email}</p>
                    <div className="mt-1">
                      <span className={`badge text-[10px] ${user.role === 'admin' ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                        {user.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditItem(user); setShowForm(true); }} className="btn-icon btn-ghost btn-sm" title="Düzenle"><Edit3 size={14} /></button>
                  {user.role !== 'admin' && (
                    <button onClick={() => setDeleteConfirmId(user.id)} className="btn-icon btn-ghost btn-sm hover:!text-red-500" title="Sil"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <UserFormModal editItem={editItem} onClose={() => { setShowForm(false); setEditItem(null); }} onSaved={() => { setShowForm(false); setEditItem(null); fetchUsers(); }} />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirmId(null)}>
          <div className="modal-content p-6" style={{ maxWidth: '400px' }}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: 'var(--expense-light)', color: 'var(--expense)' }}>
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Kullanıcıyı Sil</h3>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>Bu kullanıcıyı silmek istediğinize emin misiniz? Kullanıcının giriş erişimi tamamen iptal edilecektir.</p>
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

function UserFormModal({ editItem, onClose, onSaved }) {
  const [form, setForm] = useState({ 
    name: editItem?.name || '', 
    email: editItem?.email || '', 
    username: editItem?.username || '', 
    role: editItem?.role || 'user',
    password: '' 
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editItem) { 
        const payload = { ...form };
        if (!payload.password) delete payload.password; // Don't send empty password
        await api.put(`/users/${editItem.id}`, payload); 
      }
      else { 
        if (!form.password) throw new Error("Şifre zorunludur.");
        await api.post('/users', form); 
      }
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Bir hata oluştu.');
    }
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editItem ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Oluştur'}</h3>
          <button onClick={onClose} className="btn-icon btn-ghost"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ad Soyad</label>
            <input className="input w-full" placeholder="Ad Soyad" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Kullanıcı Adı</label>
              <input className="input w-full" placeholder="Kullanıcı Adı" value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>E-posta</label>
              <input type="email" className="input w-full" placeholder="E-posta" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Rol</label>
            <select className="input w-full" value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="user">Kullanıcı (User)</option>
              <option value="admin">Yönetici (Admin)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {editItem ? 'Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)' : 'Şifre'}
            </label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" placeholder="En az 8 karakter" className="input w-full pl-9" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required={!editItem} minLength={8} />
            </div>
          </div>
          
          {!editItem && (
             <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-xs text-indigo-700 mt-2">
               Bu kullanıcı oluşturulduğunda varsayılan harcama yerleri ve kategoriler otomatik olarak hesabına yüklenecektir.
             </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Kaydediliyor...' : editItem ? 'Güncelle' : 'Oluştur'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
