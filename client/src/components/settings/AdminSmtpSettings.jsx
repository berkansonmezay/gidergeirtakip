import { useState, useEffect } from 'react';
import { Mail, Save } from 'lucide-react';
import api from '../../services/api';

export default function AdminSmtpSettings() {
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: 587,
    user: '',
    pass: '',
    from: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/auth/smtp-settings').then(r => {
      setSmtpSettings(r.data.settings || { host: '', port: 587, user: '', pass: '', from: '' });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSmtpSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      await api.put('/auth/smtp-settings', smtpSettings);
      setSuccess('SMTP ayarları başarıyla kaydedildi.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'SMTP ayarları kaydedilirken hata oluştu.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="card p-5 mt-5">
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="card p-5 mt-5">
      <div className="flex items-center gap-3 mb-4">
        <Mail size={20} style={{ color: 'var(--primary)' }} />
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>SMTP E-posta Ayarları (Admin)</h3>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Bildirim ve hatırlatıcı e-postalarının gönderimi için ayarlar.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>SMTP Sunucusu</label>
            <input 
              type="text" 
              name="host"
              className="input text-sm" 
              placeholder="örn: smtp.gmail.com"
              value={smtpSettings.host} 
              onChange={handleChange} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>SMTP Portu</label>
            <input 
              type="number" 
              name="port"
              className="input text-sm" 
              placeholder="örn: 587 veya 465"
              value={smtpSettings.port} 
              onChange={handleChange} 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>E-posta Kullanıcı Adı</label>
            <input 
              type="email" 
              name="user"
              className="input text-sm" 
              placeholder="örn: ornek@gmail.com"
              value={smtpSettings.user} 
              onChange={handleChange} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Şifre / Uygulama Şifresi</label>
            <input 
              type="password" 
              name="pass"
              className="input text-sm" 
              placeholder="Şifre veya App Password"
              value={smtpSettings.pass} 
              onChange={handleChange} 
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Gönderen İsmi ve Adresi</label>
          <input 
            type="text" 
            name="from"
            className="input text-sm" 
            placeholder='örn: "Aile Bütçesi" <ornek@gmail.com>'
            value={smtpSettings.from} 
            onChange={handleChange} 
          />
        </div>

        {success && (
          <div className="p-3 bg-green-50 text-green-600 text-xs rounded-lg font-medium animate-fade-in">
            {success}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg font-medium animate-fade-in">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button 
            type="submit" 
            disabled={saving}
            className="btn btn-primary btn-sm flex items-center gap-2"
          >
            <Save size={14} />
            {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
}
