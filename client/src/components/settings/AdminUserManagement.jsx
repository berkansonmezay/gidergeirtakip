import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit3, X } from 'lucide-react';
import api from '../../services/api';

export default function AdminUserManagement() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/family/members');
      setMembers(res.data.members || []);
      setError(null);
    } catch (err) {
      setError('Kullanıcılar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (member = null) => {
    if (member) {
      setEditId(member.id);
      setName(member.name);
      setUsername(member.username);
      setPassword(''); // Don't prefill password
    } else {
      setEditId(null);
      setName('');
      setUsername('');
      setPassword('');
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !username) return;

    try {
      setFormLoading(true);
      if (editId) {
        await api.put(`/family/members/${editId}`, { name, username, password });
      } else {
        await api.post('/family/members', { name, username, password });
      }
      setShowForm(false);
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.error || 'İşlem başarısız.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/family/members/${id}`);
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.error || 'Kullanıcı silinemedi.');
    }
  };

  if (loading) return <div className="text-center p-4">Yükleniyor...</div>;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users size={20} style={{ color: 'var(--primary)' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Kullanıcı Yönetimi</h3>
        </div>
        <button 
          onClick={() => handleOpenForm()}
          className="btn btn-primary btn-sm flex items-center gap-1"
        >
          <Plus size={16} /> Yeni Kullanıcı
        </button>
      </div>

      {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl space-y-3" style={{ background: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {editId ? 'Kullanıcıyı Düzenle' : 'Yeni Aile Üyesi Ekle'}
            </h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ad Soyad</label>
            <input type="text" className="input py-1.5 px-3 text-sm" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Kullanıcı Adı</label>
            <input type="text" className="input py-1.5 px-3 text-sm" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {editId ? 'Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)' : 'Geçici Şifre'}
            </label>
            <input type="text" className="input py-1.5 px-3 text-sm" value={password} onChange={e => setPassword(e.target.value)} required={!editId} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">İptal</button>
            <button type="submit" disabled={formLoading} className="btn btn-primary btn-sm">
              {formLoading ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {members.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Henüz kullanıcı eklenmemiş.</p>
        ) : (
          members.map(member => (
            <div key={member.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>@{member.username}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleOpenForm(member)} className="btn-icon btn-ghost btn-sm">
                  <Edit3 size={16} />
                </button>
                <button onClick={() => handleDeleteUser(member.id)} className="btn-icon btn-ghost btn-sm hover:!text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
