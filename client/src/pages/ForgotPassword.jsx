import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-20 gradient-primary animate-float" />
      </div>
      <div className="w-full max-w-md relative animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg animate-float">
            <Wallet size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Şifre Sıfırlama</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Email adresinize sıfırlama linki göndereceğiz</p>
        </div>
        <div className="card p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Email Gönderildi!</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Şifre sıfırlama linki {email} adresine gönderildi.</p>
              <Link to="/login" className="btn btn-primary"><ArrowLeft size={16} /> Giriş Sayfasına Dön</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input type="email" className="input" style={{ paddingLeft: '40px' }} placeholder="ornek@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full font-semibold">
                {loading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
              </button>
              <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                <Link to="/login" className="font-medium hover:underline" style={{ color: 'var(--primary)' }}><ArrowLeft size={14} className="inline" /> Giriş sayfasına dön</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
