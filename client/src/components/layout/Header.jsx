import { Menu, Sun, Moon, Plus, Bell, User } from 'lucide-react';
import useThemeStore from '../../store/themeStore';
import useAuthStore from '../../store/authStore';
import { useState } from 'react';

export default function Header({ onMenuClick, onQuickAdd }) {
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 h-16 glass"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="btn-icon btn-ghost md:hidden">
          <Menu size={22} />
        </button>
        <div className="hidden md:block">
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Hoş geldin 👋
          </p>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {user?.name || 'Kullanıcı'}
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Quick add */}
        <button
          onClick={onQuickAdd}
          className="btn btn-primary btn-sm gap-1 shadow-md hover:shadow-lg transition-shadow"
          style={{ borderRadius: '9999px' }}
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Hızlı Ekle</span>
        </button>

        {/* Theme toggle */}
        <button onClick={toggleTheme} className="btn-icon btn-ghost" title="Tema Değiştir">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* Notifications */}
        <button className="btn-icon btn-ghost relative" title="Bildirimler">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
        </button>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-semibold cursor-pointer"
          >
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </button>
          {showProfile && (
            <div
              className="absolute right-0 mt-2 w-48 card p-2 animate-scale-in"
              onMouseLeave={() => setShowProfile(false)}
            >
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
              </div>
              <div className="pt-1">
                <a href="/settings" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-secondary)]" style={{ color: 'var(--text-secondary)' }}>
                  <User size={16} /> Profil
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
