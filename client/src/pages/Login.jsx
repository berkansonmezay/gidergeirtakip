import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const { login, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch {}
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-20 gradient-primary animate-float" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10 gradient-accent" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5 gradient-primary" />
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ animation: 'float 3s ease-in-out infinite' }}>
            <Wallet size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Aile Bütçesi</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Finansal geleceğinizi kontrol altına alın</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Giriş Yap</h2>
          
          {error && (
            <div className="mb-4 p-3 rounded-xl text-sm font-medium animate-fade-in" style={{ background: 'var(--expense-light)', color: 'var(--expense)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Kullanıcı Adı veya Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="admin veya ornek@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Şifre</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input"
                  style={{ paddingLeft: '40px', paddingRight: '40px' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded accent-[var(--primary)]" />
                Beni hatırla
              </label>
              <Link to="/forgot-password" className="text-sm font-medium hover:underline" style={{ color: 'var(--primary)' }}>
                Şifremi unuttum
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg w-full font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Giriş yapılıyor...
                </span>
              ) : 'Giriş Yap'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
