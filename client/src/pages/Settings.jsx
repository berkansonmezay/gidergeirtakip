import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sun, Moon, User, Shield, Bell, Palette, X, Check, Lock } from 'lucide-react';
import useThemeStore from '../store/themeStore';
import useAuthStore from '../store/authStore';
import AdminUserManagement from '../components/settings/AdminUserManagement';
import AdminSmtpSettings from '../components/settings/AdminSmtpSettings';
import api from '../services/api';

export default function Settings() {
  const { theme, toggleTheme } = useThemeStore();
  const { user, updateUser } = useAuthStore();
  const [currency, setCurrency] = useState('TRY');
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [settings, setSettings] = useState({
    email_reminders: true,
    push_notifications: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/settings').then(r => {
      setSettings(r.data.settings);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updateSetting = async (key, val) => {
    const newSettings = { ...settings, [key]: val };
    setSettings(newSettings);
    try {
      await api.put('/auth/settings', newSettings);
    } catch {}
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const { data } = await api.put('/auth/profile', { name: profileName, email: profileEmail });
      updateUser(data.user);
      alert('Profil başarıyla güncellendi.');
    } catch (err) {
      alert(err.response?.data?.error || 'Profil güncellenirken bir hata oluştu.');
    }
    setProfileLoading(false);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Ayarlar</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Uygulama tercihlerini yönetin</p>
      </div>

      {/* Admin User Management */}
      {user?.role === 'admin' && (
        <>
          <AdminUserManagement />
          <AdminSmtpSettings />
        </>
      )}

      {/* Profile */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <User size={20} style={{ color: 'var(--primary)' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Profil Bilgileri</h3>
        </div>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Ad Soyad</label>
            <input 
              type="text" 
              className="input" 
              value={profileName} 
              onChange={e => setProfileName(e.target.value)} 
              required 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Email Adresi</label>
            <input 
              type="email" 
              className="input" 
              value={profileEmail} 
              onChange={e => setProfileEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Rol:</span>
              <span className="badge badge-income">{user?.role === 'family_admin' ? '👑 Aile Yöneticisi' : user?.role === 'admin' ? '🛡️ Admin' : '👤 Kullanıcı'}</span>
            </div>
            <button 
              type="submit" 
              disabled={profileLoading || (profileName === user?.name && profileEmail === user?.email)}
              className="btn btn-primary btn-sm"
            >
              {profileLoading ? 'Güncelleniyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>

      {/* Appearance */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <Palette size={20} style={{ color: 'var(--primary)' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Görünüm</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Tema</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Koyu veya açık tema seçin</p>
            </div>
            <button onClick={toggleTheme} className="flex items-center gap-2 btn btn-secondary btn-sm">
              {theme === 'light' ? <><Moon size={16} /> Koyu Tema</> : <><Sun size={16} /> Açık Tema</>}
            </button>
          </div>
          <div className="flex items-center justify-between py-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Para Birimi</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Varsayılan para birimi</p>
            </div>
            <select className="select" style={{ width: 'auto' }} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="TRY">₺ TRY</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} style={{ color: 'var(--primary)' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Güvenlik</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Şifre Değiştir</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hesap şifrenizi güncelleyin</p>
            </div>
            <button onClick={() => setShowPasswordModal(true)} className="btn btn-secondary btn-sm">Değiştir</button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <Bell size={20} style={{ color: 'var(--primary)' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Hatırlatıcı Seçenekleri</h3>
        </div>
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Yükleniyor...</p>
          ) : (
            <>
              <div className="flex items-center justify-between py-2 border-b first:border-0" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Uygulama Bildirimi</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Taksit hatırlatıcıları için uygulama içi bildirim gönder</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settings.push_notifications} 
                    onChange={(e) => updateSetting('push_notifications', e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 rounded-full peer-checked:bg-[var(--primary)] bg-[var(--border)] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>

              <div className="flex items-center justify-between py-2 border-b first:border-0" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>E-posta Hatırlatması</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Taksit hatırlatıcıları için e-posta gönder</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settings.email_reminders} 
                    onChange={(e) => updateSetting('email_reminders', e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 rounded-full peer-checked:bg-[var(--primary)] bg-[var(--border)] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>
              
              <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium leading-relaxed">
                  <span className="font-bold">Not:</span> Hatırlatıcı gönderilmesi için her taksit kaydı içerisinde bulunan zil ikonunun aktif edilmesi gerekmektedir.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* App info */}
      <div className="text-center py-4">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aile Bütçesi v1.0.0 • Made with ❤️</p>
      </div>

      {showPasswordModal && createPortal(
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />,
        document.body
      )}
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setError('Şifreler uyuşmuyor.');
    
    setLoading(true);
    setError(null);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      alert('Şifre başarıyla değiştirildi.');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Bir hata oluştu.');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Lock size={20} />
            </div>
            <h3 className="text-xl font-bold">Şifre Değiştir</h3>
          </div>
          <button onClick={onClose} className="btn-icon btn-ghost">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Mevcut Şifre</label>
            <input 
              type="password" 
              className="input" 
              value={currentPassword} 
              onChange={e => setCurrentPassword(e.target.value)} 
              required 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Yeni Şifre</label>
            <input 
              type="password" 
              className="input" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              required 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Yeni Şifre (Tekrar)</label>
            <input 
              type="password" 
              className="input" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              required 
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Vazgeç</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Güncelleniyor...' : 'Güncelle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
