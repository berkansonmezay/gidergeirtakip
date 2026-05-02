import { Menu, Sun, Moon, Plus, Bell, User } from 'lucide-react';
import useThemeStore from '../../store/themeStore';
import useAuthStore from '../../store/authStore';
import useNotificationStore from '../../store/notificationStore';
import { useState, useEffect } from 'react';

export default function Header({ onMenuClick, onQuickAdd }) {
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

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
        <div className="relative">
          <button 
            className="btn-icon btn-ghost relative" 
            title="Bildirimler"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
          
          {showNotifications && (
            <div 
              className="absolute right-0 mt-2 w-80 card shadow-xl animate-scale-in"
              style={{ maxHeight: '400px', display: 'flex', flexDirection: 'column' }}
              onMouseLeave={() => setShowNotifications(false)}
            >
              <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Bildirimler</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Tümünü Okundu İşaretle
                  </button>
                )}
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '350px' }}>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    Yeni bildiriminiz yok.
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={`p-3 border-b text-sm transition-colors cursor-pointer flex justify-between items-start ${notif.is_read ? '' : 'bg-[var(--bg-secondary)]'}`}
                      style={{ borderColor: 'var(--border)' }}
                      onClick={() => !notif.is_read && markAsRead(notif.id)}
                    >
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{notif.title}</p>
                        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{notif.message}</p>
                        <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                          {new Date(notif.created_at).toLocaleString('tr-TR')}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                        className="text-gray-400 hover:text-red-500 ml-2 mt-1"
                        title="Sil"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
