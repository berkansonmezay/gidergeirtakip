import { useState } from 'react';
import { Sun, Moon, User, Shield, Bell, Palette } from 'lucide-react';
import useThemeStore from '../store/themeStore';
import useAuthStore from '../store/authStore';
import AdminUserManagement from '../components/settings/AdminUserManagement';

export default function Settings() {
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const [currency, setCurrency] = useState('TRY');

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Ayarlar</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Uygulama tercihlerini yönetin</p>
      </div>

      {/* Admin User Management */}
      {user?.role === 'admin' && (
        <AdminUserManagement />
      )}

      {/* Profile */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <User size={20} style={{ color: 'var(--primary)' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Profil Bilgileri</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ad Soyad</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Email</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Rol</span>
            <span className="badge badge-income">{user?.role === 'family_admin' ? '👑 Aile Yöneticisi' : user?.role === 'admin' ? '🛡️ Admin' : '👤 Kullanıcı'}</span>
          </div>
        </div>
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
            <button className="btn btn-secondary btn-sm">Değiştir</button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <Bell size={20} style={{ color: 'var(--primary)' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Bildirimler</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Taksit hatırlatmaları', desc: 'Yaklaşan taksit ödemelerinde bildirim' },
            { label: 'Bütçe uyarıları', desc: 'Bütçe limitine yaklaştığınızda uyarı' },
            { label: 'Haftalık rapor', desc: 'Her hafta özet rapor' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-t first:border-0" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-10 h-5 rounded-full peer-checked:bg-[var(--primary)] bg-[var(--border)] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* App info */}
      <div className="text-center py-4">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aile Bütçesi v1.0.0 • Made with ❤️</p>
      </div>
    </div>
  );
}
